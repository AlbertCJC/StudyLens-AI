"""
StudyLens: remove the seed/demo accounts that are no longer wanted.

This is a one-off migration for an ALREADY-PROVISIONED database. The backend
seed code no longer creates these accounts (see app.py seed_database_if_empty),
but rows that were inserted before that change may still exist in the live DB.

Accounts removed:
  - usr-student-1 (student@studylens.edu, demo student)
  - usr-student-2 (vin@studylens.edu)
  - usr-student-3 (precious@studylens.edu)
  - usr-student-4 (jeric@studylens.edu)
  - usr-teacher-2 (teacher2@studylens.edu, Mary Grace Valencia)

Subject removed:
  - sub-103 (DB 204, owned by usr-teacher-2)

Kept:
  - usr-teacher-1 (teacher@studylens.edu) + sub-101, sub-102
  - usr-admin-1  (admin@studylens.edu)

Because the schema stores user/subject ids in plain non-FK string columns,
deleting a user succeeds but leaves orphaned child rows. This script deletes
those dependent rows (in child -> parent order) so the database stays clean.

IMPORTANT: back up the database before running. For MySQL:
    mysqldump -u <user> -p <dbname> > backup.sql
For SQLite, copy the .db file.

Usage:
    py scripts/remove_seed_accounts.py --yes --dry   # preview only
    py scripts/remove_seed_accounts.py --yes         # apply the cleanup
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

import app as app_module

app = app_module.app
db = app_module.db

REMOVED_USER_IDS = ["usr-student-1", "usr-student-2", "usr-student-3", "usr-student-4", "usr-teacher-2"]
REMOVED_SUBJECT_ID = "sub-103"


def _collect_ids(conn):
    """Return the full set of ids to delete: removed users plus any student
    enrolled in the removed subject."""
    ids = set(REMOVED_USER_IDS)
    rows = conn.execute(
        text("SELECT DISTINCT student_id FROM student_subjects WHERE subject_id = :sid"),
        {"sid": REMOVED_SUBJECT_ID},
    ).fetchall()
    for r in rows:
        if r[0]:
            ids.add(r[0])
    return sorted(ids)


def _apply(engine, dry_run):
    with engine.begin() as conn:
        is_mysql = engine.url.drivername.startswith("mysql")

        def run(sql, params):
            print(f"  SQL : {sql}  {params if params else ''}")
            if not dry_run:
                conn.execute(text(sql), params or {})

        ids = _collect_ids(conn)
        id_list = ids
        placeholder_ids = ",".join(f":u{i}" for i in range(len(ids)))
        id_params = {f"u{i}": uid for i, uid in enumerate(ids)}
        subj = REMOVED_SUBJECT_ID
        in_clause = f"({placeholder_ids})"

        # Disable FK checks so child-first ordering is not enforced by the DB.
        # (Non-FK columns won't raise anyway, but this is a safety net.)
        if not dry_run and is_mysql:
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))

        table_specs = [
            # (table, where-clause fragments that must ALL be run)
            ("quiz_attempts", [
                (f"student_id IN {in_clause}", id_params),
                ("subject_id = :sid", {"sid": subj}),
            ]),
            ("student_progress", [
                (f"student_id IN {in_clause}", id_params),
                ("subject_id = :sid", {"sid": subj}),
            ]),
            ("student_subjects", [
                (f"student_id IN {in_clause}", id_params),
                ("subject_id = :sid", {"sid": subj}),
            ]),
            ("notifications", [
                (f"user_id IN {in_clause}", id_params),
            ]),
            ("activity_logs", [
                (f"user_id IN {in_clause}", id_params),
            ]),
            ("audit_archive", [
                (f"user_id IN {in_clause}", id_params),
            ]),
            ("ai_generated_content", [
                (f"generated_by IN {in_clause}", id_params),
            ]),
            ("learning_materials", [
                (f"teacher_id IN {in_clause}", id_params),
                ("subject_id = :sid", {"sid": subj}),
            ]),
            ("quizzes", [
                (f"teacher_id IN {in_clause}", id_params),
                ("subject_id = :sid", {"sid": subj}),
            ]),
            ("announcements", [
                (f"teacher_id IN {in_clause}", id_params),
                ("subject_id = :sid", {"sid": subj}),
            ]),
            ("reports", [
                (f"generated_by IN {in_clause}", id_params),
                (f"target_id IN {in_clause}", id_params),
            ]),
        ]

        # quiz_questions depend on quizzes, so delete them after quizzes are gone.
        # Instead, gather quiz ids referencing the removed set before deleting.
        quiz_rows = conn.execute(
            text(
                "SELECT quiz_id FROM quizzes "
                f"WHERE teacher_id IN {in_clause} OR subject_id = :sid"
            ),
            {**id_params, "sid": subj},
        ).fetchall()
        quiz_ids = [r[0] for r in quiz_rows if r[0]]
        if quiz_ids:
            qph = ",".join(f":q{i}" for i in range(len(quiz_ids)))
            run(
                f"DELETE FROM quiz_questions WHERE quiz_id IN ({qph})",
                {f"q{i}": qid for i, qid in enumerate(quiz_ids)},
            )

        for table, clauses in table_specs:
            for clause, params in clauses:
                run(f"DELETE FROM {table} WHERE {clause}", params)

        # The subject itself (its children were deleted above).
        run("DELETE FROM subjects WHERE subject_id = :sid", {"sid": subj})

        # Now the users.
        run(f"DELETE FROM users WHERE user_id IN {in_clause}", id_params)

        if not dry_run and is_mysql:
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))

        print(f"  Deleted targets: users={ids}, subject={subj}")


def main() -> int:
    flags = set(sys.argv[1:])
    dry_run = "--dry" in flags
    if "--yes" not in flags:
        print("Refusing to run without confirmation.")
        print("First back up the database, then run:")
        print("    py scripts/remove_seed_accounts.py --yes --dry   # preview")
        print("    py scripts/remove_seed_accounts.py --yes         # apply")
        return 1

    with app.app_context():
        engine = db.engine
        if engine.url.drivername.startswith("sqlite"):
            db_label = "SQLite (studylens.db)"
        else:
            db_label = str(engine.url).replace(engine.url.password or "", "****")

        print("--------------------------------------------------------")
        print("StudyLens seed-account removal")
        print(f"  Database : {db_label}")
        print(f"  Mode     : {'DRY RUN (no changes)' if dry_run else 'APPLY'}")
        print("--------------------------------------------------------")

        try:
            _apply(engine, dry_run)
        except Exception as e:
            print(f"[error] Cleanup failed, transaction rolled back: {e}")
            return 1

        print("[done] Seed-account cleanup finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
