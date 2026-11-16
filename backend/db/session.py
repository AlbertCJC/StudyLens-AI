"""Transaction helpers with transient-connection recovery."""

from extensions import db

_LAST_COMMIT_ERROR = ""


def get_last_commit_error():
    """Return the most recent commit failure summary for error mapping."""
    return _LAST_COMMIT_ERROR


def _commit_or_warn(description, restage=None):
    """Best-effort persistence: content is still returned if the DB write fails.

    Retries once with a fresh session so transient MySQL connection drops
    ("server has gone away") recover automatically instead of surfacing a
    misleading SAVE_FAILED to the user. On retry, ``restage()`` (if provided)
    re-adds the pending objects to the fresh session; without it the commit is
    attempted exactly once so a failure is reported truthfully instead of
    silently "succeeding" while persisting nothing.
    """
    global _LAST_COMMIT_ERROR
    for attempt in (1, 2):
        try:
            db.session.commit()
            _LAST_COMMIT_ERROR = ""
            return True
        except Exception as e:
            short = str(e).splitlines()[0][:180] if str(e) else e.__class__.__name__
            _LAST_COMMIT_ERROR = short
            print(f"[Database] Could not persist {description} (attempt {attempt}): {e}")
            try:
                db.session.rollback()
            except Exception:
                pass
            try:
                db.session.remove()
            except Exception:
                pass
            if attempt == 1 and restage:
                try:
                    restage()
                except Exception as re:
                    _LAST_COMMIT_ERROR = f"restage failed: {re}"
                    print(f"[Database] Could not restage {description} for retry: {re}")
                    return False
                continue
            return False
    return False
