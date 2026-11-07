"""Generation, persistence, and ownership helpers for AI resources."""

import json

from flask import request

from db.session import _commit_or_warn
from extensions import db
from groq_service import (
    generate_flashcards_with_groq,
    generate_quiz_with_groq,
    generate_reviewer_with_groq,
    generate_summary_with_groq,
    generate_title_with_groq,
)
from lib.ai_content import _trim_preview
from lib.constants import MAX_AI_FLASHCARDS, MAX_AI_QUESTIONS
from lib.validation import _clamp_attempts, _clamp_count, _require_within_max, _reveal_answers
from models.material import AIGeneratedContentModel, MaterialModel
from models.quiz import QuizModel, _replace_quiz_questions
from models.subject import SubjectModel
from services.material_service import _render_ai_resource_text

def _build_generated_resource(mode, data, text_content, timestamp_ms, created_at):
    """Generates AI content and returns it as a dict (shaped like the model to_dict).

    Used both for preview (save=False) and as the payload for /api/ai/save.
    """
    subject_id = data.get("subjectId") or ""
    subject_name = data.get("subjectName") or ""
    created_by_id = data.get("createdById") or "usr-teacher-1"
    created_by_name = data.get("createdByName") or "User"
    material_id = data.get("materialId")
    difficulty = data.get("difficulty", "medium")
    instructions = data.get("instructions") or ""

    if mode == "quiz":
        _require_within_max(data.get("quizCount") or data.get("numQuestions") or 5, MAX_AI_QUESTIONS)
        num_questions = _clamp_count(data.get("quizCount") or data.get("numQuestions") or 5, fallback=5, maximum=MAX_AI_QUESTIONS)
        # The quiz count box was removed from the UI: the prompt is the single source of
        # truth for how many questions to make. Callers that still send an explicit count
        # (legacy /api/quizzes/generate) keep the old default behavior.
        explicit_count = "quizCount" in data or "numQuestions" in data
        questions = generate_quiz_with_groq(
            text_content, num_questions=num_questions, difficulty=difficulty, instructions=instructions,
            require_count=not explicit_count,
        )
        ai_title = generate_title_with_groq("quiz", questions)
        quiz_title = data.get("title") or ai_title or f"AI Quiz: {_trim_preview(text_content)}..."
        title_exists = QuizModel.query.filter(
            QuizModel.title == quiz_title,
            QuizModel.teacher_id == created_by_id,
        ).first() is not None
        return {
            "id": f"quiz-{timestamp_ms}",
            "title": quiz_title,
            "description": "",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "quizType": data.get("quizType") or ("teacher" if data.get("userRole") == "teacher" else "student"),
            "questions": questions,
            "isPublished": (data.get("quizType") or ("teacher" if data.get("userRole") == "teacher" else "student")) == "student" or bool(subject_id),
            "timeLimitMinutes": 15,
            "passPercentage": 70,
            "difficulty": difficulty,
            "createdAt": created_at,
            "titleExists": title_exists
        }
    if mode == "flashcards":
        card_count = _clamp_count(data.get("flashcardCount") or data.get("cardCount") or 5, fallback=5, maximum=MAX_AI_FLASHCARDS)
        cards = generate_flashcards_with_groq(text_content, count=card_count, instructions=instructions)
        ai_title = generate_title_with_groq("flashcards", cards)
        return {
            "id": f"deck-{timestamp_ms}",
            "title": data.get("title") or ai_title or f"Flashcards: {_trim_preview(text_content, 25)}...",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "cards": cards,
            "isPublished": True,
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "createdAt": created_at
        }
    if mode == "summary":
        summary_data = generate_summary_with_groq(text_content, instructions=instructions)
        ai_title = generate_title_with_groq("summary", summary_data)
        return {
            "id": f"sum-{timestamp_ms}",
            "title": data.get("title") or ai_title or f"Summary: {_trim_preview(text_content)}...",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "executiveSummary": summary_data.get("executiveSummary", ""),
            "keyTakeaways": summary_data.get("keyTakeaways", []),
            "bulletPoints": summary_data.get("bulletPoints", []),
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "createdAt": created_at
        }
    if mode == "reviewer":
        reviewer = generate_reviewer_with_groq(text_content, instructions=instructions)
        ai_title = generate_title_with_groq("reviewer", reviewer)
        return {
            "id": f"rev-{timestamp_ms}",
            "title": data.get("title") or ai_title or f"Reviewer: {_trim_preview(text_content)}...",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "overview": reviewer.get("overview", ""),
            "topics": reviewer.get("topics", []),
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "createdAt": created_at
        }
    return None

def _build_quiz_model(payload, data, timestamp_ms, saved_at):
    """Constructs (but does not add) a QuizModel from a generated resource dict."""
    quiz_type = payload.get("quizType") or "student"
    effective_subject = payload.get("subjectId") or ("" if quiz_type == "teacher" else "personal")
    return QuizModel(
        quiz_id=payload.get("id") or f"quiz-{timestamp_ms}",
        title=payload.get("title", "AI Quiz"),
        description=payload.get("description", ""),
        # Teacher quizzes without a subject are subjectless drafts (""), hidden from
        # students until assigned. Student quizzes default to personal practice.
        subject_id=effective_subject,
        subject_name=payload.get("subjectName") or ("" if quiz_type == "teacher" else "Personal Practice"),
        material_id=payload.get("materialId"),
        teacher_id=payload.get("createdById") or "usr-teacher-1",
        created_by_name=payload.get("createdByName") or data.get("createdByName") or "User",
        quiz_type=quiz_type,
        questions_json=json.dumps(payload.get("questions", [])),
        is_published=bool(payload.get("isPublished", bool(effective_subject))),
        time_limit_minutes=int(payload.get("timeLimitMinutes") or 15),
        pass_percentage=int(payload.get("passPercentage") or 70),
        difficulty=payload.get("difficulty", "medium"),
        attempts_allowed=_clamp_attempts(payload.get("attemptsAllowed")),
        reveal_answers=_reveal_answers(payload.get("revealAnswers")),
        created_at=payload.get("createdAt") or saved_at,
    )

