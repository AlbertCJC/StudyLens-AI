"""Application-wide constants that are not environment dependent."""

import os

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
OTP_DEV_REVEAL = os.getenv("OTP_DEV_REVEAL", "").strip().lower() in ("1", "true", "yes", "on")

# --- AI generation caps ---
# Cap counts so single requests stay within the model's output-token budget.
# Large counts are batch-chunked across multiple AI calls (see groq_service.MAX_PER_CHUNK).
MAX_AI_QUESTIONS = 100
MAX_AI_FLASHCARDS = 100

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
