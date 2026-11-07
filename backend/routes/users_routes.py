"""User management routes."""

from flask import Blueprint

from controllers.users_controller import (
    create_user,
    delete_user,
    get_user_stats,
    get_users,
    update_user,
    upload_user_avatar,
)
from lib.auth import require_auth, require_roles

bp = Blueprint("users", __name__)


@bp.route("/api/users", methods=["GET"])
@bp.route("/api/users/", methods=["GET"])
@require_auth
def get_users_route():
    return get_users()


@bp.route("/api/users", methods=["POST"])
@require_roles("admin")
def create_user_route():
    return create_user()


@bp.route("/api/users/<user_id>", methods=["PUT"])
@require_auth
def update_user_route(user_id):
    return update_user(user_id)


@bp.route("/api/users/<user_id>/avatar", methods=["POST"])
@require_auth
def upload_user_avatar_route(user_id):
    return upload_user_avatar(user_id)


@bp.route("/api/users/<user_id>/stats", methods=["GET"])
@require_auth
def get_user_stats_route(user_id):
    return get_user_stats(user_id)


@bp.route("/api/users/<user_id>", methods=["DELETE"])
@require_roles("admin")
def delete_user_route(user_id):
    return delete_user(user_id)
