"""Baseline migration marking the current schema state.

This revision establishes the Alembic version table at the current schema
state. All tables and columns already exist in the database (created by
db.create_all() at startup). Future schema changes will be managed through
Alembic migrations.

Revision ID: a67fbf3f89df
Revises: None
Create Date: 2026-11-11 07:03:20.331811
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a67fbf3f89df"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No schema changes needed - baseline matches current database state."""
    pass


def downgrade() -> None:
    """Cannot downgrade past the baseline."""
    pass
