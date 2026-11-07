"""Flashcard, summary, and reviewer handlers."""

import json

from flask import jsonify, request

from db.session import _commit_or_warn
from extensions import db
from lib.ai_content import _ai_content_to_dict
from models.material import AIGeneratedContentModel
from models.subject import SubjectModel
from services.log_service import log_action

def get_flashcards():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    query = AIGeneratedContentModel.query.filter_by(content_type="Flashcard")
    if user_id:
        query = query.filter_by(generated_by=user_id)
    decks = query.order_by(AIGeneratedContentModel.created_at.desc()).all()
    return jsonify([_ai_content_to_dict(d) for d in decks])

def delete_flashcard_deck(deck_id):
    deck = db.session.get(AIGeneratedContentModel, deck_id)
    if not deck or deck.content_type != "Flashcard":
        return jsonify({"error": "Flashcard deck not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(deck, current_user):
        return jsonify({"error": "You can only delete resources you own or manage.", "code": "FORBIDDEN"}), 403
    db.session.delete(deck)
    _commit_or_warn("flashcard deck deletion")
    log_action((current_user or {}).get("id") or deck.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "FLASHCARD_DELETE", f"Deleted flashcard deck '{deck.title}'")
    return jsonify({"success": True}), 200

def _resource_owned_by_current_user(item, current_user):
    """Admins may manage any resource; teachers only those in subjects they
    manage; students only resources they saved themselves."""
    role = (current_user or {}).get("role", "")
    user_id = (current_user or {}).get("id", "")
    if role == "admin":
        return True
    if role == "student":
        return item.generated_by == user_id
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    subject_id = payload.get("subjectId") or ""
    if role == "teacher":
        if not subject_id or subject_id == "personal":
            return item.generated_by == user_id
        subject = db.session.get(SubjectModel, subject_id)
        if not subject or subject.teacher_id != user_id:
            return False
    return True

def _apply_resource_edits(item, data):
    """Updates title / subject metadata (and publish flag where the model supports it)."""
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    if "title" in data and data.get("title"):
        item.title = str(data["title"])[:256]
        payload["title"] = item.title
    if "subjectId" in data:
        payload["subjectId"] = str(data["subjectId"])
    if "subjectName" in data:
        payload["subjectName"] = str(data["subjectName"])[:128]
    if item.content_type == "Flashcard" and "isPublished" in data:
        payload["isPublished"] = bool(data.get("isPublished"))
    item.generated_text = json.dumps(payload)

def update_flashcard_deck(deck_id):
    deck = db.session.get(AIGeneratedContentModel, deck_id)
    if not deck or deck.content_type != "Flashcard":
        return jsonify({"error": "Flashcard deck not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(deck, current_user):
        return jsonify({"error": "You can only edit resources from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    _apply_resource_edits(deck, request.json or {})
    data = request.json or {}
    if "cards" in data:
        cards = data.get("cards")
        if not isinstance(cards, list):
            return jsonify({"error": "cards must be a list.", "code": "BAD_REQUEST"}), 400
        try:
            payload = json.loads(deck.generated_text) or {}
        except Exception:
            payload = {}
        payload["cards"] = cards
        deck.generated_text = json.dumps(payload)
    _commit_or_warn("flashcard deck update")
    log_action((current_user or {}).get("id") or deck.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "FLASHCARD_UPDATE", f"Updated flashcard deck '{deck.title}'")
    return jsonify(_ai_content_to_dict(deck)), 200

def get_summaries():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    query = AIGeneratedContentModel.query.filter_by(content_type="Summary")
    if user_id:
        query = query.filter_by(generated_by=user_id)
    sums = query.order_by(AIGeneratedContentModel.created_at.desc()).all()
    return jsonify([_ai_content_to_dict(s) for s in sums])

def get_reviewers():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    query = AIGeneratedContentModel.query.filter_by(content_type="Reviewer")
    if user_id:
        query = query.filter_by(generated_by=user_id)
    revs = query.order_by(AIGeneratedContentModel.created_at.desc()).all()
    return jsonify([_ai_content_to_dict(r) for r in revs])

def update_summary(summary_id):
    item = db.session.get(AIGeneratedContentModel, summary_id)
    if not item or item.content_type != "Summary":
        return jsonify({"error": "Summary not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only edit resources from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    _apply_resource_edits(item, request.json or {})
    data = request.json or {}
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    if "executiveSummary" in data:
        payload["executiveSummary"] = str(data.get("executiveSummary") or "")[:10000]
    if "keyTakeaways" in data:
        kt = data.get("keyTakeaways")
        if not isinstance(kt, list):
            return jsonify({"error": "keyTakeaways must be a list.", "code": "BAD_REQUEST"}), 400
        payload["keyTakeaways"] = [str(x)[:2000] for x in kt]
    if "bulletPoints" in data:
        bp = data.get("bulletPoints")
        if not isinstance(bp, list):
            return jsonify({"error": "bulletPoints must be a list.", "code": "BAD_REQUEST"}), 400
        payload["bulletPoints"] = [str(x)[:2000] for x in bp]
    item.generated_text = json.dumps(payload)
    _commit_or_warn("summary update")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "SUMMARY_UPDATE", f"Updated summary '{item.title}'")
    return jsonify(_ai_content_to_dict(item)), 200

def delete_summary(summary_id):
    item = db.session.get(AIGeneratedContentModel, summary_id)
    if not item or item.content_type != "Summary":
        return jsonify({"error": "Summary not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only delete resources you own or manage.", "code": "FORBIDDEN"}), 403
    db.session.delete(item)
    _commit_or_warn("summary deletion")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "SUMMARY_DELETE", f"Deleted summary '{item.title}'")
    return jsonify({"success": True}), 200

def update_reviewer(reviewer_id):
    item = db.session.get(AIGeneratedContentModel, reviewer_id)
    if not item or item.content_type != "Reviewer":
        return jsonify({"error": "Reviewer not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only edit resources from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    _apply_resource_edits(item, request.json or {})
    data = request.json or {}
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    if "overview" in data:
        payload["overview"] = str(data.get("overview") or "")[:10000]
    if "topics" in data:
        topics = data.get("topics")
        if not isinstance(topics, list):
            return jsonify({"error": "topics must be a list.", "code": "BAD_REQUEST"}), 400
        payload["topics"] = topics
    item.generated_text = json.dumps(payload)
    _commit_or_warn("reviewer update")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "REVIEWER_UPDATE", f"Updated reviewer '{item.title}'")
    return jsonify(_ai_content_to_dict(item)), 200

def delete_reviewer(reviewer_id):
    item = db.session.get(AIGeneratedContentModel, reviewer_id)
    if not item or item.content_type != "Reviewer":
        return jsonify({"error": "Reviewer not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only delete resources you own or manage.", "code": "FORBIDDEN"}), 403
    db.session.delete(item)
    _commit_or_warn("reviewer deletion")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "REVIEWER_DELETE", f"Deleted reviewer '{item.title}'")
    return jsonify({"success": True}), 200

