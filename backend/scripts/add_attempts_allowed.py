"""One-time migration: add quizzes.attempts_allowed (0 = unlimited, default 0)."""
import sys
sys.path.insert(0, ".")
from app import app, db
from sqlalchemy import text, inspect

with app.app_context():
    inspector = inspect(db.engine)
    cols = [c["name"] for c in inspector.get_columns("quizzes")]
    if "attempts_allowed" in cols:
        print("[skip] quizzes.attempts_allowed already exists")
        raise SystemExit(0)
    dialect = db.engine.dialect.name
    if dialect == "mysql":
        db.session.execute(text(
            "ALTER TABLE quizzes ADD COLUMN attempts_allowed INTEGER NOT NULL DEFAULT 0"
        ))
        db.session.commit()
        print("[ok] ALTER TABLE quizzes ADD attempts_allowed (MySQL)")
    elif dialect == "sqlite":
        db.session.execute(text(
            "ALTER TABLE quizzes ADD COLUMN attempts_allowed INTEGER NOT NULL DEFAULT 0"
        ))
        db.session.commit()
        print("[ok] ALTER TABLE quizzes ADD attempts_allowed (SQLite)")
    else:
        print(f"[warn] unsupported dialect {dialect} - run migration manually")
        raise SystemExit(1)
