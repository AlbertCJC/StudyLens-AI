"""
StudyLens database reset / repair tool.

Rebuilds the database schema to match the current SQLAlchemy models. Demo data
is only re-seeded when SEED_DEMO_DATA=true and the demo passwords are set.

DANGER: this DROPS all tables in the configured database (MySQL or SQLite)
and replaces them with a fresh 14-table schema. It is intended for local
development/demo databases only.

Usage:
    py scripts/reset_db.py --yes            # drop + create (seed if enabled)
    py scripts/reset_db.py --yes --no-seed  # drop + create only
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

import app as app_module

app = app_module.app
db = app_module.db


def main() -> int:
    flags = set(sys.argv[1:])
    if "--yes" not in flags:
        print("Refusing to reset without confirmation.")
        print(f"Run: py scripts/reset_db.py --yes")
        return 1

    with app.app_context():
        engine = db.engine
        if engine.url.drivername.startswith("sqlite"):
            db_label = "SQLite (studylens.db)"
        else:
            db_label = str(engine.url).replace(engine.url.password or "", "****")
        tables = db.inspect(engine).get_table_names()

    print("--------------------------------------------------------")
    print("StudyLens database reset")
    print(f"  Database : {db_label}")
    print(f"  Tables   : {len(tables)} existing -> 14-table current schema (DROPPED & RECREATED)")
    if tables:
        print(f"  Dropping : {', '.join(sorted(tables))}")
    print("--------------------------------------------------------")

    with app.app_context():
        print("[reset] Dropping all tables...")
        if db.engine.url.drivername.startswith("mysql"):
            # Legacy tables may carry FK constraints unknown to the current metadata,
            # so drop with foreign key checks disabled.
            with db.engine.begin() as conn:
                conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
                for table in db.inspect(db.engine).get_table_names():
                    conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
                conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        else:
            db.drop_all()

        print("[reset] Creating schema from models...")
        db.create_all()

        if "--no-seed" not in flags:
            print("[reset] Demo seeding is opt-in; attempting explicit seed...")
            from db.seed import seed_database_if_empty

            result = seed_database_if_empty()
            if result.get("reason"):
                print(f"[reset] Demo seed skipped: {result['reason']}")
                print("[reset] Set SEED_DEMO_DATA=true and both demo passwords to seed.")

    print("[reset] Done. Restart the Flask backend with: py app.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
