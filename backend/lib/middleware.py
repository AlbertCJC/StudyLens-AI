"""Application middleware: maintenance-mode gate."""

from flask import jsonify, request

from lib.auth import _authenticated_user_from_bearer, _extract_bearer_token
from services.settings_service import _load_system_settings


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
    token = _extract_bearer_token()
    if not token:
        return jsonify({"error": "System is under maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}), 503
    user = _authenticated_user_from_bearer()
    if not user or user.role != "admin":
        return jsonify({"error": "System is under maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}), 503
