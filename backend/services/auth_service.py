"""Authentication, lockout, email-verification and JWT issuance logic."""

import datetime
import secrets

import jwt

from config import SECRET_KEY
from db.session import _commit_or_warn
from email_service import send_otp_email
from extensions import db
from lib.constants import (
    EMAIL_VERIFY_EXPIRY_MINUTES,
    MAX_LOGIN_ATTEMPTS,
    OTP_DEV_REVEAL,
)
from lib.time import _parse_iso, _utcnow_naive
from models import UserModel
from services.settings_service import _load_system_settings

def generate_token(user_data):
    settings = _load_system_settings()
    try:
        timeout_mins = max(5, min(1440, int(settings.get("sessionTimeoutMins") or 60)))
    except Exception:
        timeout_mins = 60
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "token_version": user_data.get("tokenVersion") or 0,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=timeout_mins)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def _generate_otp():
    return f"{secrets.randbelow(1000000):06d}"


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
    db.session.commit()


def _issue_email_verify_code(user):
    """Issues (or refreshes) a 6-digit email-verification code for an account."""
    code = _generate_otp()
    user.email_verify_code = code
    user.email_verify_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=EMAIL_VERIFY_EXPIRY_MINUTES)).isoformat()
    user.email_verify_attempts = 0
    db.session.commit()
    if not send_otp_email(user.email, "verify", code, EMAIL_VERIFY_EXPIRY_MINUTES) and OTP_DEV_REVEAL:
        print(f"[Auth] Email verification OTP for {user.email}: {code}")
    return code


def _user_is_email_verified(user):
    return bool(user.email_verified)


def _email_verify_payload(user):
    """Response body for an unverified account awaiting an email code."""
    payload = {
        "requiresEmailVerification": True,
        "userId": user.user_id,
        "email": user.email,
        "expiresInMinutes": EMAIL_VERIFY_EXPIRY_MINUTES,
    }
    if OTP_DEV_REVEAL and user.email_verify_code:
        payload["devCode"] = user.email_verify_code
    return payload


def _clear_email_verify_state(user):
    user.email_verified = 1
    user.email_verify_code = None
    user.email_verify_expires_at = None
    user.email_verify_attempts = None
