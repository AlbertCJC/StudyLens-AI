"""Student progress, recommendations and analytics routes."""

from flask import Blueprint

from controllers.analytics_controller import (
    get_admin_analytics,
    get_student_progress,
    get_student_recommendations,
    get_teacher_analytics,
)
from lib.auth import require_auth

bp = Blueprint("analytics", __name__)


@bp.route("/api/progress/<student_id>", methods=["GET"])
@require_auth
def get_student_progress_route(student_id):
    return get_student_progress(student_id)


@bp.route("/api/recommendations/<student_id>", methods=["GET"])
@require_auth
def get_student_recommendations_route(student_id):
    return get_student_recommendations(student_id)


@bp.route("/api/analytics/teacher", methods=["GET"])
@require_auth
def get_teacher_analytics_route():
    return get_teacher_analytics()


@bp.route("/api/analytics/admin", methods=["GET"])
@require_auth
def get_admin_analytics_route():
    return get_admin_analytics()
