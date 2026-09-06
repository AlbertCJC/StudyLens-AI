"""
StudyLens: normalize every user's department to "College of Computer Studies".

The backend now defaults all new accounts to "College of Computer Studies", but
existing rows may still carry legacy department strings (e.g. "Computer Science",
"Computer Science & IT", "Dean, College of Computer Studies", etc). This one-off
migration rewrites them all to the single canonical department.

IMPORTANT: back up the database before running. For MySQL:
    mysqldump -u <user> -p <dbname> > backup.sql
For SQLite, copy the .db file.

Usage:
    py scripts/migrate_departments.py --yes --dry   # preview only
    py scripts/migrate_departments.py --yes         # apply the cleanup
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

import app as app_module

app = app_module.app
db = app_module.db

CANONICAL_DEPARTMENT = "College of Computer Studies"


def _collect_counts(conn):
    """Report how many users carry each non-canonical department value."""
    rows = conn.execute(
        text(
            "SELECT COALESCE(NULLIF(TRIM(department), ''), '(empty)') AS dept, "
            "COUNT(*) AS n FROM users GROUP BY dept ORDER BY n DESC"
        )
    ).fetchall()
    return {r[0]: r[1] for r in rows}


def _apply(engine, dry_run):
    with engine.begin() as conn:
        counts = _collect_counts(conn)
        if not counts:
            print("  No user rows found.")
            return

        print("  Current department distribution (before):")
        for dept, n in counts.items():
            print(f"    {n:>4}  {dept}")

        changed = sum(n for dept, n in counts.items() if dept != CANONICAL_DEPARTMENT)
        print(f"  Rows to update: {changed} to '{CANONICAL_DEPARTMENT}'")
        if changed == 0:
            print("  Nothing to do.")
            return

        sql = "UPDATE users SET department = :dept"
        print(f"  SQL : {sql}  dept={CANONICAL_DEPARTMENT}")
        if not dry_run:
            conn.execute(
                text(sql),
                {"dept": CANONICAL_DEPARTMENT},
            )


def main() -> int:
    flags = set(sys.argv[1:])
    dry_run = "--dry" in flags
    if "--yes" not in flags:
        print("Refusing to run without confirmation.")
        print("First back up the database, then run:")
        print("    py scripts/migrate_departments.py --yes --dry   # preview")
        print("    py scripts/migrate_departments.py --yes         # apply")
        return 1

    with app.app_context():
        engine = db.engine
        if engine.url.drivername.startswith("sqlite"):
            db_label = "SQLite (studylens.db)"
        else:
            db_label = str(engine.url).replace(engine.url.password or "", "****")

        print("--------------------------------------------------------")
        print("StudyLens department normalization")
        print(f"  Database : {db_label}")
        print(f"  Mode     : {'DRY RUN (no changes)' if dry_run else 'APPLY'}")
        print("--------------------------------------------------------")

        try:
            _apply(engine, dry_run)
        except Exception as e:
            print(f"[error] Migration failed, transaction rolled back: {e}")
            return 1

        print("[done] Department normalization finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
