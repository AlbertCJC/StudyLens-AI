"""
StudyLens: remove mirrored flashcard materials created by teachers/students.

Flashcards previously mirrored into the Upload & Manage Materials library for
teachers and students. The backend now stops that mirroring (teacher/student
flashcards live only in the Flashcards feature), but already-mirrored rows may
still exist in the live DB. This one-off migration removes them.

Rows removed: learning_materials where file_type = 'ai-flashcards' AND owned by
a teacher/student (uploader_role IN ('teacher','student')). Admin-mirrored
flashcards are KEPT, because admins have no Flashcards feature and their cards
live in the materials library.

IMPORTANT: back up the database before running. For MySQL:
    mysqldump -u <user> -p <dbname> > backup.sql
For SQLite, copy the .db file.

Usage:
    py scripts/remove_mirrored_flashcards.py --yes --dry   # preview only
    py scripts/remove_mirrored_flashcards.py --yes         # apply the cleanup
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

import app as app_module

app = app_module.app
db = app_module.db

OWNED_ROLES = ("teacher", "student")


def _apply(engine, dry_run):
    with engine.begin() as conn:
        is_mysql = engine.url.drivername.startswith("mysql")
        role_list = ",".join(f":r{i}" for i in range(len(OWNED_ROLES)))
        role_params = {f"r{i}": r for i, r in enumerate(OWNED_ROLES)}

        rows = conn.execute(
            text(
                "SELECT material_id, title FROM learning_materials "
                f"WHERE file_type = 'ai-flashcards' AND uploader_role IN ({role_list})"
            ),
            role_params,
        ).fetchall()

        if not rows:
            print("  No teacher/student-mirrored flashcard materials found.")
            return

        print(f"  Mirror rows to remove: {len(rows)}")
        for r in rows[:20]:
            print(f"    {r[0]}  {r[1]}")
        if len(rows) > 20:
            print(f"    ... and {len(rows) - 20} more")

        sql = (
            "DELETE FROM learning_materials "
            f"WHERE file_type = 'ai-flashcards' AND uploader_role IN ({role_list})"
        )
        print(f"  SQL : {sql}  roles={OWNED_ROLES}")
        if not dry_run:
            if is_mysql:
                conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
            conn.execute(text(sql), role_params)
            if is_mysql:
                conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))


def main() -> int:
    flags = set(sys.argv[1:])
    dry_run = "--dry" in flags
    if "--yes" not in flags:
        print("Refusing to run without confirmation.")
        print("First back up the database, then run:")
        print("    py scripts/remove_mirrored_flashcards.py --yes --dry   # preview")
        print("    py scripts/remove_mirrored_flashcards.py --yes         # apply")
        return 1

    with app.app_context():
        engine = db.engine
        if engine.url.drivername.startswith("sqlite"):
            db_label = "SQLite (studylens.db)"
        else:
            db_label = str(engine.url).replace(engine.url.password or "", "****")

        print("--------------------------------------------------------")
        print("StudyLens mirrored-flashcard removal")
        print(f"  Database : {db_label}")
        print(f"  Mode     : {'DRY RUN (no changes)' if dry_run else 'APPLY'}")
        print("--------------------------------------------------------")

        try:
            _apply(engine, dry_run)
        except Exception as e:
            print(f"[error] Cleanup failed, transaction rolled back: {e}")
            return 1

        print("[done] Mirrored-flashcard cleanup finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
