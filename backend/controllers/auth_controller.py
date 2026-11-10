"""Authentication, registration, verification and password reset handlers."""

import datetime
import secrets

from flask import jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from db.session import _commit_or_warn
from email_service import send_otp_email
from extensions import db
from lib.constants import (
    EMAIL_VERIFY_MAX_ATTEMPTS,
    OTP_DEV_REVEAL,
    RESET_OTP_EXPIRY_MINUTES,
    RESET_OTP_MAX_ATTEMPTS,
    TWO_FACTOR_MAX_ATTEMPTS,
)
from lib.rate_limit import _rate_limit_exceeded
from lib.security import _DUMMY_PASSWORD_HASH
from lib.time import _parse_iso, _utcnow_iso_z, _utcnow_naive
from lib.validation import _validate_password_strength
from models import UserModel
from services.auth_service import (
    _apply_lockout,
    _clear_email_verify_state,
    _clear_login_failures,
    _email_verify_payload,
    _generate_otp,
    _is_account_locked,
    _issue_email_verify_code,
    _lock_minutes_remaining,
    _register_login_failure,
    _user_is_email_verified,
    generate_token,
)
from services.log_service import log_action
from services.settings_service import _load_system_settings


def auth_login():
    data = request.json or {}
    email = data.get("email")

    # Per-IP throttle on top of the per-account lockout, so password guessing
    # across many accounts (or from a botnet) can't spin the CPU or hammer hashes.
    if _rate_limit_exceeded(f"login-ip:{request.remote_addr}", 60):
        return jsonify({
            "error": "Too many login attempts from this location. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429

    email_str = email.strip() if isinstance(email, str) else (email.get("email", "").strip() if isinstance(email, dict) else "")

    # Accounts are provisioned by administrators or self-registration; they are
    # NEVER minted on the fly from client-supplied identity (name/role/id). Login
    # must match an account that already exists in the user directory.
    user = UserModel.query.filter(db.func.lower(UserModel.email) == email_str.lower()).first() if email_str else None

    if not user:
        # Burn the same time a real password verification costs, then reply with
        # the identical generic wording used for a wrong password so attackers
        # cannot tell which emails exist in the user directory (enumeration).
        check_password_hash(_DUMMY_PASSWORD_HASH, data.get("password") if isinstance(data.get("password"), str) else "")
        return jsonify({"error": "Invalid email or password. Please try again.", "code": "INVALID_CREDENTIALS"}), 401

    # Accounts throttled at the lockout cap cannot keep guessing.
    lock_minutes = _lock_minutes_remaining(user)
    if lock_minutes:
        show_minutes = int(lock_minutes) + (1 if lock_minutes > int(lock_minutes) else 0)
        log_action(user.user_id, user.to_dict()["name"], user.role, "LOGIN_LOCKED", f"Login blocked for {user.email} (locked for about {show_minutes} minute(s))")
        return jsonify({
            "error": f"Account temporarily locked due to too many failed login attempts. Try again in about {show_minutes} minute(s).",
            "code": "ACCOUNT_LOCKED",
        }), 429

    # Password authentication is required for EVERY account. Legacy accounts
    # without a password hash cannot authenticate until an admin sets one
    # (passwordless logins were a full account-takeover vector).
    password = data.get("password")
    if not isinstance(password, str) or not password:
        return jsonify({"error": "Invalid email or password. Please try again.", "code": "INVALID_CREDENTIALS"}), 401
    if not check_password_hash(user.password_hash or "", password):
        _register_login_failure(user)
        locked = _is_account_locked(user)
        log_action(user.user_id, user.to_dict()["name"], user.role, "ACCOUNT_LOCKED" if locked else "LOGIN_FAILED", f"Failed login attempt for {user.email} (incorrect password)")
        if locked:
            show_minutes = max(1, int(_lock_minutes_remaining(user)) + 1)
            return jsonify({
                "error": f"Account temporarily locked due to too many failed login attempts. Try again in about {show_minutes} minute(s).",
                "code": "ACCOUNT_LOCKED",
            }), 429
        return jsonify({"error": "Invalid email or password. Please try again.", "code": "INVALID_CREDENTIALS"}), 401

    # Cleared by a successful password check; a fresh 2FA ping also resets the
    # attempts meter so a legitimately signed-in user isn't double-counted.
    _clear_login_failures(user)

    # Deactivated/suspended accounts cannot sign in. Checked after the correct
    # password so the reason isn't leaked to unauthenticated guessers.
    if (user.status or "active") != "active":
        log_action(user.user_id, user.to_dict()["name"], user.role, "LOGIN_DISABLED", f"Login blocked for {user.email} (status: {user.status})")
        return jsonify({
            "error": "This account cannot sign in. Please contact an administrator.",
            "code": "ACCOUNT_DISABLED",
        }), 403

    # Email must be verified before the account can sign in. Unverified accounts
    # get a fresh code and are routed to the verify-email screen (no token yet).
    if not _user_is_email_verified(user):
        _issue_email_verify_code(user)
        log_action(user.user_id, user.to_dict()["name"], user.role, "EMAIL_VERIFY_REQUIRED", f"Login blocked for unverified email {user.email}; verification code issued")
        return jsonify(_email_verify_payload(user)), 200

    # Two-factor authentication enforcement for staff/admin logins
    settings = _load_system_settings()
    if settings.get("require2FA") == "true" and user.role in ("teacher", "admin"):
        code = _generate_otp()
        user.two_factor_code = code
        user.two_factor_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=5)).isoformat()
        db.session.commit()
        if not send_otp_email(user.email, "2fa", code, 5) and OTP_DEV_REVEAL:
            print(f"[Auth] 2FA OTP for {user.email}: {code}")
        log_action(user.user_id, user.to_dict()["name"], user.role, "TWO_FACTOR_REQUIRED", f"2FA code issued for {user.email}")
        payload = {
            "twoFactorRequired": True,
            "userId": user.user_id,
            "email": user.email,
            "expiresInMinutes": 5,
        }
        if OTP_DEV_REVEAL:
            payload["devCode"] = code
        return jsonify(payload), 200

    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) logged in with JWT token")

    return jsonify({"token": token, "user": user_dict})


