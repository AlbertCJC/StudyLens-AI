"""ERD alignment for the live database (Scope A).

Brings the live schema's referential integrity up to the manuscript ERD:

  1. Reparents rows referencing deleted users/generators to seed accounts (content preserved).
  2. Nullifies learning_materials.subject_id sentinels ('personal' / '').
  3. Deletes rows whose parent genuinely no longer exists (dead-quiz questions/attempts,
     phantom student enrollments, phantom-user notifications).
  4. Adds FK column indexes + FK constraints for all ERD relationships.
  5. Drops the 4 legacy empty tables absent from the models.

Usage:
    python scripts/align_database.py          # preview — print every planned change, make none
    python scripts/align_database.py --apply  # execute (snapshots written first)

Idempotent: re-running after success reports 0 pending changes.
"""
import json
import os
import sys
from datetime import datetime

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app, db  # noqa: E402

APPLY = "--apply" in sys.argv
DB_NAME = "studylens_db"

REPARENT = [
    ("subjects", "teacher_id", "usr-teacher-1"),
    ("quizzes", "teacher_id", "usr-teacher-1"),
    ("learning_materials", "teacher_id", "usr-teacher-1"),
    ("ai_generated_content", "generated_by", "usr-admin-1"),
    ("activity_logs", "user_id", "usr-admin-1"),
]

DELETES = [
    ("quiz_questions", "DELETE FROM quiz_questions WHERE quiz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.quiz_id = quiz_questions.quiz_id)"),
    ("quiz_attempts", "DELETE FROM quiz_attempts WHERE quiz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.quiz_id = quiz_attempts.quiz_id)"),
    ("quiz_attempts", "DELETE FROM quiz_attempts WHERE student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = quiz_attempts.student_id)"),
    ("student_subjects", "DELETE FROM student_subjects WHERE student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = student_subjects.student_id)"),
    ("notifications", "DELETE FROM notifications WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = notifications.user_id)"),
]

NULL_SENTINELS = "UPDATE learning_materials SET subject_id = NULL WHERE subject_id IN ('personal', '')"

FKS = [
    ("student_subjects", "student_id", "users", "user_id", "CASCADE"),
    ("student_subjects", "subject_id", "subjects", "subject_id", "CASCADE"),
    ("learning_materials", "subject_id", "subjects", "subject_id", "SET NULL"),
    ("learning_materials", "teacher_id", "users", "user_id", "RESTRICT"),
    ("ai_generated_content", "material_id", "learning_materials", "material_id", "SET NULL"),
    ("ai_generated_content", "generated_by", "users", "user_id", "RESTRICT"),
    ("quizzes", "material_id", "learning_materials", "material_id", "SET NULL"),
    ("quizzes", "teacher_id", "users", "user_id", "RESTRICT"),
    ("quiz_questions", "quiz_id", "quizzes", "quiz_id", "CASCADE"),
    ("quiz_attempts", "quiz_id", "quizzes", "quiz_id", "CASCADE"),
    ("quiz_attempts", "student_id", "users", "user_id", "CASCADE"),
    ("student_progress", "student_id", "users", "user_id", "CASCADE"),
    ("student_progress", "subject_id", "subjects", "subject_id", "CASCADE"),
    ("notifications", "user_id", "users", "user_id", "CASCADE"),
    ("announcements", "teacher_id", "users", "user_id", "SET NULL"),
    ("announcements", "subject_id", "subjects", "subject_id", "CASCADE"),
    ("reports", "generated_by", "users", "user_id", "CASCADE"),
    ("activity_logs", "user_id", "users", "user_id", "CASCADE"),
]

LEGACY_TABLES = ["flashcard_decks", "reviewers", "summaries", "announcement_reads"]


def one(conn, sql, **params):
    return conn.execute(text(sql), params).scalar() or 0


def reparent_count_sql(table, col):
    return (f"SELECT COUNT(*) FROM {table} t WHERE t.{col} IS NOT NULL AND "
            f"NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = t.{col})")


def delete_where(stmt):
    return stmt.split("WHERE", 1)[1] if "WHERE" in stmt else "1=0"


def build_plan():
    with db.engine.connect() as conn:
        plan = []
        for table, col, target in REPARENT:
            plan.append((f"reparent {table}.{col} -> {target}", one(conn, reparent_count_sql(table, col))))
        plan.append(("set NULL learning_materials.subject_id sentinels",
                     one(conn, "SELECT COUNT(*) FROM learning_materials WHERE subject_id IN ('personal','')")))
        for table, stmt in DELETES:
            plan.append((f"delete orphans {table}",
                         one(conn, f"SELECT COUNT(*) FROM {table} WHERE {delete_where(stmt)}")))
    return plan


