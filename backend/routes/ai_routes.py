"""AI generation routes."""

from flask import Blueprint

from controllers.ai_controller import (
    ai_personalized_recommendations,
    ai_quiz_hint,
    convert_to_pdf,
    explain_answer_ai,
    explain_answer_ai_alias,
    export_ai_pdf,
    generate_ai_resource,
    generate_flashcards_ai,
    generate_quiz_ai,
    generate_reviewer_ai,
    generate_summary_ai,
    save_ai_resource,
)
from lib.auth import require_auth

bp = Blueprint("ai", __name__)


@bp.route("/api/quizzes/generate", methods=["POST"])
@require_auth
def generate_quiz_ai_route():
    return generate_quiz_ai()


@bp.route("/api/flashcards/generate", methods=["POST"])
@require_auth
def generate_flashcards_ai_route():
    return generate_flashcards_ai()


@bp.route("/api/summaries/generate", methods=["POST"])
@require_auth
def generate_summary_ai_route():
    return generate_summary_ai()


@bp.route("/api/reviewers/generate", methods=["POST"])
@require_auth
def generate_reviewer_ai_route():
    return generate_reviewer_ai()


@bp.route("/api/ai/generate", methods=["POST"])
@require_auth
def generate_ai_resource_route():
    return generate_ai_resource()


@bp.route("/api/ai/export/pdf", methods=["POST"])
@require_auth
def export_ai_pdf_route():
    return export_ai_pdf()


@bp.route("/api/convert-to-pdf", methods=["POST"])
@require_auth
def convert_to_pdf_route():
    return convert_to_pdf()


@bp.route("/api/ai/save", methods=["POST"])
@require_auth
def save_ai_resource_route():
    return save_ai_resource()


@bp.route("/api/ai/explain", methods=["POST"])
@require_auth
def explain_answer_ai_route():
    return explain_answer_ai()


@bp.route("/api/explain", methods=["POST"])
@require_auth
def explain_answer_ai_alias_route():
    return explain_answer_ai_alias()


@bp.route("/api/hint", methods=["POST"])
@require_auth
def ai_quiz_hint_route():
    return ai_quiz_hint()


@bp.route("/api/ai/recommendations", methods=["POST"])
@require_auth
def ai_personalized_recommendations_route():
    return ai_personalized_recommendations()
