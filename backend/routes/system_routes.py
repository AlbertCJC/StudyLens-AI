"""System metadata, settings and backup routes."""

from flask import Blueprint

from controllers.system_controller import (
    get_system_info,
    get_system_settings,
    health,
    save_system_settings,
    system_backup,
)
from lib.auth import require_auth, require_roles

bp = Blueprint("system", __name__)


@bp.route("/api/health", methods=["GET"])
def health_route():
    return health()


@bp.route("/api/ready", methods=["GET"])
def ready_route():
    """Readiness probe: 200 when the database is reachable, 503 otherwise."""
    return health()


@bp.route("/api/system/info", methods=["GET"])
def get_system_info_route():
    return get_system_info()


@bp.route("/api/system/settings", methods=["GET"])
@require_auth
def get_system_settings_route():
    return get_system_settings()


@bp.route("/api/system/settings", methods=["POST", "PUT"])
@require_roles("admin")
def save_system_settings_route():
    return save_system_settings()


@bp.route("/api/system/backup", methods=["GET"])
@require_roles("admin")
def system_backup_route():
    return system_backup()