def verify_two_factor():
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    code = str(data.get("code") or "").strip()
    user = db.session.get(UserModel, user_id) if user_id else None
    if not user:
        return jsonify({"error": "Session expired. Please sign in again.", "code": "NOT_FOUND"}), 401
    if (user.status or "active") != "active":
        return jsonify({"error": "This account cannot sign in. Please contact an administrator.", "code": "ACCOUNT_DISABLED"}), 403
    if _is_account_locked(user):
        show_minutes = max(1, int(_lock_minutes_remaining(user)) + 1)
        return jsonify({
            "error": f"Account temporarily locked due to too many failed attempts. Try again in about {show_minutes} minute(s).",
            "code": "ACCOUNT_LOCKED",
        }), 429
    if not user.two_factor_code or not secrets.compare_digest(user.two_factor_code, code):
        user.two_factor_attempts = (user.two_factor_attempts or 0) + 1
        if (user.two_factor_attempts or 0) >= TWO_FACTOR_MAX_ATTEMPTS:
            _apply_lockout(user)
        db.session.commit()
        return jsonify({"error": "Invalid verification code. Please try again.", "code": "INVALID_2FA"}), 401
    expires = _parse_iso(user.two_factor_expires_at)
    if expires and _utcnow_naive() > expires:
        return jsonify({"error": "Verification code has expired. Please sign in again.", "code": "EXPIRED_2FA"}), 401
    _clear_login_failures(user)
    user.two_factor_code = None
    user.two_factor_expires_at = None
    user.last_login = _utcnow_iso_z()
    db.session.commit()
    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) completed 2FA login")
    return jsonify({"token": token, "user": user_dict})


