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

# Deployment environment. Production disables development conveniences such as
# demo seeding and the OTP reveal flag.
ENVIRONMENT = os.getenv("FLASK_ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT in ("production", "prod")


def _env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


# Demo data is opt-in. Never seed automatically outside an explicit request.
SEED_DEMO_DATA = _env_flag("SEED_DEMO_DATA", False)

# Development-only disclosure of one-time codes in API responses. Forbidden in
# production because it defeats 2FA and email verification.
OTP_DEV_REVEAL = _env_flag("OTP_DEV_REVEAL", False)
if IS_PRODUCTION and OTP_DEV_REVEAL:
    raise RuntimeError(
        "OTP_DEV_REVEAL cannot be enabled when FLASK_ENV=production."
    )

# Local-only escape hatch for cloud uploads. When a configured cloud target
# (Cloudinary / Firebase) fails, the app would otherwise silently fall back to
# the local uploads directory -- which is ephemeral and inaccessible across
# instances. Require an explicit opt-in; otherwise a cloud failure raises.
ALLOW_LOCAL_FALLBACK = _env_flag("ALLOW_LOCAL_FALLBACK", False)

# Local development convenience: fall back to SQLite when a configured MySQL
# target is unreachable. Disabled by default and never permitted in production.
ALLOW_SQLITE_FALLBACK = _env_flag("ALLOW_SQLITE_FALLBACK", False)

# HttpOnly session cookie used for the web client. Mobile keeps using bearer
# JWTs (sent via Authorization header) and must mark itself with
# X-Client-Type: mobile so login/verify/2FA responses still include a token body.
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "studylens_session")
AUTH_COOKIE_PATH = os.getenv("AUTH_COOKIE_PATH", "/")
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None
AUTH_COOKIE_SECURE = _env_flag("AUTH_COOKIE_SECURE", IS_PRODUCTION)
AUTH_COOKIE_SAMESITE = (os.getenv("AUTH_COOKIE_SAMESITE", "Lax") or "Lax").strip()

# Double-submit CSRF protection for cookie-authenticated unsafe requests.
CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "studylens_csrf")
MOBILE_CLIENT_HEADER = os.getenv("MOBILE_CLIENT_HEADER", "X-Client-Type")
MOBILE_CLIENT_VALUE = os.getenv("MOBILE_CLIENT_VALUE", "mobile")

# Refresh token cookie (long-lived, paired with the short-lived access cookie).
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "studylens_refresh")
REFRESH_COOKIE_PATH = os.getenv("REFRESH_COOKIE_PATH", "/")
REFRESH_COOKIE_DOMAIN = os.getenv("REFRESH_COOKIE_DOMAIN") or None
REFRESH_COOKIE_SECURE = _env_flag("REFRESH_COOKIE_SECURE", IS_PRODUCTION)
REFRESH_COOKIE_SAMESITE = (os.getenv("REFRESH_COOKIE_SAMESITE", "Lax") or "Lax").strip()

# Pepper used to HMAC one-time codes at rest. Set explicitly in production;
# falls back to JWT_SECRET in development so codes are never stored plaintext.
OTP_PEPPER = os.getenv("OTP_PEPPER", "") or SECRET_KEY

# Demo account passwords must be supplied explicitly when demo seeding is
# enabled. There are deliberately no fallbacks: a committed default is a
# published backdoor.
DEMO_TEACHER_PASSWORD = os.getenv("DEMO_TEACHER_PASSWORD", "").strip() or None
DEMO_ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "").strip() or None

KNOWN_DEFAULT_DEMO_PASSWORDS = {
    "TeacherTest123!",
    "Admin!123",
}


def _validate_demo_configuration():
    if not SEED_DEMO_DATA:
        return
    if IS_PRODUCTION:
        raise RuntimeError(
            "SEED_DEMO_DATA cannot be enabled when FLASK_ENV=production. "
            "Provision accounts through an explicit, audited process instead."
        )
    missing = [
        name
        for name, value in (
            ("DEMO_TEACHER_PASSWORD", DEMO_TEACHER_PASSWORD),
            ("DEMO_ADMIN_PASSWORD", DEMO_ADMIN_PASSWORD),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Demo seeding is enabled but the following variables are missing: "
            + ", ".join(missing)
            + ". Set strong, unique values or disable SEED_DEMO_DATA."
        )
    for name, value in (
        ("DEMO_TEACHER_PASSWORD", DEMO_TEACHER_PASSWORD),
        ("DEMO_ADMIN_PASSWORD", DEMO_ADMIN_PASSWORD),
    ):
        if value in KNOWN_DEFAULT_DEMO_PASSWORDS:
            raise RuntimeError(
                f"{name} is set to a known default value. Choose a strong, unique password."
            )
        if IS_PRODUCTION and len(value) < 12:
            raise RuntimeError(f"{name} must be at least 12 characters in production.")


_validate_demo_configuration()

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
    """Returns the configured database URL, failing fast when it is unusable.

    The silent SQLite fallback is forbidden in production and requires the
    explicit ALLOW_SQLITE_FALLBACK=true opt-in during development. Otherwise a
    transient MySQL outage would silently start the app against an empty,
    divergent database.
    """
    mysql_url = os.getenv("MYSQL_DATABASE_URL")
    if not mysql_url and os.getenv("MYSQL_HOST"):
        db_user = os.getenv("MYSQL_USER", "root")
        db_pass = os.getenv("MYSQL_PASSWORD", "")
        db_host = os.getenv("MYSQL_HOST", "localhost")
        db_name = os.getenv("MYSQL_DB", "studylens_db")
        mysql_url = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}/{db_name}"

    sqlite_target = "sqlite:///studylens.db"
    if not mysql_url:
        if IS_PRODUCTION:
            raise RuntimeError(
                "MYSQL_DATABASE_URL is required when FLASK_ENV=production. "
                "Refusing to start against a local SQLite database."
            )
        print("[Database] No MySQL target configured; using SQLite (development).")
        return sqlite_target

    # Explicit non-MySQL URLs (e.g. a SQLite test database) are used verbatim;
    # the connectivity probe below is MySQL-specific.
    if not mysql_url.startswith("mysql"):
        print("[Database] Using explicitly configured non-MySQL database target.")
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
        if IS_PRODUCTION or not ALLOW_SQLITE_FALLBACK:
            raise RuntimeError(
                "Configured MySQL database is unreachable and the SQLite fallback "
                "is disabled. Set ALLOW_SQLITE_FALLBACK=true only for local "
                f"development. Underlying error: {short_err}"
            ) from db_err
        print(f"[Database] MySQL not connected ({short_err}).")
        print("[Database] ALLOW_SQLITE_FALLBACK=true; continuing with SQLite.")
        return sqlite_target


DB_TARGET = _resolve_db_target()
