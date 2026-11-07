"""Flashcard, summary, and reviewer routes."""

from flask import Blueprint

from controllers.resources_controller import (
    delete_flashcard_deck,
    delete_reviewer,
    delete_summary,
    get_flashcards,
    get_reviewers,
    get_summaries,
    update_flashcard_deck,
    update_reviewer,
    update_summary,
)
from lib.auth import require_auth

bp = Blueprint("resources", __name__)


@bp.route("/api/flashcards", methods=["GET"])
@require_auth
def get_flashcards_route():
    return get_flashcards()


@bp.route("/api/flashcards/<deck_id>", methods=["DELETE"])
@require_auth
def delete_flashcard_deck_route(deck_id):
    return delete_flashcard_deck(deck_id)


@bp.route("/api/flashcards/<deck_id>", methods=["PUT"])
@require_auth
def update_flashcard_deck_route(deck_id):
    return update_flashcard_deck(deck_id)


@bp.route("/api/summaries", methods=["GET"])
@require_auth
def get_summaries_route():
    return get_summaries()


@bp.route("/api/summaries/<summary_id>", methods=["PUT"])
@require_auth
def update_summary_route(summary_id):
    return update_summary(summary_id)


@bp.route("/api/summaries/<summary_id>", methods=["DELETE"])
@require_auth
def delete_summary_route(summary_id):
    return delete_summary(summary_id)


@bp.route("/api/reviewers", methods=["GET"])
@require_auth
def get_reviewers_route():
    return get_reviewers()


@bp.route("/api/reviewers/<reviewer_id>", methods=["PUT"])
@require_auth
def update_reviewer_route(reviewer_id):
    return update_reviewer(reviewer_id)


@bp.route("/api/reviewers/<reviewer_id>", methods=["DELETE"])
@require_auth
def delete_reviewer_route(reviewer_id):
    return delete_reviewer(reviewer_id)
