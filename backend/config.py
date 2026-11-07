"""Environment-driven configuration for the StudyLens backend.

Importing this module loads ``backend/.env`` and validates the mandatory
secrets *before* the Flask app is built, so a misconfigured deployment fails
loudly at startup instead of running with an insecure default.
"""

import os

from dotenv import load_dotenv

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_UPLOADS_DIR = os.path.join(_BACKEND_DIR, "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)

# Path-independent: resolves .env from this file's folder regardless of the
# working directory the Flask process is launched from.
load_dotenv(dotenv_path=os.path.join(_BACKEND_DIR, ".env"))

# Configuration & Secrets
# The JWT secret MUST come from the environment. There is deliberately no
# hardcoded fallback: a known default lets anyone forge admin tokens.
SECRET_KEY = os.getenv("JWT_SECRET", "").strip()
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET is not set. Generate one with "
        "`python -c \"import secrets; print(secrets.token_hex(32))\"` "
        "and add it to backend/.env."
    )

_PLACEHOLDER_SECRETS = {
    "changeme",
    "change-me",
    "your-secret-key",
    "secret",
    "default",
    "generate_a_unique_random_secret_here",
    "replace-me",
    "example",
}
if (
    SECRET_KEY.lower() in _PLACEHOLDER_SECRETS
    or SECRET_KEY.lower().startswith(("generate_", "your_", "replace", "xxx", "example"))
    or SECRET_KEY.startswith("<")
):
    raise RuntimeError(
        "JWT_SECRET is set to a known placeholder value. Generate a real one with "
        "`python -c \"import secrets; print(secrets.token_hex(32))\"`."
    )

PORT = int(os.getenv("FLASK_PORT", 5000))

# Demo account passwords for the seeded role-switch accounts. Overridable so a
# deployment can rotate them without editing code.
DEMO_TEACHER_PASSWORD = os.getenv("DEMO_TEACHER_PASSWORD", "TeacherTest123!")
DEMO_ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "Admin!123")

# Global upload size cap. Materials and AI attachments are rejected above the
# cap with a clean JSON error instead of a bare 413 page (avatar uploads
# enforce their own tighter 5 MB ceiling in-route).
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))

# File types accepted for course-material uploads. html/htm/svg/js are excluded
# so active content can never be stored in the uploads area.
ALLOWED_MATERIAL_EXTENSIONS = {
    "pdf",
    "doc",
    "docx",
    "pptx",
    "txt",
    "md",
    "csv",
    "json",
    "rtf",
    "log",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
}

# Hard cap on the pages/memory parsed from any single uploaded PDF, so a giant
# "zip-bomb style" document can't exhaust memory during text extraction.
MAX_EXTRACT_PAGES = 300

# Hardened CORS: only known frontend origins may call the API. The Vite dev
# server runs on localhost:3000 by default; add LAN/host origin(s) via
# ALLOWED_ORIGINS.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:8081,http://127.0.0.1:8081",
    ).split(",")
    if origin.strip()
]


def _resolve_db_target():
    """Returns the configured MySQL URL when reachable, else SQLite fallback."""
    mysql_url = os.getenv("MYSQL_DATABASE_URL")
    if not mysql_url and os.getenv("MYSQL_HOST"):
        db_user = os.getenv("MYSQL_USER", "root")
        db_pass = os.getenv("MYSQL_PASSWORD", "")
        db_host = os.getenv("MYSQL_HOST", "localhost")
        db_name = os.getenv("MYSQL_DB", "studylens_db")
        mysql_url = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}/{db_name}"

    db_target = "sqlite:///studylens.db"
    if not mysql_url:
        return db_target

    # Explicit non-MySQL URLs (e.g. a SQLite test database) are used verbatim;
    # the connectivity probe below is MySQL-specific.
    if not mysql_url.startswith("mysql"):
        return mysql_url

    try:
        from sqlalchemy import create_engine

        probe_url = mysql_url if "?" in mysql_url else mysql_url + "?connect_timeout=5"
        probe = create_engine(probe_url)
        with probe.connect():
            pass
        probe.dispose()
        safe_label = (mysql_url.split("//")[1].split("@")[-1]).split("?")[0]
        print(f"[Database] Connected to MySQL ({safe_label})")
        return mysql_url
    except Exception as db_err:
        short_err = str(db_err).splitlines()[0][:160] if str(db_err) else "unknown error"
        print(f"[Database] MySQL not connected ({short_err}).")
        print("[Database] Continuing with SQLite — StudyLens runs fully on SQLite.")
        print(
            "[Database] To enable MySQL, check MYSQL_DATABASE_URL / "
            "MYSQL_PASSWORD in .env and restart."
        )
        return db_target


DB_TARGET = _resolve_db_target()
