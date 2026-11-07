"""Generic request-value validation and parsing helpers."""

import json

from groq_service import GroqAPIError

def _validate_password_strength(password):
    """Returns an error message string if the password is weak, else None.

    Requires: 8+ characters, at least one uppercase, one lowercase, one digit,
    and one special character.
    """
    if not isinstance(password, str) or len(password) < 8:
        return "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number."
    if not any(not c.isalnum() for c in password):
        return "Password must contain at least one special character."
    return None


def _json_loads(text):
    if not text:
        return []
    try:
        return json.loads(text)
    except Exception:
        return []


def _clamp_count(raw, fallback=5, minimum=1, maximum=20):
    """Safely parses a count value from request data and clamps it to [minimum, maximum]."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = fallback
    if value < minimum:
        value = minimum
    if value > maximum:
        value = maximum
    return value


def _require_within_max(raw, maximum, label="questions"):
    """Raises a friendly COUNT_EXCEEDS_MAX error when an explicit request asks for more
    than ``maximum`` items, instead of silently truncating the request. Non-numeric or
    missing values are left to ``_clamp_count`` so defaults still apply."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return
    if value > maximum:
        raise GroqAPIError(
            "COUNT_EXCEEDS_MAX",
            f"You can generate a maximum of {maximum} {label} only. Please reduce the number and try again.",
        )


def _clamp_attempts(raw, fallback=0):
    """Safely parses a max-attempts value; 0 means unlimited, capped at 99."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = fallback
    return max(0, min(99, value))


def _reveal_answers(raw, fallback=True):
    """Safely parses the reveal-answers flag; default True (answers visible)."""
    if raw is None:
        return fallback
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ("1", "true", "yes", "on")
