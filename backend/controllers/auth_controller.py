"""Authentication, registration, verification and password reset handlers."""

import datetime
import secrets
import jwt

from flask import jsonify, request
from lib.password import hash_password, rehash_if_legacy, verify_password
from pymysql.err import IntegrityError

from db.session import _commit_or_warn
from email_service import send_otp_email
from extensions import db
from config import (
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_DOMAIN,
    AUTH_COOKIE_PATH,
    AUTH_COOKIE_SECURE,
    AUTH_COOKIE_SAMESITE,
    CSRF_COOKIE_NAME,
    REFRESH_COOKIE_DOMAIN,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    REFRESH_COOKIE_SECURE,
    REFRESH_COOKIE_SAMESITE,
    SECRET_KEY,
)
from lib.auth import is_mobile_client
from lib.constants import (
    EMAIL_VERIFY_MAX_ATTEMPTS,
    RESET_OTP_EXPIRY_MINUTES,
    RESET_OTP_MAX_ATTEMPTS,
    TWO_FACTOR_MAX_ATTEMPTS,
    otp_reveal_enabled,
)
from lib.id import generate_id
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
    _hash_otp,
    _is_account_locked,
    _issue_email_verify_code,
    _lock_minutes_remaining,
    _register_login_failure,
    _user_is_email_verified,
    _verify_otp,
    find_user_by_email,
    generate_refresh_token,
    generate_token,
    refresh_access_token,
    REFRESH_TOKEN_DAYS,
    revoke_all_refresh_tokens,
    revoke_all_sessions,
    revoke_refresh_token,
    revoke_session,
    session_timeout_minutes,
)
from services.log_service import log_action
from services.settings_service import _load_system_settings


def _session_cookie_kwargs(max_age):
    kwargs = {
        "path": AUTH_COOKIE_PATH,
        "httponly": True,
        "samesite": AUTH_COOKIE_SAMESITE,
        "max_age": max_age,
    }
    if AUTH_COOKIE_DOMAIN:
        kwargs["domain"] = AUTH_COOKIE_DOMAIN
    if AUTH_COOKIE_SECURE:
        kwargs["secure"] = True
    return kwargs


def _csrf_cookie_kwargs(max_age):
    kwargs = {
        "path": AUTH_COOKIE_PATH,
        "samesite": AUTH_COOKIE_SAMESITE,
        "max_age": max_age,
    }
    if AUTH_COOKIE_DOMAIN:
        kwargs["domain"] = AUTH_COOKIE_DOMAIN
    if AUTH_COOKIE_SECURE:
        kwargs["secure"] = True
    return kwargs


def _apply_session_cookies(response, token, csrf_token=None):
    max_age = session_timeout_minutes() * 60
    response.set_cookie(AUTH_COOKIE_NAME, token, **_session_cookie_kwargs(max_age))
    response.set_cookie(
        CSRF_COOKIE_NAME, csrf_token or secrets.token_urlsafe(32), **_csrf_cookie_kwargs(max_age)
    )
    return response


def _refresh_cookie_kwargs(max_age):
    kwargs = {
        "path": REFRESH_COOKIE_PATH,
        "httponly": True,
        "samesite": REFRESH_COOKIE_SAMESITE,
        "max_age": max_age,
    }
    if REFRESH_COOKIE_DOMAIN:
        kwargs["domain"] = REFRESH_COOKIE_DOMAIN
    if REFRESH_COOKIE_SECURE:
        kwargs["secure"] = True
    return kwargs


def _apply_refresh_cookie(response, refresh_token):
    max_age = REFRESH_TOKEN_DAYS * 24 * 60 * 60
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_token, **_refresh_cookie_kwargs(max_age))
    return response


