"""In-memory sliding-window rate limiting for auth and AI endpoints."""

import datetime
import threading
import time

from flask import jsonify, request

from lib.constants import MAX_AI_CALLS_PER_MINUTE

_RATE_WINDOW_SECONDS = 60.0
_RATE_HITS = {}
_RATE_LOCK = threading.Lock()

def _rate_limit_exceeded(key, limit):
    """True when ``key`` has already used its ``limit`` calls in the window."""
    now = time.monotonic()
    with _RATE_LOCK:
        # Opportunistic housekeeping: once the table grows, drop buckets that have
        # gone stale so a long-running server doesn't accumulate unbounded memory.
        if len(_RATE_HITS) > 2048:
            for stale_key in [
                k for k, v in _RATE_HITS.items()
                if not v or now - v[-1] > _RATE_WINDOW_SECONDS * 2
            ]:
                _RATE_HITS.pop(stale_key, None)
        hits = _RATE_HITS.setdefault(key, [])
        while hits and now - hits[0] > _RATE_WINDOW_SECONDS:
            hits.pop(0)
        if len(hits) >= limit:
            return True
        hits.append(now)
        return False


def _rate_limit_status(key, limit):
    """Returns ``(used, remaining, reset_seconds)`` for ``key`` in the current window.

    ``reset_seconds`` is how long until the oldest call ages out of the sliding
    window (i.e. the earliest a blocked caller can retry).
    """
    now = time.monotonic()
    with _RATE_LOCK:
        hits = list(_RATE_HITS.get(key, []))
        while hits and now - hits[0] > _RATE_WINDOW_SECONDS:
            hits.pop(0)
        used = len(hits)
        remaining = max(0, limit - used)
        reset_seconds = max(0.0, _RATE_WINDOW_SECONDS - (now - hits[0])) if hits else 0.0
        return used, remaining, reset_seconds


def _ai_rate_limited():
    """Returns a 429 JSON response if the caller is hammering AI generation.

    The response carries ``remaining`` calls and ``resetAtSeconds`` so the UI can tell
    the user exactly when AI generation becomes available again.
    """
    user_id = (getattr(request, "current_user", None) or {}).get("id") or request.remote_addr or "anon"
    key = f"ai:{user_id}"
    if _rate_limit_exceeded(key, MAX_AI_CALLS_PER_MINUTE):
        _, remaining, reset_seconds = _rate_limit_status(key, MAX_AI_CALLS_PER_MINUTE)
        reset_seconds = max(1, int(round(reset_seconds)))
        reset_at = (
            datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=reset_seconds)
        ).isoformat().replace("+00:00", "Z")
        return jsonify({
            "error": f"Too many AI requests. Please wait a moment and try again (limit: {MAX_AI_CALLS_PER_MINUTE} per minute).",
            "code": "RATE_LIMITED",
            "remaining": remaining,
            "resetAtSeconds": reset_seconds,
            "resetAt": reset_at,
        }), 429
    return None