def snapshot():
    snap = {}
    with db.engine.connect() as conn:
        for table, col, _target in REPARENT:
            snap[f"reparent_{table}.{col}"] = one(conn, reparent_count_sql(table, col))
        snap["nullified_learning_materials.subject_id"] = one(
            conn, "SELECT COUNT(*) FROM learning_materials WHERE subject_id IN ('personal','')")
        for table, stmt in DELETES:
            key = f"delete_{table}"
            snap[key] = snap.get(key, 0) + one(conn, f"SELECT COUNT(*) FROM {table} WHERE {delete_where(stmt)}")
    return snap


def dump_snapshot(snap):
    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup_erp_align_snapshots")
    os.makedirs(backup_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(backup_dir, f"snapshot_{stamp}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(snap, f, indent=2)
    print(f"[ok] snapshot: {path}")


def mutate():
    with db.engine.connect() as conn:
        with conn.begin():
            conn.execute(text("ALTER TABLE learning_materials MODIFY subject_id VARCHAR(64) NULL"))
            for table, col, target in REPARENT:
                n = conn.execute(text(
                    f"UPDATE {table} SET {col} = :t WHERE {table}.{col} IS NOT NULL AND "
                    f"NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = {table}.{col})"),
                    {"t": target}).rowcount
                print(f"[ok] reparent       {table}.{col} -> {target} ({n})")
            n = conn.execute(text(NULL_SENTINELS)).rowcount
            print(f"[ok] set NULL       learning_materials.subject_id sentinels ({n})")
            for table, stmt in DELETES:
                n = conn.execute(text(stmt)).rowcount
                print(f"[ok] delete orphans {table} ({n})")


def build_alter(fk):
    table, col, ref_table, ref_col, on_delete = fk
    return (f"ALTER TABLE {table} ADD CONSTRAINT fk_{table}_{col} FOREIGN KEY ({col}) "
            f"REFERENCES {ref_table} ({ref_col}) ON DELETE {on_delete}")


def ensure_constraints():
    added = 0
    with db.engine.connect() as conn:
        with conn.begin():
            for fk in FKS:
                table, col, ref_table, ref_col, on_delete = fk
                exists = one(conn,
                             "SELECT COUNT(*) FROM information_schema.key_column_usage "
                             "WHERE constraint_schema = :db AND table_name = :t "
                             "AND column_name = :c AND referenced_table_name IS NOT NULL",
                             db=DB_NAME, t=table, c=col)
                if exists:
                    print(f"[skip] FK present   {table}.{col}")
                    continue

                if table == "learning_materials" and col == "subject_id":
                    nullable = one(conn,
                                   "SELECT COUNT(*) FROM information_schema.columns "
                                   "WHERE table_schema = :db AND table_name = :t "
                                   "AND column_name = :c AND is_nullable = 'YES'",
                                   db=DB_NAME, t=table, c=col)
                    if not nullable:
                        conn.execute(text("ALTER TABLE learning_materials MODIFY subject_id VARCHAR(64) NULL"))

                idx_name = f"idx_{table}_{col}"
                has_idx = one(conn,
                              "SELECT COUNT(*) FROM information_schema.statistics "
                              "WHERE table_schema = :db AND table_name = :t AND index_name = :i",
                              db=DB_NAME, t=table, i=idx_name)
                if not has_idx:
                    conn.execute(text(f"CREATE INDEX {idx_name} ON {table} ({col})"))

                conn.execute(text(build_alter(fk)))
                print(f"[ok] added FK     fk_{table}_{col} -> {ref_table}({ref_col}) ON DELETE {on_delete}")
                added += 1

            for legacy in LEGACY_TABLES:
                cnt = one(conn, f"SELECT COUNT(*) FROM {legacy}")
                if cnt:
                    print(f"[warn] legacy table {legacy} has {cnt} rows - left untouched")
                    continue
                conn.execute(text(f"DROP TABLE IF EXISTS {legacy}"))
                print(f"[ok] dropped legacy {legacy}")
    return added


def main():
    if db.engine.dialect.name != "mysql":
        print(f"[abort] this migration targets MySQL (dialect={db.engine.dialect.name}). Exiting.")
        raise SystemExit(1)

    print("=== PLANNED CHANGES ===")
    plan = build_plan()
    total = 0
    for label, cnt in plan:
        print(f"  {label:<48} {cnt:>4}")
        total += cnt
    print(f"  {'TOTAL rows affected':<48} {total:>4}")

    if not APPLY:
        print("\nPreview only. Re-run with --apply to execute (snapshots are written first).")
        return

    snap = snapshot()
    mutate()
    added = ensure_constraints()
    dump_snapshot(snap)
    print(f"\n[done] row cleanup committed; {added} FK constraints added.")


if __name__ == "__main__":
    with app.app_context():
        main()