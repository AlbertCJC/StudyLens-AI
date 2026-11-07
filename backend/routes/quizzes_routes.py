"""Quiz routes."""

from flask import Blueprint

from controllers.quizzes_controller import (
    create_quiz,
    delete_quiz,
    download_quiz_pdf,
    get_quizzes,
    submit_quiz_attempt,
    update_quiz,
)
from lib.auth import require_auth, require_roles

bp = Blueprint("quizzes", __name__)


@bp.route("/api/quizzes", methods=["GET"])
@require_auth
def get_quizzes_route():
    return get_quizzes()


@bp.route("/api/quizzes/<quiz_id>/download-pdf", methods=["GET"])
@require_auth
def download_quiz_pdf_route(quiz_id):
    return download_quiz_pdf(quiz_id)


@bp.route("/api/quizzes", methods=["POST"])
@require_roles("teacher", "admin", "student")
def create_quiz_route():
    return create_quiz()


@bp.route("/api/quizzes/<quiz_id>", methods=["PUT"])
@require_auth
def update_quiz_route(quiz_id):
    return update_quiz(quiz_id)


@bp.route("/api/quizzes/<quiz_id>", methods=["DELETE"])
@require_auth
def delete_quiz_route(quiz_id):
    return delete_quiz(quiz_id)


@bp.route("/api/quizzes/<quiz_id>/submit", methods=["POST"])
@require_auth
def submit_quiz_attempt_route(quiz_id):
    return submit_quiz_attempt(quiz_id)
