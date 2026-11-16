"""Material content helpers: AI-resource rendering and flag resolution."""

import datetime

from db.session import _commit_or_warn
from extensions import db
from models import MaterialFlagModel, MaterialModel
from services.log_service import log_action
from services.notification_service import _create_notification

MATERIAL_FLAG_CATEGORIES = ("Wrong file", "Wrong subject", "Incomplete content", "Other")


def _render_ai_resource_text(resource_type, payload):
    """Builds a plain-text rendering of an AI resource for the learning materials library."""
    lines = []
    if resource_type == "summary":
        if payload.get("executiveSummary"):
            lines.append(str(payload["executiveSummary"]))
        for takeaway in payload.get("keyTakeaways") or []:
            if isinstance(takeaway, dict):
                lines.append(f"- Key Takeaway: {takeaway.get('text') or takeaway.get('title') or ''}")
            else:
                lines.append(f"- Key Takeaway: {takeaway}")
        for bullet in payload.get("bulletPoints") or []:
            lines.append(f"- {bullet}")
    elif resource_type == "reviewer":
        if payload.get("overview"):
            lines.append(str(payload["overview"]))
        for topic in payload.get("topics") or []:
            if isinstance(topic, dict):
                lines.append(f"\nTopic: {topic.get('topic') or topic.get('title') or ''}")
                if topic.get("overview"):
                    lines.append(str(topic["overview"]))
                for c in topic.get("keyConcepts") or topic.get("concepts") or []:
                    if isinstance(c, dict):
                        lines.append(f"  - {c.get('text') or c.get('concept') or c.get('title') or ''}")
                    else:
                        lines.append(f"  - {c}")
            else:
                lines.append(str(topic))
    elif resource_type == "flashcards":
        for i, card in enumerate(payload.get("cards") or [], 1):
            if isinstance(card, dict):
                q = card.get("question") or card.get("front") or ""
                a = card.get("answer") or card.get("back") or ""
                lines.append(f"Card {i}: Q: {q}\n  A: {a}")
            else:
                lines.append(str(card))
    elif resource_type == "quiz":
        for i, q in enumerate(payload.get("questions") or [], 1):
            if not isinstance(q, dict):
                continue
            lines.append(f"Q{i}: {q.get('question') or ''}")
            options = q.get("options") or []
            for oi, opt in enumerate(options):
                lines.append(f"  {chr(65 + oi)}. {opt}")
            ca = q.get("correctAnswer")
            if isinstance(ca, int) and 0 <= ca < len(options):
                lines.append(f"  Correct Answer: {chr(65 + ca)}")
            elif isinstance(ca, str) and ca in "ABCD":
                lines.append(f"  Correct Answer: {ca}")
    return "\n".join(lines)


def reconcile_material_counts():
    """Reconciles denormalized ``material_count`` columns against actual counts.

    Walks every subject, counts its actual materials, and updates the stored
    ``material_count`` column if it differs. Returns a dict of
    ``{subject_id: (stored_count, actual_count)}`` for subjects where drift was
    detected and repaired.
    """
    from models import SubjectModel

    drifts = {}
    subjects = SubjectModel.query.all()
    for subject in subjects:
        actual_count = db.session.query(MaterialModel).filter_by(subject_id=subject.subject_id).count()
        stored_count = subject.material_count or 0
        if actual_count != stored_count:
            subject.material_count = actual_count
            drifts[subject.subject_id] = (stored_count, actual_count)
    if drifts:
        _commit_or_warn("material count reconciliation")
    return drifts


def _resolve_material_flags(material_id, resolved_by, resolution_note=None, actor_role="teacher"):
    """Flips every pending flag on a material to resolved and notifies the admin(s)
    who raised them. Called by the explicit resolve endpoint and automatically after
    a material edit/delete fixes the underlying issue."""
    flags = MaterialFlagModel.query.filter_by(material_id=material_id, status="pending").all()
    if not flags:
        return flags
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    mat = None
    try:
        mat = db.session.get(MaterialModel, material_id)
    except Exception:
        pass
    mat_title = mat.title if mat else "(deleted material)"
    for flag in flags:
        flag.status = "resolved"
        flag.resolved_at = server_now
        flag.resolved_by = resolved_by
        if resolution_note:
            flag.resolution_note = resolution_note
        _create_notification(
            flag.flagged_by,
            f"Flag resolved on '{mat_title}'",
            f"The teacher addressed the '{flag.category}' flag."
            + (f" Note: {resolution_note}" if resolution_note else ""),
            target=f"material:{material_id}",
        )
        log_action(resolved_by, None, actor_role, "MATERIAL_FLAG_RESOLVED",
                   f"Resolved '{flag.category}' flag on '{mat_title}'")
    _commit_or_warn("material flag resolution")
    return flags
