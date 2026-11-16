"""Application-wide constants and runtime policy helpers."""

import os

from config import IS_PRODUCTION, OTP_DEV_REVEAL

# System settings (persisted in the system_settings table).
DEFAULT_SYSTEM_SETTINGS = {
    "require2FA": "false",
    "maintenanceMode": "false",
    "sessionTimeoutMins": "60",
    "autoAuditArchiving": "true",
}

# --- Auth security policy ---
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_BASE_MINUTES = 1
LOCKOUT_MAX_MINUTES = 60
TWO_FACTOR_MAX_ATTEMPTS = 5
RESET_OTP_MAX_ATTEMPTS = 5
RESET_OTP_EXPIRY_MINUTES = 10
EMAIL_VERIFY_EXPIRY_MINUTES = 10
EMAIL_VERIFY_MAX_ATTEMPTS = 5


def otp_reveal_enabled():
    """True only in an explicit development runtime with the flag enabled.

    The flag alone is not enough: a copied .env must never disclose OTPs in a
    production deployment.
    """
    if not OTP_DEV_REVEAL or IS_PRODUCTION:
        return False
    if os.getenv("FLASK_ENV", "development").strip().lower() == "development":
        return True
    try:
        from flask import current_app

        return bool(current_app.debug)
    except Exception:
        return False

# --- AI generation caps ---
# Cap counts so single requests stay within the model's output-token budget.
# Large counts are batch-chunked across multiple AI calls (see groq_service.MAX_PER_CHUNK).
MAX_AI_QUESTIONS = 50
MAX_AI_FLASHCARDS = 50

# Sliding-window rate limit for AI generation calls (per caller, per minute).
MAX_AI_CALLS_PER_MINUTE = 15

# Titles used by automated smoke tests; purged from the announcements table at boot.
_SMOKE_ANNOUNCEMENT_TITLES = (
    "EditMe Ann",
    "EditMe v2",
    "admin override",
    "hijack",
    "AdminGuardAnn",
)
