"""Notification routes."""

from flask import Blueprint

from controllers.notifications_controller import (
    get_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)
from lib.auth import require_auth

bp = Blueprint("notifications", __name__)


@bp.route("/api/notifications", methods=["GET"])
@require_auth
def get_notifications_route():
    return get_notifications()


@bp.route("/api/notifications/<notification_id>/read", methods=["PUT"])
@require_auth
def mark_notification_read_route(notification_id):
    return mark_notification_read(notification_id)


@bp.route("/api/notifications/read-all", methods=["PUT"])
@require_auth
def mark_all_notifications_read_route():
    return mark_all_notifications_read()
