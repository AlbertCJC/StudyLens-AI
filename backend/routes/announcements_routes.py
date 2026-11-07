"""Announcement routes."""

from flask import Blueprint

from controllers.announcements_controller import (
    delete_announcement,
    list_announcements,
    post_announcement,
    update_announcement,
)
from lib.auth import require_auth, require_roles

bp = Blueprint("announcements", __name__)


@bp.route("/api/announcements", methods=["GET"])
@require_auth
def list_announcements_route():
    return list_announcements()


@bp.route("/api/announcements", methods=["POST"])
@require_roles("teacher", "admin")
def post_announcement_route():
    return post_announcement()


@bp.route("/api/announcements/<announcement_id>", methods=["PUT"])
@require_auth
def update_announcement_route(announcement_id):
    return update_announcement(announcement_id)


@bp.route("/api/announcements/<announcement_id>", methods=["DELETE"])
@require_auth
def delete_announcement_route(announcement_id):
    return delete_announcement(announcement_id)