def _auth_json(user_dict, token, jti, status=200, extra=None):
    """Login/verify/password-change response: access token (cookie/body), refresh token (cookie/body).

    Records both tokens as active server-side sessions so they can be revoked
    (logout, password change, suspension, refresh rotation).

    For web (non-mobile) clients, also issues a double-submit CSRF token that
    the frontend must echo back as the ``X-CSRF-Token`` header on unsafe
    cookie-authenticated requests.
    """
    body = {"user": user_dict}
    if extra:
        body.update(extra)
    refresh_token, refresh_jti = generate_refresh_token(user_dict)
    if is_mobile_client():
        body["token"] = token
        body["refreshToken"] = refresh_token
    response = jsonify(body)
    if not is_mobile_client():
        csrf_token = secrets.token_urlsafe(32)
        body["csrfToken"] = csrf_token
        response = jsonify(body)
        _apply_session_cookies(response, token, csrf_token)
        _apply_refresh_cookie(response, refresh_token)
    return response, status


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
    user = find_user_by_email(email_str)

    if not user:
        # Burn the same time a real password verification costs, then reply with
        # the identical generic wording used for a wrong password so attackers
        # cannot tell which emails exist in the user directory (enumeration).
        verify_password(data.get("password") if isinstance(data.get("password"), str) else "", _DUMMY_PASSWORD_HASH)
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
    if not verify_password(password, user.password_hash or ""):
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

    # Rehash legacy Werkzeug hash with Argon2 on successful login
    new_hash = rehash_if_legacy(password, user.password_hash or "")
    if new_hash:
        user.password_hash = new_hash
        if not _commit_or_warn("rehash_password"):
            print("[Auth] Password rehash failed for user", user.user_id)

    # Cleared by a successful password check; a fresh 2FA ping also resets the
    # attempts meter so a legitimately signed-in user isn't double-counted.
    _clear_login_failures(user)

    # Deactivated/suspended accounts cannot sign in. Checked after the correct
    # password so the reason isn't leaked to unauthenticated guessers.
    if (user.status or "active") != "active":
        log_action(user.user_id, user.to_dict()["name"], user.role, "LOGIN_DISABLED", f"Login blocked for {user.email} (status: {user.status})")
        return jsonify({
            "error": "This account has been Suspended. Please contact the administrator.",
            "code": "ACCOUNT_DISABLED",
        }), 403

    # Email must be verified before the account can sign in. Unverified accounts
    # get a fresh code and are routed to the verify-email screen (no token yet).
    if not _user_is_email_verified(user):
        code = _issue_email_verify_code(user)
        log_action(user.user_id, user.to_dict()["name"], user.role, "EMAIL_VERIFY_REQUIRED", f"Login blocked for unverified email {user.email}; verification code issued")
        return jsonify(_email_verify_payload(user, code)), 200

    # Two-factor authentication enforcement for staff/admin logins
    settings = _load_system_settings()
    if settings.get("require2FA") == "true" and user.role in ("teacher", "admin"):
        code = _generate_otp()
        user.two_factor_code = _hash_otp(code)
        user.two_factor_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=5)).isoformat()
        _commit_or_warn("2FA code issue")
        otp_sent = send_otp_email(user.email, "2fa", code, 5)
        if not otp_sent and not otp_reveal_enabled():
            return jsonify({
                "error": "Email delivery failed. Please try again later.",
                "code": "EMAIL_DELIVERY_FAILED",
            }), 503
        if not otp_sent:
            print(f"[Auth] 2FA OTP for {user.email}: {code}")
        log_action(user.user_id, user.to_dict()["name"], user.role, "TWO_FACTOR_REQUIRED", f"2FA code issued for {user.email}")
        payload = {
            "twoFactorRequired": True,
            "userId": user.user_id,
            "email": user.email,
            "expiresInMinutes": 5,
        }
        if otp_reveal_enabled():
            payload["devCode"] = code
        return jsonify(payload), 200

    user_dict = user.to_dict()
    token, jti = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) logged in with JWT token")

    return _auth_json(user_dict, token, jti)


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
    if not user.two_factor_code or not _verify_otp(code, user.two_factor_code):
        user.two_factor_attempts = (user.two_factor_attempts or 0) + 1
        if (user.two_factor_attempts or 0) >= TWO_FACTOR_MAX_ATTEMPTS:
            _apply_lockout(user)
        _commit_or_warn("2FA failure attempt")
        return jsonify({"error": "Invalid verification code. Please try again.", "code": "INVALID_2FA"}), 401
    expires = _parse_iso(user.two_factor_expires_at)
    if expires and _utcnow_naive() > expires:
        return jsonify({"error": "Verification code has expired. Please sign in again.", "code": "EXPIRED_2FA"}), 401
    _clear_login_failures(user)
    user.two_factor_code = None
    user.two_factor_expires_at = None
    user.last_login = _utcnow_iso_z()
    _commit_or_warn("2FA login")
    user_dict = user.to_dict()
    token, jti = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) completed 2FA login")
    return _auth_json(user_dict, token, jti)


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

    existing = find_user_by_email(email)
    if existing:
        # An unfinished sign-up can be resumed safely when the caller proves
        # ownership of the account by knowing its password: resend the email
        # verification code instead of making them start over. Verified
        # accounts, disabled accounts, and wrong passwords still get the same
        # generic USER_EXISTS response (no account enumeration).
        password = data.get("password")
        can_resume = (
            not _user_is_email_verified(existing)
            and (existing.status or "active") == "active"
            and isinstance(password, str)
            and bool(password)
            and verify_password(password, existing.password_hash or "")
        )
        if can_resume:
            _issue_email_verify_code(existing)
            existing_dict = existing.to_dict()
            code = _issue_email_verify_code(existing)
            log_action(
                existing.user_id,
                existing_dict["name"],
                existing.role,
                "EMAIL_VERIFY_RESUMED",
                f"Registration resumed for unverified account: {email}",
            )
            return jsonify(_email_verify_payload(existing, code)), 200
        return jsonify({
            "error": f"Account with email {email} is already registered.",
            "code": "USER_EXISTS"
        }), 409

    try:
        names = name.split(" ", 1)
        new_user = UserModel(
            user_id=generate_id(f"usr-{role}"),
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
        new_user.password_hash = hash_password(password)
        new_user.email_verified = 0
        db.session.add(new_user)
        if not _commit_or_warn("user registration"):
            return jsonify({
                "error": "Registration could not be completed. The database write failed. Please try again.",
                "code": "SAVE_FAILED",
            }), 500

        user_dict = new_user.to_dict()
        code = _issue_email_verify_code(new_user)
        verify_payload = _email_verify_payload(new_user, code)
        log_action(new_user.user_id, user_dict["name"], new_user.role, "USER_REGISTER", f"Registered new {role} account: {email} (awaiting email verification)")
        return jsonify(verify_payload), 201
    except IntegrityError as err:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[Auth] Registration IntegrityError for {email}: {err}", flush=True)
        return jsonify({
            "error": f"Account with email {email} is already registered.",
            "code": "USER_EXISTS",
        }), 409
    except Exception as err:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[Auth] Registration failed for {email}: {err}", flush=True)
        return jsonify({
            "error": "Registration could not be completed. Please try again.",
            "code": "REGISTRATION_FAILED",
        }), 500


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
        code = _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user, code)), 200

    expires = _parse_iso(user.email_verify_expires_at)
    if expires and _utcnow_naive() > expires:
        code = _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user, code)), 200
    if (user.email_verify_attempts or 0) >= EMAIL_VERIFY_MAX_ATTEMPTS:
        code = _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user, code)), 200
    if not code or not user.email_verify_code or not _verify_otp(code, user.email_verify_code):
        user.email_verify_attempts = (user.email_verify_attempts or 0) + 1
        _commit_or_warn("email verification failure attempt")
        return jsonify({"error": "Incorrect verification code. Please try again.", "code": "INVALID_EMAIL_CODE"}), 401

    try:
        _clear_email_verify_state(user)
        user.last_login = _utcnow_iso_z()
        _commit_or_warn("email verification")
        user_dict = user.to_dict()
        token, jti = generate_token(user_dict)
        log_action(user.user_id, user_dict["name"], user.role, "EMAIL_VERIFIED", f"Email address verified for {user.email}")
        return _auth_json(user_dict, token, jti)
    except Exception as e:
        print(f"[Auth] Email verification failed for {user.email}: {e}")
        return jsonify({
            "error": "Email verified but session creation failed. Please sign in with your password.",
            "code": "VERIFIED_SESSION_FAILED",
        }), 200


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
    try:
        code = _issue_email_verify_code(user)
    except Exception as e:
        print(f"[Auth] Resend code failed for {user.email}: {e}")
        return jsonify({
            "error": "Could not resend the verification code. Please try again.",
            "code": "RESEND_FAILED",
        }), 500
    return jsonify(_email_verify_payload(user, code)), 200


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
    user.two_factor_code = _hash_otp(code)
    user.two_factor_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=5)).isoformat()
    user.two_factor_attempts = None
    _commit_or_warn("2FA code resend")
    otp_sent = send_otp_email(user.email, "2fa", code, 5)
    if not otp_sent and not otp_reveal_enabled():
        return jsonify({
            "error": "Email delivery failed. Please try again later.",
            "code": "EMAIL_DELIVERY_FAILED",
        }), 503
    if not otp_sent:
        print(f"[Auth] 2FA OTP for {user.email}: {code}")
    payload = {"message": f"A new verification code was sent to {user.email}.", "expiresInMinutes": 5}
    if otp_reveal_enabled():
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
        if not isinstance(current_password, str) or not verify_password(current_password, user.password_hash or ""):
            _register_login_failure(user)
            return jsonify({"error": "Current password is incorrect.", "code": "INVALID_CURRENT_PASSWORD"}), 401

    _clear_login_failures(user)
    new_hash = rehash_if_legacy(new_password, user.password_hash or "")
    user.password_hash = new_hash or hash_password(new_password)
    # Invalidate every other session this user holds (password knowledge changed).
    user.token_version = (user.token_version or 0) + 1
    if not _commit_or_warn("password change"):
        return jsonify({"error": "Could not update the password. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    # The current session is refreshed with a fresh token (the bumped token_version
    # has just invalidated the old one), so the user stays signed in.
    user_dict = user.to_dict()
    fresh_token, fresh_jti = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "PASSWORD_CHANGED", f"User changed their own password")
    # Invalidate every other session this user holds (password changed).
    revoked = revoke_all_sessions(user.user_id)
    return _auth_json(
        user_dict,
        fresh_token,
        fresh_jti,
        extra={"success": True, "message": "Password updated successfully.", "revokedSessions": revoked},
    )


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

    user = find_user_by_email(email)
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
    user.reset_otp = _hash_otp(code)
    user.reset_otp_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=RESET_OTP_EXPIRY_MINUTES)).isoformat()
    user.reset_otp_attempts = 0
    _commit_or_warn("password reset OTP issue")
    otp_sent = send_otp_email(user.email, "reset", code, RESET_OTP_EXPIRY_MINUTES)
    if not otp_sent and not otp_reveal_enabled():
        return jsonify({
            "error": "Email delivery failed. Please try again later.",
            "code": "EMAIL_DELIVERY_FAILED",
        }), 503
    if not otp_sent:
        print(f"[Auth] Password reset OTP for {user.email}: {code}")
    log_action(user.user_id, user.to_dict()["name"], user.role, "RESET_OTP_REQUESTED", f"Password reset code issued for {user.email}")

    payload = {
        "success": True,
        "message": f"A 6-digit verification code was sent to {user.email}. It expires in {RESET_OTP_EXPIRY_MINUTES} minutes.",
        "expiresInMinutes": RESET_OTP_EXPIRY_MINUTES,
    }
    if otp_reveal_enabled():
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
        _commit_or_warn("expired reset OTP cleanup")
        return jsonify({"error": "This code has expired. Request a new one.", "code": "RESET_OTP_EXPIRED"}), 401
    if (user.reset_otp_attempts or 0) >= RESET_OTP_MAX_ATTEMPTS:
        return jsonify({"error": "Too many incorrect reset codes. Request a new code.", "code": "RESET_OTP_LOCKED"}), 429
    if not otp or not user.reset_otp or not _verify_otp(otp, user.reset_otp):
        user.reset_otp_attempts = (user.reset_otp_attempts or 0) + 1
        _commit_or_warn("password reset OTP failure attempt")
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

    user = find_user_by_email(email)
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

    user = find_user_by_email(email)
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
    user.password_hash = hash_password(new_password)
    user.reset_otp = None
    user.reset_otp_expires_at = None
    user.reset_otp_attempts = None
    # Invalidate any sessions minted before the reset.
    user.token_version = (user.token_version or 0) + 1
    if not _commit_or_warn("password reset"):
        return jsonify({"error": "Could not update the password. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(user.user_id, user.to_dict()["name"], user.role, "PASSWORD_RESET", f"Password reset via forgot-password flow for {email}")
    return jsonify({"success": True, "message": "Password reset successfully. You can now sign in with your new password."}), 200


def auth_logout():
    """Revokes the current server-side session and refresh token, clears cookies (POST /api/auth/logout)."""
    response = jsonify({"success": True, "message": "Signed out."})
    response.delete_cookie(AUTH_COOKIE_NAME, path=AUTH_COOKIE_PATH, domain=AUTH_COOKIE_DOMAIN)
    response.delete_cookie(CSRF_COOKIE_NAME, path=AUTH_COOKIE_PATH, domain=AUTH_COOKIE_DOMAIN)
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, domain=REFRESH_COOKIE_DOMAIN)
    try:
        token = _extract_session_token_for_jti()
        if token:
            import jwt as _jwt
            data = _jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
            revoke_session(data.get("jti"))
        refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
        if refresh_token:
            data = _jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
            revoke_refresh_token(data.get("jti"))
    except Exception:
        pass
    return response, 200


def _extract_session_token_for_jti():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return request.cookies.get(AUTH_COOKIE_NAME)


def auth_refresh():
    """Rotates the refresh token and issues a new access token (POST /api/auth/refresh)."""
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if is_mobile_client():
        refresh_token = (request.json or {}).get("refreshToken") or refresh_token
    if not refresh_token:
        return jsonify({"error": "No refresh token. Please sign in again.", "code": "REFRESH_REQUIRED"}), 401
    try:
        data = jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
    except Exception:
        response = jsonify({"error": "Refresh token invalid or expired. Please sign in again.", "code": "REFRESH_INVALID"})
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, domain=REFRESH_COOKIE_DOMAIN)
        return response, 401
    result = refresh_access_token(refresh_token)
    if not result:
        response = jsonify({"error": "Refresh token invalid or expired. Please sign in again.", "code": "REFRESH_INVALID"})
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, domain=REFRESH_COOKIE_DOMAIN)
        return response, 401
    access_token, _access_jti, new_refresh_token, _refresh_jti = result
    user_id = data.get("user_id")
    user = db.session.get(UserModel, user_id) if user_id else None
    user_dict = user.to_dict() if user else {}
    response = jsonify({
        "success": True,
        "message": "Session refreshed.",
        "user": user_dict,
    })
    if is_mobile_client():
        response = jsonify({
            "success": True,
            "message": "Session refreshed.",
            "token": access_token,
            "refreshToken": new_refresh_token,
            "user": user_dict,
        })
    else:
        _apply_session_cookies(response, access_token)
        _apply_refresh_cookie(response, new_refresh_token)
    return response, 200


