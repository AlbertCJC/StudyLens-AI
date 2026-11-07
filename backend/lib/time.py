"""UTC time helpers used across the backend."""

import datetime


def _utcnow_naive():
    """Naive UTC timestamp so string round-trips stay timezone-consistent."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _utcnow_iso_z():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso(value):
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None
