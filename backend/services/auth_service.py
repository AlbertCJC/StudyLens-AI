"""Authentication, lockout, email-verification and JWT issuance logic."""

import datetime
import hashlib
import hmac
import secrets
import uuid

import jwt

from config import OTP_PEPPER, SECRET_KEY
from db.session import _commit_or_warn
from email_service import send_otp_email
from extensions import db
from lib.constants import (
    EMAIL_VERIFY_EXPIRY_MINUTES,
    LOCKOUT_BASE_MINUTES,
    LOCKOUT_MAX_MINUTES,
    MAX_LOGIN_ATTEMPTS,
    otp_reveal_enabled,
)
from lib.time import _parse_iso, _utcnow_naive
from models import UserModel
from models.auth_session import AuthSessionModel
from models.refresh_token import RefreshTokenModel
from services.settings_service import _load_system_settings


def _utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_email(value):
    """Canonical form used for comparisons: whitespace-trimmed and lowercased."""
    return str(value or "").strip().lower()


def find_user_by_email(email):
    """Find a user by normalized email, tolerating legacy padded values.

    Some imported/legacy rows contain trailing whitespace (for example a
    newline pasted into an admin form). A plain equality query would hide those
    accounts, so the fallback compares normalized values in Python.
    """
    normalized = normalize_email(email)
    if not normalized:
        return None
    user = UserModel.query.filter(db.func.lower(UserModel.email) == normalized).first()
    if user:
        return user
    for candidate in UserModel.query.all():
        if normalize_email(candidate.email) == normalized:
            return candidate
    return None


def session_timeout_minutes():
    """Configured access/session lifetime in minutes (clamped to a sane range)."""
    settings = _load_system_settings()
    try:
        return max(5, min(1440, int(settings.get("sessionTimeoutMins") or 15)))
    except Exception:
        return 15


