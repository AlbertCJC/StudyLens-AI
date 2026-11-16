"""Provision demo accounts and subjects explicitly (development only).

Usage:
    python backend/scripts/seed_dev.py

Requires SEED_DEMO_DATA=true, DEMO_TEACHER_PASSWORD and DEMO_ADMIN_PASSWORD in
backend/.env. Refuses to run when FLASK_ENV=production.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.seed import seed_database_if_empty  # noqa: E402


def main() -> int:
    result = seed_database_if_empty()
    if result.get("reason"):
        print(f"[Database Seed] Not seeded: {result['reason']}")
        return 1
    print(f"[Database Seed] Done. Created: {result.get('created', {})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
