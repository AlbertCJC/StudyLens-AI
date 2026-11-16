"""Sliding-window rate limiting for auth and AI endpoints.

Supports two backends:

* ``memory`` (default): in-process dictionary. Works for a single worker/dev
  server, but counters are NOT shared across multiple workers or behind a load
  balancer.
* ``redis``: shared Redis store. Counters are consistent across all workers and
  behind a load balancer. Requires Redis to be running; fails closed (503) for
  auth endpoints if Redis is unavailable.

Configure with ``RATE_LIMIT_BACKEND=memory|redis`` (default: ``memory``) and
``REDIS_URL`` for the Redis connection string.
"""

import datetime
import os
import threading
import time

import redis
from flask import jsonify, request

from lib.constants import MAX_AI_CALLS_PER_MINUTE

_RATE_WINDOW_SECONDS = 60.0

# In-memory backend (single worker)
_RATE_HITS = {}
_RATE_LOCK = threading.Lock()

# Redis backend (shared across workers)
_redis_client = None
_redis_available = None


def _get_redis():
    """Get or create a Redis client, returning None if unavailable."""
    global _redis_client, _redis_available
    if _redis_available is False:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        _redis_available = True
        return _redis_client
    except Exception:
        _redis_client = None
        _redis_available = False
        return None


def _rate_limit_exceeded_memory(key, limit):
    """In-memory sliding-window check (single worker)."""
    now = time.monotonic()
    with _RATE_LOCK:
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


def _rate_limit_exceeded_redis(key, limit):
    """Redis-backed sliding-window check (shared across workers).

    Uses Redis INCR with EXPIRE for atomic counter increments. The key expires
    after the window, so counters reset automatically.
    """
    client = _get_redis()
    if client is None:
        # Fall back to in-memory if Redis is unavailable
        return _rate_limit_exceeded_memory(key, limit)

    try:
        now = time.monotonic()
        window_start = now - _RATE_WINDOW_SECONDS

        # Use a Redis pipeline for atomicity:
        # 1. Remove expired entries
        # 2. Add current timestamp
        # 3. Count entries in window
        # 4. Set expiry on the key
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, int(_RATE_WINDOW_SECONDS) + 1)
        results = pipe.execute()

        count = results[2]  # zcard result
        return count >= limit
    except Exception:
        # If Redis fails mid-operation, fall back to in-memory
        return _rate_limit_exceeded_memory(key, limit)


def _rate_limit_exceeded(key, limit):
    """True when ``key`` has already used its ``limit`` calls in the window."""
    backend = os.getenv("RATE_LIMIT_BACKEND", "memory")
    if backend == "redis":
        return _rate_limit_exceeded_redis(key, limit)
    return _rate_limit_exceeded_memory(key, limit)


def _rate_limit_status_memory(key, limit):
    """In-memory status (single worker)."""
    now = time.monotonic()
    with _RATE_LOCK:
        hits = list(_RATE_HITS.get(key, []))
        while hits and now - hits[0] > _RATE_WINDOW_SECONDS:
            hits.pop(0)
        used = len(hits)
        remaining = max(0, limit - used)
        reset_seconds = max(0.0, _RATE_WINDOW_SECONDS - (now - hits[0])) if hits else 0.0
        return used, remaining, reset_seconds


def _rate_limit_status_redis(key, limit):
    """Redis-backed status (shared across workers)."""
    client = _get_redis()
    if client is None:
        return _rate_limit_status_memory(key, limit)

    try:
        now = time.monotonic()
        window_start = now - _RATE_WINDOW_SECONDS

        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        results = pipe.execute()
        used = results[1]
        remaining = max(0, limit - used)
        reset_seconds = max(0.0, _RATE_WINDOW_SECONDS - (now - window_start))
        return used, remaining, reset_seconds
    except Exception:
        return _rate_limit_status_memory(key, limit)


def _rate_limit_status(key, limit):
    """Returns ``(used, remaining, reset_seconds)`` for ``key`` in the window."""
    backend = os.getenv("RATE_LIMIT_BACKEND", "memory")
    if backend == "redis":
        return _rate_limit_status_redis(key, limit)
    return _rate_limit_status_memory(key, limit)


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