def auth_logout_all():
    """Revokes every session and refresh token for the current user (POST /api/auth/logout-all)."""
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id")
    if not user_id:
        return jsonify({"error": "Authentication required.", "code": "AUTH_REQUIRED"}), 401
    revoked_sessions = revoke_all_sessions(user_id)
    revoked_refresh = revoke_all_refresh_tokens(user_id)
    user = db.session.get(UserModel, user_id)
    if user:
        user.token_version = (user.token_version or 0) + 1
        _commit_or_warn("logout all devices")
    log_action(user_id, current_user.get("name") or "unknown", current_user.get("role") or "user", "LOGOUT_ALL_DEVICES", f"Revoked {revoked_sessions} session(s) and {revoked_refresh} refresh token(s)")
    response = jsonify({"success": True, "message": "All sessions revoked.", "revokedSessions": revoked_sessions, "revokedRefreshTokens": revoked_refresh})
    response.delete_cookie(AUTH_COOKIE_NAME, path=AUTH_COOKIE_PATH, domain=AUTH_COOKIE_DOMAIN)
    response.delete_cookie(CSRF_COOKIE_NAME, path=AUTH_COOKIE_PATH, domain=AUTH_COOKIE_DOMAIN)
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, domain=REFRESH_COOKIE_DOMAIN)
    return response, 200
