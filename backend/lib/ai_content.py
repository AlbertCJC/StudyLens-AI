"""Serialisation helpers for saved AI resources."""

import json


def _trim_preview(text, max_len=30):
    text = (text or "").strip()
    return text if len(text) <= max_len else text[:max_len].rstrip() + "..."


def _ai_content_to_dict(entry):
    """Reconstructs the frontend/mobile resource shape from an ai_generated_content row.

    The full payload (including cards / summary fields / reviewer topics and subject
    metadata) was stored as JSON in generated_text, so responses stay byte-compatible
    with the previous flashcard_decks / summaries / reviewers tables.
    """
    try:
        payload = json.loads(entry.generated_text) or {}
    except Exception:
        payload = {}
    base = {
        "id": entry.content_id,
        "title": entry.title,
        "subjectId": payload.get("subjectId") or "",
        "subjectName": payload.get("subjectName") or "",
        "materialId": payload.get("materialId"),
        "createdById": entry.generated_by,
        "createdAt": entry.created_at,
    }
    if entry.content_type == "Flashcard":
        return {
            **base,
            "cards": payload.get("cards", []),
            "isPublished": bool(payload.get("isPublished", True)),
        }
    if entry.content_type == "Summary":
        return {
            **base,
            "executiveSummary": payload.get("executiveSummary", ""),
            "keyTakeaways": payload.get("keyTakeaways", []),
            "bulletPoints": payload.get("bulletPoints", []),
        }
    if entry.content_type == "Reviewer":
        return {
            **base,
            "overview": payload.get("overview", ""),
            "topics": payload.get("topics", []),
        }
    return base
