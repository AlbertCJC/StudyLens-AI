"""One-time migration: add quizzes.reveal_answers (default TRUE = answers visible).

Run from the backend directory:  python scripts/add_reveal_answers.py
Idempotent: safe to run more than once.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as A
from sqlalchemy import text


def column_exists(engine, table, column):
    with engine.connect() as conn:
        if engine.dialect.name == "sqlite":
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            return any(r[1] == column for r in rows)
        rows = conn.execute(text(
            f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            f"WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}'"
        )).fetchall()
        return any(r[0] == column for r in rows)


with A.app.app_context():
    engine = A.db.engine
    if column_exists(engine, "quizzes", "reveal_answers"):
        print("[skip] quizzes.reveal_answers already exists")
    else:
        with engine.connect() as conn:
            if engine.dialect.name == "sqlite":
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN reveal_answers BOOLEAN NOT NULL DEFAULT 1"))
            else:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN reveal_answers BOOLEAN NOT NULL DEFAULT TRUE"))
            conn.commit()
        print("[ok] ALTER TABLE quizzes ADD reveal_answers")
print("done")