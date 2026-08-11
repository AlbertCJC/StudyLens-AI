"""
StudyLens database reset / repair tool.

Rebuilds the database schema to match the current SQLAlchemy models and
re-seeds the UC CCS capstone demo data.

DANGER: this DROPS all tables in the configured database (MySQL or SQLite)
and replaces them with a fresh 14-table schema. It is intended for local
development/demo databases only.

Usage:
    py scripts/reset_db.py --yes          # drop, create, seed
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
            print("[reset] Seeding capstone demo data...")
            app_module.seed_database_if_empty()

    print("[reset] Done. Restart the Flask backend with: py app.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())