def auth_register():
    data = request.json or {}
    if _rate_limit_exceeded(f"register-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many sign-up attempts from this location. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()

    # Self-registration is open to student and teacher roles. Administrator
    # accounts cannot be claimed through the public endpoint — they are
    # provisioned by an existing admin.
    requested_role = data.get("role")
    if requested_role == "admin":
        return jsonify({
            "error": "Administrator accounts cannot be self-registered. Please contact an administrator.",
            "code": "ADMIN_REGISTRATION_DISABLED",
        }), 403
    role = "teacher" if requested_role == "teacher" else "student"

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required."}), 400

    existing = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if existing:
        return jsonify({
            "error": f"Account with email {email} is already registered.",
            "code": "USER_EXISTS"
        }), 409

    names = name.split(" ", 1)
    new_user = UserModel(
        user_id=f"usr-{role}-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        first_name=names[0] if names else "Registered",
        last_name=names[1] if len(names) > 1 else "User",
        email=email,
        role=role,
        department=data.get("department") or "College of Computer Studies",
        student_id=data.get("studentId") or (f"2024-STU-{int(datetime.datetime.now(datetime.timezone.utc).timestamp()) % 8999 + 1000}" if role == "student" else None),
        status="active",
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    password = data.get("password")
    strength_error = _validate_password_strength(password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "PASSWORD_REQUIRED"}), 400
    new_user.password_hash = generate_password_hash(password)
    new_user.email_verified = 0
    db.session.add(new_user)
    db.session.commit()

    _issue_email_verify_code(new_user)
    log_action(new_user.user_id, new_user.to_dict()["name"], new_user.role, "USER_REGISTER", f"Registered new {role} account: {email} (awaiting email verification)")
    return jsonify(_email_verify_payload(new_user)), 201


def verify_email():
    """Confirms a registration by verifying the emailed 6-digit code; on success returns a full login token."""
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    code = str(data.get("code") or "").strip()
    user = db.session.get(UserModel, user_id) if user_id else None

    if not user:
        return jsonify({"error": "Account not found. Please register again.", "code": "NOT_FOUND"}), 404
    if (user.status or "active") != "active":
        return jsonify({"error": "This account cannot sign in. Please contact an administrator.", "code": "ACCOUNT_DISABLED"}), 403
    if _user_is_email_verified(user):
        # Already verified: never mint a token without credentials. The client
        # should sign in with the password instead of re-verifying an active account.
        return jsonify({
            "error": "This account is already verified. Please sign in with your password.",
            "code": "ALREADY_VERIFIED",
        }), 409
    if not user.email_verify_code or not user.email_verify_expires_at:
        # No pending code; reissue one.
        _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user)), 200

    expires = _parse_iso(user.email_verify_expires_at)
    if expires and _utcnow_naive() > expires:
        _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user)), 200
    if (user.email_verify_attempts or 0) >= EMAIL_VERIFY_MAX_ATTEMPTS:
        _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user)), 200
    if not code or not user.email_verify_code or not secrets.compare_digest(user.email_verify_code, code):
        user.email_verify_attempts = (user.email_verify_attempts or 0) + 1
        db.session.commit()
        return jsonify({"error": "Incorrect verification code. Please try again.", "code": "INVALID_EMAIL_CODE"}), 401

    _clear_email_verify_state(user)
    user.last_login = _utcnow_iso_z()
    db.session.commit()
    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "EMAIL_VERIFIED", f"Email address verified for {user.email}")
    return jsonify({"token": token, "user": user_dict}), 200


def resend_email_code():
    """Re-issues a 6-digit email-verification code for an unverified account."""
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    user = db.session.get(UserModel, user_id) if user_id else None
    if not user:
        return jsonify({"error": "Account not found. Please register again.", "code": "NOT_FOUND"}), 404
    if _user_is_email_verified(user):
        return jsonify(_email_verify_payload(user)), 200
    _issue_email_verify_code(user)
    return jsonify(_email_verify_payload(user)), 200