def _build_ai_content_model(payload, timestamp_ms, saved_at, content_type):
    """Constructs (but does not add) an AIGeneratedContentModel from a generated dict."""
    payload_persisted = dict(payload)
    payload_persisted.setdefault("isPublished", True)
    payload_persisted["createdById"] = payload.get("createdById") or "usr-teacher-1"
    return AIGeneratedContentModel(
        content_id=payload.get("id") or f"ai-{content_type.lower()}-{timestamp_ms}",
        material_id=payload.get("materialId"),
        generated_by=payload.get("createdById") or "usr-teacher-1",
        title=payload.get("title", content_type),
        content_type=content_type,
        generated_text=json.dumps(payload_persisted),
        created_at=payload.get("createdAt") or saved_at,
    )

def _persist_generated_resource(mode, payload, data, timestamp_ms, created_at):
    """Persists a generated AI resource dict (idempotent). Returns the saved model or None.

    Quizzes are stored in the quizzes + quiz_questions tables; flashcards, summaries,
    and reviewers are stored in the single ai_generated_content table (content_type),
    matching the manuscript ERD.
    """
    resource_id = payload.get("id")
    saved_at = payload.get("createdAt") or created_at

    if mode == "quiz":
        existing = db.session.get(QuizModel, resource_id) if resource_id else None
        if existing:
            return existing

        def _stage_quiz():
            model = _build_quiz_model(payload, data, timestamp_ms, saved_at)
            db.session.add(model)
            _replace_quiz_questions(model.quiz_id, payload.get("questions", []))
            return model

        new_model = _stage_quiz()
        if not _commit_or_warn("AI quiz save", restage=lambda: _stage_quiz()):
            return None
        return new_model

    content_type_map = {"flashcards": "Flashcard", "summary": "Summary", "reviewer": "Reviewer"}
    content_type = content_type_map.get(mode)
    if content_type is None:
        return None

    existing = db.session.get(AIGeneratedContentModel, resource_id) if resource_id else None
    if existing:
        return existing

    user_role = data.get("userRole") or "student"
    created_by_id = payload.get("createdById") or "usr-teacher-1"
    current_user = getattr(request, "current_user", None) or {}
    created_by_name = (current_user or {}).get("name") or data.get("createdByName") or payload.get("createdByName") or "User"

    def _stage_content():
        model = _build_ai_content_model(payload, timestamp_ms, saved_at, content_type)
        db.session.add(model)
        # Course material mirror: summaries, reviewers, and flashcards are saved
        # straight into the Upload & Manage Materials library (subjectless for
        # teachers; assigned there later). Quizzes never become materials, and a
        # TEACHER's or STUDENT's flashcards live in the Flashcards feature only —
        # they are NOT mirrored into Learning Materials. Admins have no Flashcards
        # feature, so their flashcards still mirror into Materials.
        if mode == "flashcards" and user_role in ("teacher", "student"):
            return model
        title = (payload.get("title") or "").strip() or f"AI {content_type}"
        db.session.add(MaterialModel(
            material_id=f"mat-{timestamp_ms}",
            # subject_id is a real FK to subjects.subject_id, so it must be NULL
            # (unassigned) rather than ""/"personal" -- those are not subject ids
            # and MySQL rejects the insert. Matches upload_material and
            # /api/materials/from-ai, which both normalise the same way.
            subject_id=None,
            teacher_id=created_by_id,
            title=title,
            description=f"AI-generated {content_type.lower()} saved from the StudyLens Resource Creator.",
            file_url=None,
            file_type=f"ai-{mode}",
            file_size="—",
            extracted_text=_render_ai_resource_text(mode, payload) or title,
            uploaded_at=created_at,
            material_type="personal" if user_role == "student" else "course",
            uploaded_by=created_by_name,
            uploader_role=user_role or "teacher",
        ))
        return model

    new_model = _stage_content()
    if not _commit_or_warn(f"AI {mode} save", restage=lambda: _stage_content()):
        return None
    return new_model

def _can_access_saved_resource(item, mode, current_user):
    """Whether the caller may read/return an already-saved AI resource.

    A client-supplied resource id must never let a user fetch a quiz or AI
    resource they don't own (or, for teachers, manage through a subject).
    """
    role = (current_user or {}).get("role", "")
    auth_id = (current_user or {}).get("id", "")
    if role == "admin":
        return True
    if mode == "quiz":
        if item.teacher_id == auth_id:
            return True
        if role == "teacher" and item.subject_id and item.subject_id != "personal":
            subject = db.session.get(SubjectModel, item.subject_id)
            return bool(subject and subject.teacher_id == auth_id)
        return False
    if item.generated_by == auth_id:
        return True
    if role == "teacher":
        try:
            payload = json.loads(item.generated_text) or {}
        except Exception:
            payload = {}
        subject_id = payload.get("subjectId") or ""
        if subject_id and subject_id != "personal":
            subject = db.session.get(SubjectModel, subject_id)
            return bool(subject and subject.teacher_id == auth_id)
        return False
    return False

