"""Password hashing with Argon2id (P3-07).

New passwords are hashed with Argon2id. Legacy Werkzeug (PBKDF2-SHA256) hashes
are verified with the old method and transparently rehashed with Argon2 on
successful login.

Argon2 encoded hash format includes the algorithm identifier, so no separate
algorithm column is needed.
"""

from argon2 import PasswordHasher
from werkzeug.security import check_password_hash as _werkzeug_check
from werkzeug.security import generate_password_hash as _werkzeug_generate


# Argon2id parameters tuned for 2026-era hardware.
# time_cost: number of iterations (3 is the Argon2id recommended minimum)
# memory_cost: memory in KiB (64 MiB = 65536 KiB)
# parallelism: number of parallel lanes (4)
_ARGON2_TIME_COST = 3
_ARGON2_MEMORY_COST = 65536
_ARGON2_PARALLELISM = 4


def _hasher() -> PasswordHasher:
    """Create an Argon2id password hasher with configured parameters."""
    return PasswordHasher(
        time_cost=_ARGON2_TIME_COST,
        memory_cost=_ARGON2_MEMORY_COST,
        parallelism=_ARGON2_PARALLELISM,
        hash_len=32,
        salt_len=16,
    )


def hash_password(password: str) -> str:
    """Hash a password with Argon2id.

    Returns the encoded hash string (includes algorithm, parameters, salt, and
    hash). Can be stored directly in the password_hash column.
    """
    return _hasher().hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash.

    Supports both Argon2id (new) and Werkzeug PBKDF2-SHA256 (legacy) hashes.
    If the stored hash is a legacy Werkzeug hash, returns True if the password
    matches, but does NOT rehash (rehashing happens at the caller level via
    ``rehash_if_legacy``).

    Returns True if the password matches, False otherwise.
    """
    if not stored_hash:
        return False

    # Argon2 encoded hashes start with "$argon2id$"
    if stored_hash.startswith("$argon2id$"):
        try:
            _hasher().verify(stored_hash, password)
            return True
        except Exception:
            return False

    # Legacy Werkzeug (PBKDF2-SHA256) hash - verify but don't rehash here.
    # Callers should call rehash_if_legacy() on successful verification.
    try:
        return _werkzeug_check(stored_hash, password)
    except Exception:
        return False


def rehash_if_legacy(password: str, stored_hash: str) -> str | None:
    """If ``stored_hash`` is a legacy Werkzeug hash, rehash the password with
    Argon2id and return the new hash string.

    Returns None if ``stored_hash`` is already an Argon2 hash or is invalid.
    """
    if stored_hash and stored_hash.startswith("$argon2id$"):
        return None  # Already Argon2, no rehash needed
    if stored_hash and _werkzeug_check(stored_hash, password):
        return hash_password(password)
    return None