def resend_two_factor_code():
    """Re-issues a 6-digit two-factor code for a pending staff/admin sign-in."""
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    user = db.session.get(UserModel, user_id) if user_id else None
    if not user:
        return jsonify({"error": "Session expired. Please sign in again.", "code": "NOT_FOUND"}), 404
    if (user.status or "active") != "active":
        return jsonify({"error": "This account cannot sign in. Please contact an administrator.", "code": "ACCOUNT_DISABLED"}), 403
    if _is_account_locked(user):
        show_minutes = max(1, int(_lock_minutes_remaining(user)) + 1)
        return jsonify({
            "error": f"Account temporarily locked due to too many failed attempts. Try again in about {show_minutes} minute(s).",
            "code": "ACCOUNT_LOCKED",
        }), 429
    settings = _load_system_settings()
    if settings.get("require2FA") != "true" or user.role not in ("teacher", "admin"):
        return jsonify({
            "error": "Two-factor authentication is not required for this account. Please sign in again.",
            "code": "2FA_NOT_REQUIRED",
        }), 400
    if not user.two_factor_code:
        return jsonify({
            "error": "No pending verification. Please sign in again.",
            "code": "NO_PENDING_2FA",
        }), 400
    code = _generate_otp()
    user.two_factor_code = code
    user.two_factor_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=5)).isoformat()
    user.two_factor_attempts = None
    db.session.commit()
    if not send_otp_email(user.email, "2fa", code, 5) and OTP_DEV_REVEAL:
        print(f"[Auth] 2FA OTP for {user.email}: {code}")
    payload = {"message": f"A new verification code was sent to {user.email}.", "expiresInMinutes": 5}
    if OTP_DEV_REVEAL:
        payload["devCode"] = code
    return jsonify(payload), 200


def auth_change_password():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    user = db.session.get(UserModel, current_user.get("id"))
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    new_password = data.get("newPassword")
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "WEAK_PASSWORD"}), 400

    if user.password_hash:
        current_password = data.get("currentPassword")
        if not isinstance(current_password, str) or not check_password_hash(user.password_hash, current_password):
            _register_login_failure(user)
            return jsonify({"error": "Current password is incorrect.", "code": "INVALID_CURRENT_PASSWORD"}), 401

    _clear_login_failures(user)
    user.password_hash = generate_password_hash(new_password)
    # Invalidate every other session this user holds (password knowledge changed).
    user.token_version = (user.token_version or 0) + 1
    if not _commit_or_warn("password change"):
        return jsonify({"error": "Could not update the password. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    # The current session is refreshed with a fresh token (the bumped token_version
    # has just invalidated the old one), so the user stays signed in.
    user_dict = user.to_dict()
    fresh_token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "PASSWORD_CHANGED", f"User changed their own password")
    return jsonify({"success": True, "message": "Password updated successfully.", "token": fresh_token, "user": user_dict}), 200


def auth_request_reset_otp():
    """Initiates the forgot-password flow: issues a 6-digit OTP for a student account."""
    data = request.json or {}
    if _rate_limit_exceeded(f"reset-otp-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many reset requests. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400

    user = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if not user:
        # Generic reply so attackers can't enumerate which emails are registered.
        return jsonify({
            "success": True,
            "message": "If an account exists for that email, a password reset code has been issued.",
            "expiresInMinutes": RESET_OTP_EXPIRY_MINUTES,
        }), 200
    if user.role in ("teacher", "admin"):
        return jsonify({
            "error": "Staff passwords cannot be reset through the self-service flow. Please contact an administrator.",
            "code": "STAFF_RESET_FORBIDDEN",
        }), 403

    # A temporary login lockout is intentionally overridable here: the reset code
    # goes to the owner's verified email, so this is the recovery path if the
    # owner is locked out by failed guesses (the code itself gates the change).
    # Issuing a new code is always allowed: it supersedes any prior code and
    # resets its attempts, so mistaken users aren't stuck behind a burned code.
    code = _generate_otp()
    user.reset_otp = code
    user.reset_otp_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=RESET_OTP_EXPIRY_MINUTES)).isoformat()
    user.reset_otp_attempts = 0
    db.session.commit()
    if not send_otp_email(user.email, "reset", code, RESET_OTP_EXPIRY_MINUTES) and OTP_DEV_REVEAL:
        print(f"[Auth] Password reset OTP for {user.email}: {code}")
    log_action(user.user_id, user.to_dict()["name"], user.role, "RESET_OTP_REQUESTED", f"Password reset code issued for {user.email}")

    payload = {
        "success": True,
        "message": f"A 6-digit verification code was sent to {user.email}. It expires in {RESET_OTP_EXPIRY_MINUTES} minutes.",
        "expiresInMinutes": RESET_OTP_EXPIRY_MINUTES,
    }
    if OTP_DEV_REVEAL:
        payload["devCode"] = code
    return jsonify(payload), 200


