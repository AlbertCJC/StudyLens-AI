"""Pagination helpers for list endpoints (P2-01).

Provides a consistent, bounded pagination pattern so no list endpoint returns an
unbounded result set. When ``limit``/``offset`` are absent the helper returns
the full legacy result so existing clients keep working; when present it returns
an ``{items, total, limit, offset, hasMore}`` envelope.
"""

from sqlalchemy.orm import Query


def paginate_query(query: Query, limit: int | None, offset: int | None):
    """Apply bounded limit/offset to a SQLAlchemy query.

    Returns ``(items, total, limit, offset, has_more)``. ``limit`` is clamped to
    [1, 200]. When ``limit`` is None the full legacy result is returned with
    ``limit``/``offset`` set to None and ``has_more`` False.
    """
    total = query.count()
    if limit is None:
        items = query.all()
        return items, total, None, None, False
    limit = max(1, min(200, int(limit)))
    offset = max(0, int(offset or 0))
    items = query.offset(offset).limit(limit).all()
    has_more = (offset + len(items)) < total
    return items, total, limit, offset, has_more


def pagination_envelope(items, total, limit, offset, has_more):
    """Build the standard paginated response body."""
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": has_more,
    }
