"""Application middleware: maintenance-mode gate and startup safety checks."""

from flask import jsonify, request

from config import IS_PRODUCTION, KNOWN_DEFAULT_DEMO_PASSWORDS
from lib.auth import _authenticated_user_from_session, _extract_session_token
from services.settings_service import _load_system_settings

_DEMO_SAFETY_CHECKED = False


def enforce_maintenance_mode():
    """Global gate: when maintenance mode is on, only admins may use the API."""
    path = request.path
    if not path.startswith("/api/"):
        return
    if path in ("/api/auth/login", "/api/auth/register", "/api/auth/verify-2fa", "/api/auth/resend-2fa"):
        return
    settings = _load_system_settings()
    if settings.get("maintenanceMode") != "true":
        return
    token = _extract_session_token()
    if not token:
        return jsonify({"error": "System is under maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}), 503
    user = _authenticated_user_from_session()
    if not user or user.role != "admin":
        return jsonify({"error": "System is under maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}), 503


def enforce_production_demo_account_safety():
    """Refuses to serve production traffic while a demo account has a default
    or missing password. Runs once per process."""
    global _DEMO_SAFETY_CHECKED
    if _DEMO_SAFETY_CHECKED or not IS_PRODUCTION:
        return
    _DEMO_SAFETY_CHECKED = True

    try:
        from werkzeug.security import check_password_hash

        from extensions import db
        from models import UserModel

        for user_id in ("usr-teacher-1", "usr-admin-1"):
            user = db.session.get(UserModel, user_id)
            if not user:
                continue
            if not user.password_hash:
                return jsonify({
                    "error": "Production startup blocked: a demo account has no password.",
                    "code": "UNSAFE_DEMO_ACCOUNT",
                }), 503
            for default_password in KNOWN_DEFAULT_DEMO_PASSWORDS:
                if check_password_hash(user.password_hash, default_password):
                    return jsonify({
                        "error": "Production startup blocked: a demo account uses a known default password.",
                        "code": "UNSAFE_DEMO_ACCOUNT",
                    }), 503
    except Exception:
        # A database that is not ready is reported by readiness checks; do not
        # turn a transient DB error into a misleading security failure.
        return