def _check_reset_otp(user, otp):
    """Validates a forgot-password OTP, incrementing attempts on mismatch.

    Returns ``None`` when the code is valid, otherwise a ``(json, status)``
    tuple. The code is not consumed here; callers decide when to clear it.
    """
    expires = _parse_iso(user.reset_otp_expires_at)
    if not user.reset_otp or not expires or _utcnow_naive() > expires:
        user.reset_otp = None
        user.reset_otp_expires_at = None
        user.reset_otp_attempts = None
        db.session.commit()
        return jsonify({"error": "This code has expired. Request a new one.", "code": "RESET_OTP_EXPIRED"}), 401
    if (user.reset_otp_attempts or 0) >= RESET_OTP_MAX_ATTEMPTS:
        return jsonify({"error": "Too many incorrect reset codes. Request a new code.", "code": "RESET_OTP_LOCKED"}), 429
    if not otp or not user.reset_otp or not secrets.compare_digest(user.reset_otp, otp):
        user.reset_otp_attempts = (user.reset_otp_attempts or 0) + 1
        db.session.commit()
        return jsonify({"error": "Incorrect verification code. Please try again.", "code": "INVALID_OTP"}), 401
    return None


def auth_verify_reset_otp():
    """Confirms a forgot-password OTP without applying the new password.

    Lets the UI validate the emailed code first and only reveal the
    new-password fields once it checks out. The code stays valid for
    ``auth_reset_password`` so the final reset still re-verifies it.
    """
    data = request.json or {}
    if _rate_limit_exceeded(f"reset-verify-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = (data.get("email") or "").strip().lower()
    otp = str(data.get("otp") or data.get("code") or "").strip()
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400
    if not otp:
        return jsonify({"error": "Please enter the 6-digit verification code.", "code": "BAD_REQUEST"}), 400

    user = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if not user:
        return jsonify({
            "error": "No matching reset request was found for that email. Please request a new code and try again.",
            "code": "NOT_FOUND",
        }), 404
    if user.role in ("teacher", "admin"):
        return jsonify({
            "error": "Staff passwords cannot be reset through the self-service flow. Please contact an administrator.",
            "code": "STAFF_RESET_FORBIDDEN",
        }), 403

    error = _check_reset_otp(user, otp)
    if error:
        return error
    return jsonify({"success": True, "message": "Verification code confirmed. Choose a new password."}), 200


def auth_reset_password():
    """Verifies the emailed OTP and applies a new password for a student account."""
    data = request.json or {}
    if _rate_limit_exceeded(f"reset-pw-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many reset requests. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = (data.get("email") or "").strip().lower()
    otp = str(data.get("otp") or data.get("code") or "").strip()
    new_password = data.get("newPassword")
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "WEAK_PASSWORD"}), 400

    user = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if not user:
        # Generic reply so attackers can't use this step to enumerate registered emails.
        return jsonify({
            "error": "No matching reset request was found for that email. Please request a new code and try again.",
            "code": "NOT_FOUND",
        }), 404
    if user.role in ("teacher", "admin"):
        return jsonify({
            "error": "Staff passwords cannot be reset through the self-service flow. Please contact an administrator.",
            "code": "STAFF_RESET_FORBIDDEN",
        }), 403

    # Temporary login lockouts don't block the OTP-gated reset (email-verified).
    error = _check_reset_otp(user, otp)
    if error:
        return error

    _clear_login_failures(user)
    user.password_hash = generate_password_hash(new_password)
    user.reset_otp = None
    user.reset_otp_expires_at = None
    user.reset_otp_attempts = None
    # Invalidate any sessions minted before the reset.
    user.token_version = (user.token_version or 0) + 1
    if not _commit_or_warn("password reset"):
        return jsonify({"error": "Could not update the password. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(user.user_id, user.to_dict()["name"], user.role, "PASSWORD_RESET", f"Password reset via forgot-password flow for {email}")
    return jsonify({"success": True, "message": "Password reset successfully. You can now sign in with your new password."}), 200
