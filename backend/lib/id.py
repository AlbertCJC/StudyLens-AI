"""Collision-resistant ID generation (P2-08).

Primary keys are no longer derived from millisecond timestamps, which collide
when two requests arrive in the same millisecond. New IDs use a UUIDv4 suffix
while keeping a human-readable prefix for debuggability.
"""

import uuid


def generate_id(prefix: str) -> str:
    """Return ``{prefix}-{uuid4}`` for a new record primary key.

    Parallel creates never collide because the suffix is a random UUIDv4.
    Existing timestamp-based IDs remain valid and readable.
    """
    return f"{prefix}-{uuid.uuid4()}"
