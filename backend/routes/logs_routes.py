"""Activity-log routes."""

from flask import Blueprint

from controllers.logs_controller import (
    add_activity_log,
    clear_activity_logs,
    get_activity_logs,
)
from lib.auth import require_roles

bp = Blueprint("logs", __name__)


@bp.route("/api/logs", methods=["GET"])
@require_roles("admin")
def get_activity_logs_route():
    return get_activity_logs()


@bp.route("/api/logs", methods=["POST"])
@require_roles("admin")
def add_activity_log_route():
    return add_activity_log()


@bp.route("/api/logs", methods=["DELETE"])
@require_roles("admin")
def clear_activity_logs_route():
    return clear_activity_logs()