def generate_token(user_data):
    """Issue an access token and register it as an active auth session.

    Returns ``(token, jti)``. The ``jti`` is stored in ``auth_sessions`` so the
    token can be revoked server-side (logout, password change, suspension).
    """
    timeout_mins = session_timeout_minutes()
    now = datetime.datetime.now(datetime.timezone.utc)
    jti = str(uuid.uuid4())
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "token_version": user_data.get("tokenVersion") or 0,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(minutes=timeout_mins)).timestamp()),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    try:
        record_session(user_data["id"], jti)
    except Exception as e:
        print(f"[Auth] Session record failed for user {user_data.get('id')}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
    return token, jti


def record_session(user_id, jti, user_agent=None, ip_address=None):
    """Register a freshly issued token as an active auth session."""
    try:
        session = AuthSessionModel(
            session_id=jti,
            user_id=user_id,
            created_at=_utcnow_iso(),
            last_seen_at=_utcnow_iso(),
            revoked_at=None,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.session.add(session)
        _commit_or_warn("auth service persistence")
    except Exception as e:
        print(f"[Auth] Session record failed for user {user_id}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


def revoke_session(jti):
    """Mark a single auth session as revoked."""
    try:
        session = db.session.get(AuthSessionModel, jti)
        if session and session.revoked_at is None:
            session.revoked_at = _utcnow_iso()
            _commit_or_warn("auth service persistence")
            return True
    except Exception as e:
        print(f"[Auth] Session revoke failed for jti {jti}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
    return False


def revoke_all_sessions(user_id):
    """Revoke every active session for a user (logout all devices)."""
    try:
        now = _utcnow_iso()
        rows = db.session.query(AuthSessionModel).filter_by(user_id=user_id).all()
        for row in rows:
            if row.revoked_at is None:
                row.revoked_at = now
        _commit_or_warn("auth service persistence")
        return len(rows)
    except Exception as e:
        print(f"[Auth] Revoke-all failed for user {user_id}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
    return 0


# ---------------------------------------------------------------------------
# Refresh tokens (rotation-based revocation, P1-01)
# ---------------------------------------------------------------------------

REFRESH_TOKEN_DAYS = 30


def generate_refresh_token(user_data):
    """Issue a refresh token.

    Returns ``(refresh_token, jti)``. The ``jti`` is stored in
    ``refresh_tokens`` so it can be rotated server-side.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    jti = str(uuid.uuid4())
    expires = now + datetime.timedelta(days=REFRESH_TOKEN_DAYS)
    payload = {
        "user_id": user_data["id"],
        "jti": jti,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    refresh_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    try:
        record_refresh_token(user_data["id"], jti, expires.isoformat().replace("+00:00", "Z"))
    except Exception as e:
        print(f"[Auth] Refresh token record failed for user {user_data.get('id')}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
    return refresh_token, jti


def record_refresh_token(user_id, jti, expires_at, user_agent=None, ip_address=None):
    """Register a refresh token as active."""
    try:
        row = RefreshTokenModel(
            jti=jti,
            user_id=user_id,
            created_at=_utcnow_iso(),
            expires_at=expires_at,
            revoked_at=None,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.session.add(row)
        _commit_or_warn("auth service persistence")
    except Exception as e:
        print(f"[Auth] Refresh token record failed for user {user_id}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


def revoke_refresh_token(jti):
    """Revoke a single refresh token."""
    try:
        row = db.session.get(RefreshTokenModel, jti)
        if row and row.revoked_at is None:
            row.revoked_at = _utcnow_iso()
            _commit_or_warn("auth service persistence")
            return True
    except Exception as e:
        print(f"[Auth] Refresh revoke failed for jti {jti}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
    return False


def revoke_all_refresh_tokens(user_id):
    """Revoke every refresh token for a user."""
    try:
        now = _utcnow_iso()
        rows = db.session.query(RefreshTokenModel).filter_by(user_id=user_id).all()
        for row in rows:
            if row.revoked_at is None:
                row.revoked_at = now
        _commit_or_warn("auth service persistence")
        return len(rows)
    except Exception as e:
        print(f"[Auth] Refresh revoke-all failed for user {user_id}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
    return 0


def refresh_access_token(refresh_token_str):
    """Rotate a refresh token and issue a new access token.

    Returns ``(access_token, access_jti, refresh_token, refresh_jti)`` on
    success, or ``None`` when the refresh token is invalid/expired/revoked.

    Reuse of a revoked refresh token revokes the entire family (all sessions and
    refresh tokens for the user).
    """
    try:
        data = jwt.decode(refresh_token_str, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None
    if data.get("type") != "refresh":
        return None
    jti = data.get("jti")
    user_id = data.get("user_id")
    if not jti or not user_id:
        return None

    row = db.session.get(RefreshTokenModel, jti)
    if not row or row.revoked_at is not None:
        # Refresh-token reuse detected: revoke the whole family.
        try:
            revoke_all_sessions(user_id)
            revoke_all_refresh_tokens(user_id)
        except Exception:
            pass
        return None
    try:
        expires = _parse_iso(row.expires_at)
        if expires and _utcnow_naive() > expires:
            revoke_refresh_token(jti)
            return None
    except Exception:
        pass

    # Rotate: revoke the old refresh jti, mint a new one.
    revoke_refresh_token(jti)

    user = db.session.get(UserModel, user_id)
    if not user or user.status != "active":
        return None

    user_data = {
        "id": user.user_id,
        "email": user.email,
        "role": user.role,
        "tokenVersion": user.token_version or 0,
    }
    access_token, access_jti = generate_token(user_data)
    refresh_token, refresh_jti = generate_refresh_token(user_data)

    try:
        record_session(user_id, access_jti, row.user_agent, row.ip_address)
    except Exception:
        pass

    return access_token, access_jti, refresh_token, refresh_jti

def _generate_otp():
    return f"{secrets.randbelow(1000000):06d}"


def _hash_otp(code):
    """HMAC-SHA256 of a one-time code using the OTP pepper.

    OTPs are never stored plaintext; only the hash is persisted.
    """
    return hmac.new(OTP_PEPPER.encode(), str(code).encode(), hashlib.sha256).hexdigest()


def _verify_otp(code, stored):
    """Constant-time verify a one-time code against its stored hash.

    Backward-compatible: if the stored value is not a hex digest (legacy
    plaintext), compares directly so existing codes still verify once.
    """
    if not stored:
        return False
    try:
        bytes.fromhex(stored)
        is_hash = len(stored) == 64
    except ValueError:
        is_hash = False
    if is_hash:
        return secrets.compare_digest(_hash_otp(code), stored)
    return secrets.compare_digest(str(stored), str(code))


def _lock_minutes_remaining(user):
    """Remaining lockout minutes for a locked account, or 0 when not locked.

    Returns a float so the account unlocks the instant locked_until passes;
    callers round up only for a user-facing message.
    """
    locked = _parse_iso(user.locked_until)
    if not locked:
        return 0
    return max(0.0, (locked - _utcnow_naive()).total_seconds() / 60)


def _is_account_locked(user):
    return _lock_minutes_remaining(user) > 0


def _escalated_lockout_minutes(lock_count):
    """Escalating lockout: 1, 2, 4, 8, ... minutes, capped at LOCKOUT_MAX_MINUTES."""
    minutes = LOCKOUT_BASE_MINUTES * (2 ** max(0, (lock_count or 0) - 1))
    return min(minutes, LOCKOUT_MAX_MINUTES)


def _clear_login_failures(user):
    user.failed_login_attempts = None
    user.two_factor_attempts = None
    user.locked_until = None
    user.lockout_count = None


def _apply_lockout(user):
    """Locks the account with an escalating duration and refreshes its counter."""
    lock_count = (user.lockout_count or 0) + 1
    user.lockout_count = lock_count
    minutes = _escalated_lockout_minutes(lock_count)
    user.locked_until = (_utcnow_naive() + datetime.timedelta(minutes=minutes)).isoformat()
    return minutes


def _register_login_failure(user):
    """Increments the failure counter and locks the account once it hits the cap.

    While the account is already locked, failed attempts are ignored so the
    lockout timer is not extended by repeated guessing.
    """
    if _is_account_locked(user):
        return
    attempts = (user.failed_login_attempts or 0) + 1
    user.failed_login_attempts = attempts
    user.two_factor_attempts = None
    if attempts >= MAX_LOGIN_ATTEMPTS:
        _apply_lockout(user)
    _commit_or_warn("auth service persistence")


def _issue_email_verify_code(user):
    """Issues (or refreshes) a 6-digit email-verification code for an account."""
    code = _generate_otp()
    user.email_verify_code = _hash_otp(code)
    user.email_verify_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=EMAIL_VERIFY_EXPIRY_MINUTES)).isoformat()
    user.email_verify_attempts = 0
    try:
        _commit_or_warn("auth service persistence")
    except Exception as e:
        print(f"[Auth] Could not persist email verify code for {user.email}: {e}")
    if not send_otp_email(user.email, "verify", code, EMAIL_VERIFY_EXPIRY_MINUTES) and otp_reveal_enabled():
        print(f"[Auth] Email verification OTP for {user.email}: {code}")
    return code


def _user_is_email_verified(user):
    return bool(user.email_verified)


def _email_verify_payload(user, code=None):
    """Response body for an unverified account awaiting an email code."""
    payload = {
        "requiresEmailVerification": True,
        "userId": user.user_id,
        "email": user.email,
        "expiresInMinutes": EMAIL_VERIFY_EXPIRY_MINUTES,
    }
    if otp_reveal_enabled() and code:
        payload["devCode"] = code
    return payload


def _clear_email_verify_state(user):
    user.email_verified = 1
    user.email_verify_code = None
    user.email_verify_expires_at = None
    user.email_verify_attempts = None
