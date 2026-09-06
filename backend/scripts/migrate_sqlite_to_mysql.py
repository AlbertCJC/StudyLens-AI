"""
StudyLens SQLite -> MySQL data migration (MERGE strategy).

Copies rows from the SQLite database (backend/instance/studylens.db) into the
configured MySQL database, inserting only rows whose primary key does not yet
exist in MySQL. Existing MySQL data is preserved untouched.

Usage:
    py scripts/migrate_sqlite_to_mysql.py            # run merge migration
    py scripts/migrate_sqlite_to_mysql.py --sqlite <path>   # override sqlite file
"""

import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
import sqlalchemy

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

_SQLITE_DEFAULT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "studylens.db")

# FK-safe ordering: parents before children. Kept for clarity even though the
# current MySQL schema stores most references as plain string columns.
TABLE_ORDER = [
    "roles",
    "users",
    "subjects",
    "student_subjects",
    "learning_materials",
    "ai_generated_content",
    "quizzes",
    "quiz_questions",
    "quiz_attempts",
    "student_progress",
    "notifications",
    "announcements",
    "reports",
    "activity_logs",
]


def sqlite_columns(con, table):
    return con.execute("PRAGMA table_info(" + table + ")").fetchall()


def sqlite_pk_columns(cols):
    return [c[1] for c in cols if c[5] > 0] or [cols[0][1]]


def mysql_columns(conn, table):
    return [r[0] for r in conn.execute(sqlalchemy.text("SHOW COLUMNS FROM " + table)).fetchall()]


def fetch_existing_pks(conn, table, pk_cols):
    cols = ", ".join("`" + c + "`" for c in pk_cols)
    rows = conn.execute(sqlalchemy.text("SELECT " + cols + " FROM " + table)).fetchall()
    return {tuple(r) for r in rows}


def normalize_value(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return v
    return str(v)


def main() -> int:
    sqlite_path = _SQLITE_DEFAULT
    for i, arg in enumerate(sys.argv):
        if arg == "--sqlite" and i + 1 < len(sys.argv):
            sqlite_path = sys.argv[i + 1]

    if not os.path.exists(sqlite_path):
        print("SQLite database not found:", sqlite_path)
        return 1

    mysql_url = os.getenv("MYSQL_DATABASE_URL")
    if not mysql_url:
        print("MYSQL_DATABASE_URL is not set in backend/.env")
        return 1

    scon = sqlite3.connect(sqlite_path)
    scon.row_factory = sqlite3.Row
    meng = sqlalchemy.create_engine(mysql_url)
    mconn = meng.connect()

    mysql_tables = set(meng.dialect.get_table_names(mconn))
    sqlite_tables = {r[0] for r in scon.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}

    print("=" * 62)
    print("StudyLens SQLite -> MySQL migration (merge)")
    print("  SQLite:", sqlite_path)
    print("  MySQL :", (mysql_url.split("//")[1].split("@")[-1]).split("?")[0])
    print("=" * 62)

    total_added = 0
    total_skipped = 0

    for table in TABLE_ORDER:
        if table not in sqlite_tables:
            continue
        if table not in mysql_tables:
            print(f"[skip] {table}: table missing in MySQL")
            continue

        cols = sqlite_columns(scon, table)
        pk_cols = sqlite_pk_columns(cols)
        sqlite_col_names = [c[1] for c in cols]
        mysql_col_names = mysql_columns(mconn, table)
        shared = [c for c in sqlite_col_names if c in mysql_col_names]

        rows = scon.execute("SELECT * FROM " + table).fetchall()
        if not rows:
            print(f"[ok]   {table}: 0 rows (nothing to migrate)")
            continue

        existing = fetch_existing_pks(mconn, table, pk_cols)
        pk_indexes = [shared.index(c) for c in pk_cols]

        insert_cols = ", ".join("`" + c + "`" for c in shared)
        placeholders = ", ".join(":" + c for c in shared)
        stmt = sqlalchemy.text("INSERT INTO " + table + " (" + insert_cols + ") VALUES (" + placeholders + ")")

        added = 0
        skipped = 0
        for row in rows:
            values = [normalize_value(row[c]) for c in shared]
            pk_tuple = tuple(values[i] for i in pk_indexes)
            if pk_tuple in existing:
                skipped += 1
                continue
            params = dict(zip(shared, values))
            try:
                mconn.execute(stmt, params)
                added += 1
                existing.add(pk_tuple)
            except Exception as e:
                print(f"[warn] {table}: row {pk_tuple} failed -> {str(e)[:120]}")
                skipped += 1

        total_added += added
        total_skipped += skipped
        print(f"[ok]   {table}: +{added} added, {skipped} skipped (PK exists / failed)")

    mconn.commit()
    mconn.close()
    meng.dispose()
    scon.close()

    print("=" * 62)
    print(f"Migration complete. {total_added} rows added, {total_skipped} skipped.")
    print("=" * 62)
    return 0


if __name__ == "__main__":
    sys.exit(main())
