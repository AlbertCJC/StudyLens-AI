"""AI generation, export, and recommendation handlers."""

import datetime
import io
import json

from flask import jsonify, request, send_file

from db import session as db_session
from db.session import _commit_or_warn
from extensions import db
from groq_service import (
    GroqAPIError,
    explain_answer_with_groq,
    generate_flashcards_with_groq,
    generate_hint_with_groq,
    generate_quiz_with_groq,
    generate_recommendations_with_groq,
    generate_reviewer_with_groq,
    generate_summary_with_groq,
    generation_used_fallback,
    reset_generation_source,
)
from lib.ai_content import _ai_content_to_dict
from lib.constants import MAX_AI_FLASHCARDS, MAX_AI_QUESTIONS
from lib.rate_limit import _ai_rate_limited
from lib.validation import _clamp_attempts, _clamp_count, _require_within_max, _reveal_answers
from models.material import AIGeneratedContentModel
from models.quiz import QuizModel
from models.subject import SubjectModel
from pdf.quiz import _build_quiz_pdf
from services.access_service import _teacher_covers_student
from services.ai_content_service import (
    _can_access_saved_resource,
    _build_generated_resource,
    _persist_generated_resource,
)
from services.ai_service import _save_ai_generated_content
from services.analytics_service import _build_student_learning_profile
from services.log_service import log_action

def generate_quiz_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    auth_id = current_user.get("id") or ""
    auth_name = current_user.get("name") or "User"
    auth_role = current_user.get("role") or "student"

    # Attribution is taken from the verified session so a caller can never author
    # a quiz under another identity (content-forgery hardening). Students can only
    # create private personal-practice quizzes, never published course quizzes, so
    # an explicit teacher-type request from a student is rejected outright.
    data["createdById"] = auth_id or "usr-teacher-1"
    data["createdByName"] = auth_name
    if auth_role == "student":
        if data.get("quizType", "teacher") == "teacher":
            return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
        data["quizType"] = "student"

    quiz_type = data.get("quizType", "teacher")
    subject_id = data.get("subjectId", "sub-101")
    # Teachers may only create course quizzes for subjects they manage.
    if auth_role == "teacher" and quiz_type == "teacher" and subject_id not in ("", "personal"):
        sub_q = db.session.get(SubjectModel, subject_id)
        if not sub_q or sub_q.teacher_id != auth_id:
            return jsonify({"error": "You can only create quizzes for a subject assigned to you.", "code": "FORBIDDEN"}), 403

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    text_content = data.get("textContent", "Graph traversal BFS and DFS algorithms.")
    _require_within_max(data.get("numQuestions", 5), MAX_AI_QUESTIONS)
    num_questions = _clamp_count(data.get("numQuestions", 5), fallback=5, maximum=MAX_AI_QUESTIONS)
    difficulty = data.get("difficulty", "medium")
    
    questions = generate_quiz_with_groq(text_content, num_questions=num_questions, difficulty=difficulty)
    
    new_quiz = QuizModel(
        quiz_id=f"quiz-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        title=data.get("title", f"AI Quiz: {text_content[:30]}..."),
        description="",
        subject_id=data.get("subjectId", "sub-101"),
        subject_name=data.get("subjectName", "Data Structures & Algorithms"),
        material_id=data.get("materialId"),
        teacher_id=data.get("createdById", "usr-teacher-1"),
        created_by_name=data.get("createdByName", "Christian C. Barral, MIT"),
        quiz_type=data.get("quizType", "teacher"),
        questions_json=json.dumps(questions),
        is_published=bool(data.get("subjectId", "sub-101")),
        time_limit_minutes=15,
        pass_percentage=70,
        difficulty=difficulty,
        attempts_allowed=_clamp_attempts(data.get("attemptsAllowed")),
        reveal_answers=_reveal_answers(data.get("revealAnswers")),
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(new_quiz)
    if not _commit_or_warn("AI quiz"):
        return jsonify({"error": "Could not save the quiz. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    
    log_action(new_quiz.teacher_id, new_quiz.created_by_name, new_quiz.quiz_type, "AI_QUIZ_GENERATE", f"Generated {len(questions)} items via Groq GPT-OSS-120B")

    return jsonify(new_quiz.to_dict()), 201

def generate_flashcards_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    text_content = data.get("textContent", "Key concepts of data structures.")
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    card_count = _clamp_count(data.get("cardCount", 5), fallback=5, maximum=MAX_AI_FLASHCARDS)
    cards = generate_flashcards_with_groq(text_content, count=card_count)

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_deck = AIGeneratedContentModel(
        content_id=f"deck-{timestamp_ms}",
        material_id=data.get("materialId"),
        generated_by=author_id,
        title=data.get("title", f"Flashcards: {text_content[:25]}..."),
        content_type="Flashcard",
        generated_text=json.dumps({
            "title": data.get("title", f"Flashcards: {text_content[:25]}..."),
            "subjectId": data.get("subjectId", "sub-101"),
            "subjectName": data.get("subjectName", "Data Structures"),
            "materialId": data.get("materialId"),
            "cards": cards,
            "isPublished": True,
            "createdById": author_id,
            "createdAt": created_at,
        }),
        created_at=created_at
    )
    db.session.add(new_deck)
    if not _commit_or_warn("AI flashcard deck"):
        return jsonify({"error": "Could not save the flashcard deck. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    return jsonify(_ai_content_to_dict(new_deck)), 201

def generate_summary_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    author_name = data.get("createdByName") if current_user.get("role") == "admin" else (current_user.get("name") or "")
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    text_content = data.get("textContent", "Lecture material summary.")
    summary_data = generate_summary_with_groq(text_content)

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_sum = AIGeneratedContentModel(
        content_id=f"sum-{timestamp_ms}",
        material_id=data.get("materialId"),
        generated_by=author_id,
        title=data.get("title", f"Summary: {text_content[:30]}..."),
        content_type="Summary",
        generated_text=json.dumps({
            "title": data.get("title", f"Summary: {text_content[:30]}..."),
            "subjectId": data.get("subjectId", "sub-101"),
            "subjectName": data.get("subjectName", "CS 301"),
            "materialId": data.get("materialId"),
            "executiveSummary": summary_data.get("executiveSummary", ""),
            "keyTakeaways": summary_data.get("keyTakeaways", []),
            "bulletPoints": summary_data.get("bulletPoints", []),
            "createdById": author_id,
            "createdByName": author_name,
            "createdAt": created_at,
        }),
        created_at=created_at
    )
    db.session.add(new_sum)
    if not _commit_or_warn("AI summary"):
        return jsonify({"error": "Could not save the summary. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    return jsonify(_ai_content_to_dict(new_sum)), 201

def generate_reviewer_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    author_name = data.get("createdByName") if current_user.get("role") == "admin" else (current_user.get("name") or "")
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    text_content = data.get("textContent", "Study material reviewer.")
    reviewer = generate_reviewer_with_groq(text_content)

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_rev = AIGeneratedContentModel(
        content_id=f"rev-{timestamp_ms}",
        material_id=data.get("materialId"),
        generated_by=author_id,
        title=data.get("title", f"Reviewer: {text_content[:30]}..."),
        content_type="Reviewer",
        generated_text=json.dumps({
            "title": data.get("title", f"Reviewer: {text_content[:30]}..."),
            "subjectId": data.get("subjectId", "sub-101"),
            "subjectName": data.get("subjectName", "General Subject"),
            "materialId": data.get("materialId"),
            "overview": reviewer.get("overview", ""),
            "topics": reviewer.get("topics", []),
            "createdById": author_id,
            "createdByName": author_name,
            "createdAt": created_at,
        }),
        created_at=created_at
    )
    db.session.add(new_rev)
    if not _commit_or_warn("AI reviewer"):
        return jsonify({"error": "Could not save the reviewer. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(new_rev.generated_by, author_name or "User", current_user.get("role") or "teacher", "AI_REVIEWER_GENERATE", f"Generated a {len(reviewer.get('topics', []))}-topic study reviewer via Groq GPT-OSS-120B")
    return jsonify(_ai_content_to_dict(new_rev)), 201

def generate_ai_resource():
    """Unified generation endpoint used by the web AI Study Assistant.

    When `save` is false (default for the web generator) no record is persisted;
    the user previews the result and decides to save it later via /api/ai/save.
    Every generation is still written to the activity audit log (AI_*_GENERATE).
    """
    data = request.json or {}
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    mode = data.get("mode", "quiz")
    text_content = data.get("text", "") or data.get("textContent", "")

    if not text_content or not text_content.strip():
        return jsonify({"error": "No source text provided.", "code": "EMPTY_TEXT"}), 400

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    reset_generation_source()
    try:
        payload = _build_generated_resource(mode, data, text_content, timestamp_ms, created_at)
    except GroqAPIError as e:
        # Structured generation errors (e.g. COUNT_REQUIRED when the prompt names no
        # count) become friendly 400s instead of a generic 500.
        return jsonify({"error": e.message, "code": e.code}), 400
    if payload is None:
        return jsonify({"error": f"Unknown generation mode: {mode}", "code": "INVALID_MODE"}), 400
    offline_reason = generation_used_fallback()
    if offline_reason:
        # The cloud AI provider was unavailable/billing-gated; these results came from
        # content-derived offline generation. Surface it so the UI can show a notice.
        payload["source"] = "offline-fallback"
        payload["offlineReason"] = offline_reason

# Attribution: the verified session is authoritative. Client-sent identity
    # fields (createdById/createdByName/userRole) can be spoofed, so the checks
    # below key off the token and the stored payload always uses the token's
    # identity (admins may still author a resource for another user).
    current_user = getattr(request, "current_user", None) or {}
    auth_id = current_user.get("id") or ""
    auth_name = current_user.get("name") or ""
    auth_role = current_user.get("role") or "student"
    payload["createdById"] = auth_id or payload.get("createdById") or "usr-teacher-1"
    payload["createdByName"] = auth_name or payload.get("createdByName") or "User"
    action_map = {
        "quiz": ("AI_QUIZ_GENERATE", f"Generated {len(payload.get('questions', []))} items via Groq GPT-OSS-120B"),
        "flashcards": ("AI_FLASHCARDS_GENERATE", f"Generated {len(payload.get('cards', []))} cards via Groq GPT-OSS-120B"),
        "summary": ("AI_SUMMARY_GENERATE", "Generated executive summary via Groq GPT-OSS-120B"),
        "reviewer": ("AI_REVIEWER_GENERATE", f"Generated a {len(payload.get('topics', []))}-topic study reviewer via Groq GPT-OSS-120B"),
    }
    action, detail = action_map.get(mode, ("AI_RESOURCE_GENERATE", "Generated an AI study resource"))
    log_action(payload["createdById"], payload["createdByName"], auth_role, action, detail)

    save = bool(data.get("save", True))
    if not save:
        # Return the generated resource as a draft WITHOUT persisting it.
        return jsonify({"saved": False, **payload}), 200

    # Quiz ownership rule: teacher quizzes may only target a subject the creator
    # manages (or stay subjectless). Admins may target any subject. Students cannot
    # create course quizzes at all.
    if mode == "quiz":
        if auth_role == "student":
            payload["quizType"] = "student"
        quiz_type = payload.get("quizType") or "student"
        user_role = auth_role
        subject_id = payload.get("subjectId") or ""
        if quiz_type == "teacher" and user_role not in ("teacher", "admin"):
            return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
        if quiz_type == "teacher" and user_role == "teacher" and subject_id not in ("", "personal"):
            subject = db.session.get(SubjectModel, subject_id)
            if not subject or subject.teacher_id != payload.get("createdById"):
                return jsonify({"error": "You can only save quizzes to a subject assigned to you.", "code": "FORBIDDEN"}), 403

    saved = _persist_generated_resource(mode, payload, data, timestamp_ms, created_at)
    if saved is None:
        return jsonify({"error": "Could not save the generated resource. The database write failed. Please try again.", "code": "SAVE_FAILED", "reason": db_session._LAST_COMMIT_ERROR}), 500

    current_user = getattr(request, "current_user", None) or {}
    if not _can_access_saved_resource(saved, mode, current_user):
        return jsonify({"error": "You can only save generated resources you own or manage.", "code": "FORBIDDEN"}), 403

    if isinstance(saved, AIGeneratedContentModel):
        return jsonify(_ai_content_to_dict(saved)), 201
    return jsonify(saved.to_dict()), 201

def export_ai_pdf():
    """Builds a formatted PDF for a generated summary or reviewer and returns it as a file.

    Body: {"mode": "reviewer" | "summary", "title": str, "subjectName": str, "data": {...}}
    PDFs are generated server-side with ReportLab (already a project dependency) so both the
    web app and the mobile app can download the same nicely formatted document.
    """
    import re

    data = request.json or {}
    mode = data.get("mode", "")
    if mode not in ("summary", "reviewer", "quiz", "flashcards"):
        return jsonify({"error": "Unsupported export mode.", "code": "INVALID_MODE"}), 400

    payload = data.get("data") or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Missing resource data.", "code": "EMPTY_DATA"}), 400

    if mode == "quiz":
        quiz_pdf_title = str(data.get("title") or payload.get("title") or "StudyLens AI Resource")
        quiz_pdf_subject = str(data.get("subjectName") or payload.get("subjectName") or "")
        buf = _build_quiz_pdf(quiz_pdf_title, quiz_pdf_subject, payload.get("questions") or [])
        if buf is None:
            return jsonify({"error": "PDF library (reportlab) is not installed.", "code": "PDF_UNAVAILABLE"}), 500
        slug = re.sub(r"[^A-Za-z0-9]+", "-", quiz_pdf_title).strip("-") or "studylens-resource"
        return send_file(
            buf,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{slug[:60]}.pdf",
        )

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, ListFlowable, ListItem, HRFlowable,
            Spacer, PageBreak, Table, TableStyle,
        )
    except Exception:
        return jsonify({"error": "PDF library (reportlab) is not installed.", "code": "PDF_UNAVAILABLE"}), 500

    title = str(data.get("title") or payload.get("title") or "StudyLens AI Resource")
    subject_name = str(data.get("subjectName") or payload.get("subjectName") or "")

    def sanitize(text):
        """Reduces text to ASCII so the standard PDF fonts never render missing-glyph squares."""
        s = str(text or "")
        replacements = {
            # Quotes
            "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
            "\u00ab": '"', "\u00bb": '"', "\u201a": "'", "\u201b": "'",
            "\u201e": '"',
            # Dashes
            "\u2013": "-", "\u2014": "-", "\u2010": "-", "\u2011": "-",
            "\u2012": "-", "\u2015": "-", "\u2212": "-", "\u00ad": "-",
            # Bullets and dots
            "\u2022": "-", "\u00b7": "-", "\u2023": "-", "\u2024": ".",
            "\u2025": "..", "\u2026": "...",
            # Spaces
            "\u00a0": " ", "\u2000": " ", "\u2001": " ", "\u2002": " ",
            "\u2003": " ", "\u2004": " ", "\u2005": " ", "\u2006": " ",
            "\u2007": " ", "\u2008": " ", "\u2009": " ", "\u200a": " ",
            "\u2028": " ", "\u2029": " ", "\u200b": "", "\ufeff": "",
            # Other common symbols
            "\u00a9": "(c)", "\u00ae": "(r)", "\u2122": "(tm)",
            "\u00a2": "(c)", "\u00a3": "(pound)", "\u00a5": "(yen)",
            "\u00a4": "(cur)", "\u00a6": "|", "\u00a7": "(s)",
            "\u00a8": '"', "\u00aa": "a", "\u00ba": "o",
            "\u00d7": "x", "\u00f7": "/",
        }
        for k, v in replacements.items():
            s = s.replace(k, v)
        return "".join(ch for ch in s if ch in "\t\n\r" or 32 <= ord(ch) <= 126)

    _SPELL_MAP = {
        # Quiz types (only genuinely misspelled forms)
        "identication": "identification", "identifications": "identification",
        "identifcation": "identification", "identifcations": "identification",
        "true/fasle": "true/false", "truefalse": "true/false", "t/f": "true/false",
        "multichoice": "multiple choice", "mcq": "multiple choice",
        "shortanswer": "identification", "short answer": "identification",
        # Common misspellings
        "recieve": "receive", "seperate": "separate", "definately": "definitely",
        "occured": "occurred", "untill": "until", "arguement": "argument",
        "embarass": "embarrass", "liason": "liaison", "occurence": "occurrence",
        "posession": "possession", "recomend": "recommend", "referance": "reference",
        "begining": "beginning", "calender": "calendar", "cemetary": "cemetery",
        "colleague": "colleague", "conscience": "conscience",
        "dilemma": "dilemma", "embarrass": "embarrass", "exceed": "exceed",
        "exercise": "exercise", "experience": "experience", "foreign": "foreign",
        "gauge": "gauge", "grateful": "grateful", "harass": "harass",
        "indispensable": "indispensable", "knowledge": "knowledge",
        "maintenance": "maintenance", "millennium": "millennium",
        "necessary": "necessary", "occasion": "occasion", "occurred": "occurred",
        "parallel": "parallel", "precede": "precede", "principal": "principal",
        "privilege": "privilege", "receive": "receive", "recommend": "recommend",
        "referred": "referred", "relevant": "relevant", "separate": "separate",
        "sergeant": "sergeant", "supersede": "supersede", "threshold": "threshold",
        "twelfth": "twelfth", "until": "until", "weird": "weird",
    }

    def correct_spelling(text):
        """Auto-correct misspelled words in user input text."""
        if not isinstance(text, str) or not text:
            return text
        result = text
        lower = text.lower()
        for wrong, correct in _SPELL_MAP.items():
            if wrong in lower:
                result = result.replace(wrong, correct).replace(wrong.title(), correct.title()).replace(wrong.upper(), correct.upper())
        return result

    title = sanitize(title)
    subject_name = sanitize(subject_name)

    styles = getSampleStyleSheet()
    heading = ParagraphStyle("StudyHeading", parent=styles["Title"], fontSize=18, leading=22, spaceAfter=6)
    subtitle = ParagraphStyle("StudySubtitle", parent=styles["Normal"], fontSize=10, leading=14, alignment=TA_CENTER, textColor="#475569", spaceAfter=4)
    section = ParagraphStyle("StudySection", parent=styles["Heading2"], fontSize=13, leading=17, spaceBefore=10, spaceAfter=6, textColor="#1d4ed8")
    body = ParagraphStyle("StudyBody", parent=styles["BodyText"], fontSize=10.5, leading=15, spaceAfter=4)
    topic_heading = ParagraphStyle("StudyTopic", parent=styles["Heading3"], fontSize=11.5, leading=15, spaceBefore=8, spaceAfter=4)
    quiz_title = ParagraphStyle("QuizTitle", parent=styles["Title"], fontSize=17, leading=21, textColor="#1e293b", spaceAfter=2, alignment=TA_CENTER)
    quiz_subtitle = ParagraphStyle("QuizSubtitle", parent=styles["Normal"], fontSize=9.5, leading=13, textColor="#64748b", alignment=TA_CENTER, spaceAfter=8)
    quiz_instructions = ParagraphStyle("QuizInstructions", parent=styles["Normal"], fontSize=11, leading=14, textColor="#000000", spaceAfter=6)
    quiz_question = ParagraphStyle("QuizQuestion", parent=styles["Normal"], fontSize=10.5, leading=14, textColor="#000000", spaceBefore=6, spaceAfter=2, leftIndent=22)
    quiz_option = ParagraphStyle("QuizOption", parent=styles["Normal"], fontSize=10, leading=13, textColor="#000000", leftIndent=40, spaceAfter=1)
    quiz_answer = ParagraphStyle("QuizAnswer", parent=styles["Normal"], fontSize=9, leading=12, textColor="#059669", leftIndent=40, spaceAfter=8)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="StudyLens AI",
    )

    story = []
    story.append(Paragraph(f"Subject: {subject_name}" if subject_name else "StudyLens AI Study Resource", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color="#d1d5db", spaceBefore=8, spaceAfter=10))

    def esc(text):
        return sanitize(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    quiz_meta = {"mode": mode, "count": 0}

    def quiz_page_decorator(canvas, doc_):
        """Draw a footer with page numbers on every quiz page."""
        canvas.saveState()
        w, h = letter
        # Footer
        canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
        canvas.setLineWidth(0.5)
        canvas.line(50, 40, w - 50, 40)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.setFont("Helvetica", 8)
        canvas.drawString(50, 30, "StudyLens AI — Assessment Paper")
        canvas.drawRightString(w - 50, 30, f"Page {canvas.getPageNumber()}")
        canvas.restoreState()

    if mode == "summary":
        story.append(Paragraph("Executive Summary", section))
        story.append(Paragraph(esc(payload.get("executiveSummary") or ""), body))

        takeaways = payload.get("keyTakeaways") or []
        if isinstance(takeaways, list) and takeaways:
            story.append(Paragraph("Key Takeaways", section))
            story.append(ListFlowable(
                [ListItem(Paragraph(esc(t), body), leftIndent=18) for t in takeaways],
                bulletType="bullet", start="-", leftIndent=18,
            ))

        bullets = payload.get("bulletPoints") or []
        if isinstance(bullets, list) and bullets:
            story.append(Paragraph("Core Bullet Points", section))
            story.append(ListFlowable(
                [ListItem(Paragraph(esc(b), body), leftIndent=18) for b in bullets],
                bulletType="bullet", start="-", leftIndent=18,
            ))
    elif mode == "reviewer":
        story.append(Paragraph("Concept Overview", section))
        story.append(Paragraph(esc(payload.get("overview") or ""), body))

        topics = payload.get("topics") or []
        if isinstance(topics, list) and topics:
            story.append(Paragraph("Topic-by-Topic Breakdown", section))
            for idx, t in enumerate(topics, start=1):
                if not isinstance(t, dict):
                    continue
                story.append(Paragraph(f"Topic {idx}: {esc(t.get('topic') or t.get('topicName') or 'Study Topic')}", topic_heading))
                if t.get("overview"):
                    story.append(Paragraph(esc(t["overview"]), body))

                concepts = t.get("keyConcepts") or t.get("keyPoints") or []
                if isinstance(concepts, list) and concepts:
                    story.append(Paragraph("Key Concepts", body))
                    story.append(ListFlowable(
                        [ListItem(Paragraph(esc(c), body), leftIndent=18) for c in concepts],
                        bulletType="bullet", start="-", leftIndent=18,
                    ))

                sample_questions = t.get("sampleQuestions") or []
                if isinstance(sample_questions, list) and sample_questions:
                    story.append(Paragraph("Sample Self-Check Questions", body))
                    for qidx, sq in enumerate(sample_questions, start=1):
                        if isinstance(sq, dict):
                            q_text = sq.get("question") or ""
                            a_text = sq.get("answer") or ""
                        else:
                            q_text = sq or ""
                            a_text = ""
                        if q_text:
                            story.append(Paragraph(f"Q{qidx}. {esc(q_text)}", body))
                        if a_text:
                            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;A: {esc(a_text)}", body))

    else:
        cards = payload.get("cards") or []
        if isinstance(cards, list) and cards:
            story.append(Paragraph("Flashcards", section))
            for idx, c in enumerate(cards, start=1):
                if not isinstance(c, dict):
                    continue
                story.append(Paragraph(f"Card {idx}: {esc(c.get('question') or '')}", body))
                if c.get("answer"):
                    story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;Answer: {esc(c.get('answer') or '')}", body))

    doc.build(story)
    buf.seek(0)

    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-") or "studylens-resource"
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{slug[:60]}.pdf",
    )

def convert_to_pdf():
    """Renders a simple {title, content, items[]} payload into a downloadable PDF.

    Matches the legacy Express /api/convert-to-pdf contract used by the web analytics
    page and flashcard export: title heading, optional content paragraph, then numbered
    items rendered as "1. <question|topic>" + "Answer / Detail: <answer|overview>".
    """
    data = request.json or {}
    title = str(data.get("title") or "StudyLens AI Report")
    meta_line = str(data.get("metaLine") or "")
    content = str(data.get("content") or "")
    items = data.get("items") or []

    import re

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import SimpleDocTemplate, Paragraph, HRFlowable, Spacer
    except Exception:
        return jsonify({"error": "PDF library (reportlab) is not installed.", "code": "PDF_UNAVAILABLE"}), 500

    def sanitize(text):
        s = str(text or "")
        replacements = {
            "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
            "\u2013": "-", "\u2014": "-", "\u2022": "-", "\u00b7": "-",
            "\u2026": "...", "\u00a0": " ", "\ufeff": "",
        }
        for k, v in replacements.items():
            s = s.replace(k, v)
        return "".join(ch for ch in s if ch in "\t\n\r" or 32 <= ord(ch) <= 126)

    # -- Markdown → reportlab HTML converter --
    # Converts common markdown markers into the subset of HTML that
    # reportlab's Paragraph element supports: <b>, <i>, <u>, <br/>.

    _TAG_PLACEHOLDER_RE = re.compile(r"(<[^>]+>)")

    def _md_to_pdf_html(text):
        """Convert markdown-style formatting into reportlab-safe HTML tags."""
        s = sanitize(text)
        if not s:
            return ""

        # Preserve any HTML-like tags already present (e.g. from content).
        tags = []
        def _save_tag(m):
            tags.append(m.group(0))
            return f"\x00{len(tags) - 1}\x00"
        s = _TAG_PLACEHOLDER_RE.sub(_save_tag, s)

        # Escape literal markup characters first so stray <, >, & render as
        # text instead of being interpreted (or escaping our own tags below).
        s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        # **bold**
        s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
        # *italic* (but not ** which was already handled)
        s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", s)
        # __bold__
        s = re.sub(r"__(.+?)__", r"<b>\1</b>", s)
        # _italic_
        s = re.sub(r"(?<!_)_(?!_)(.+?)(?<!_)_(?!_)", r"<i>\1</i>", s)

        # Restore saved tags.
        for idx, tag in enumerate(tags):
            s = s.replace(f"\x00{idx}\x00", tag)
        return s

    def _is_header(line):
        """Return (level, text) if line is a markdown header, else None."""
        m = re.match(r"^(#{1,6})\s+(.+)$", line)
        if m:
            return len(m.group(1)), m.group(2).strip()
        return None

    def _is_bullet(line):
        """Return bullet text if line starts with '- ' or '* ', else None."""
        m = re.match(r"^[-*]\s+(.+)$", line)
        if m:
            return m.group(1).strip()
        return None

    def _is_rule(line):
        """Return True if line is a horizontal rule (---, ***, ___, ===)."""
        return bool(re.match(r"^[-*=]{3,}\s*$", line.strip()))

    def _is_numbered(line):
        """Return (num, text) if line starts with '1. ', '2. ', etc."""
        m = re.match(r"^(\d+)[.)]\s+(.+)$", line)
        if m:
            return m.group(1), m.group(2).strip()
        return None

    # -- Styles --
    styles = getSampleStyleSheet()
    heading = ParagraphStyle("ReportHeading", parent=styles["Title"], fontSize=18, leading=22, spaceAfter=6)
    subtitle = ParagraphStyle("ReportSubtitle", parent=styles["Normal"], fontSize=10, leading=14, alignment=TA_CENTER, textColor="#475569", spaceAfter=4)
    body = ParagraphStyle("ReportBody", parent=styles["BodyText"], fontSize=10.5, leading=15, spaceAfter=4)
    body_bold = ParagraphStyle("ReportBodyBold", parent=body, fontSize=11, leading=15, spaceAfter=4, textColor="#0f172a")
    h2_style = ParagraphStyle("ReportH2", parent=styles["Heading2"], fontSize=14, leading=18, spaceBefore=10, spaceAfter=4, textColor="#1e293b")
    h3_style = ParagraphStyle("ReportH3", parent=styles["Heading3"], fontSize=12, leading=16, spaceBefore=8, spaceAfter=3, textColor="#334155")
    bullet_style = ParagraphStyle("ReportBullet", parent=body, leftIndent=18, bulletIndent=6, spaceBefore=1, spaceAfter=1)
    item_heading = ParagraphStyle("ReportItem", parent=styles["Heading3"], fontSize=11, leading=15, spaceBefore=8, spaceAfter=2, textColor="#0f766e")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="StudyLens AI",
    )

    story = []
    story.append(Paragraph(_md_to_pdf_html(title), heading))
    if meta_line:
        story.append(Paragraph(_md_to_pdf_html(meta_line), subtitle))
    story.append(Paragraph(f"Generated {datetime.datetime.now(datetime.timezone.utc).strftime('%B %d, %Y at %H:%M')}", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color="#d1d5db", spaceBefore=8, spaceAfter=10))

    if content:
        for line in content.split("\n"):
            stripped = line.strip()
            if not stripped:
                story.append(Spacer(1, 6))
                continue
            if _is_rule(stripped):
                story.append(HRFlowable(width="100%", thickness=1, color="#e5e7eb", spaceBefore=4, spaceAfter=4))
                continue
            hdr = _is_header(stripped)
            if hdr:
                level, text = hdr
                style = h2_style if level <= 2 else h3_style
                story.append(Paragraph(_md_to_pdf_html(text), style))
                continue
            bul = _is_bullet(stripped)
            if bul is not None:
                story.append(Paragraph(
                    f"\u2022 {_md_to_pdf_html(bul)}",
                    bullet_style,
                ))
                continue
            num = _is_numbered(stripped)
            if num:
                story.append(Paragraph(
                    f"{num[0]}. {_md_to_pdf_html(num[1])}",
                    bullet_style,
                ))
                continue
            # Regular paragraph — split on double-spaces for line breaks
            # and render with inline formatting.
            story.append(Paragraph(_md_to_pdf_html(stripped), body))
        story.append(HRFlowable(width="100%", thickness=1, color="#e5e7eb", spaceBefore=4, spaceAfter=8))

    def esc(text):
        return sanitize(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    if isinstance(items, list):
        for idx, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                continue
            label = item.get("question") or item.get("topic") or "Item"
            detail = item.get("answer") or item.get("overview") or ""
            story.append(Paragraph(f"{idx}. {esc(label)}", item_heading))
            if detail:
                story.append(Paragraph(f"Answer / Detail: {esc(detail)}", body))

    doc.build(story)
    buf.seek(0)

    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower() or "studylens-report"
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{slug[:60]}.pdf",
    )

def save_ai_resource():
    """Saves a previously generated (non-persisted) AI resource draft."""
    try:
        data = request.json or {}
        mode = data.get("mode")
        if mode not in ("quiz", "flashcards", "summary", "reviewer"):
            return jsonify({"error": "Missing or invalid mode.", "code": "INVALID_MODE"}), 400

        timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        # Quiz ownership rule (parity with /api/ai/generate): teacher quizzes may
        # only target a subject the creator manages (or stay subjectless). Admins
        # may target any subject. Students cannot create course quizzes at all.
        # All identity checks key off the verified session, never client fields.
        current_user = getattr(request, "current_user", None) or {}
        auth_id = current_user.get("id") or ""
        auth_name = current_user.get("name") or ""
        auth_role = current_user.get("role") or "student"
        data["createdById"] = auth_id or data.get("createdById") or "usr-teacher-1"
        data["createdByName"] = auth_name or data.get("createdByName") or "User"
        # user_role decides the mirrored material's material_type/uploader_role,
        # so it must come from the session too -- otherwise a stale client role
        # silently files a teacher's resource as "personal" and the materials
        # page hides it. Mirrors the attribution rule documented at generate_ai_resource.
        data["userRole"] = auth_role
        if mode == "quiz":
            if auth_role == "student":
                data["quizType"] = "student"
            quiz_type = data.get("quizType") or "student"
            subject_id = data.get("subjectId") or ""
            if quiz_type == "teacher" and auth_role not in ("teacher", "admin"):
                return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
            if quiz_type == "teacher" and auth_role == "teacher" and subject_id not in ("", "personal"):
                subject = db.session.get(SubjectModel, subject_id)
                if not subject or subject.teacher_id != auth_id:
                    return jsonify({"error": "You can only save quizzes to a subject assigned to you.", "code": "FORBIDDEN"}), 403

        saved = _persist_generated_resource(mode, data, data, timestamp_ms, created_at)
        if saved is None:
            return jsonify({"error": "Could not save the resource. The database write failed. Please try again.", "code": "SAVE_FAILED", "reason": db_session._LAST_COMMIT_ERROR}), 500

        current_user = getattr(request, "current_user", None) or {}
        if not _can_access_saved_resource(saved, mode, current_user):
            return jsonify({"error": "You can only save generated resources you own or manage.", "code": "FORBIDDEN"}), 403

        created_by_id = (current_user or {}).get("id") or data.get("createdById") or "usr-teacher-1"
        created_by_name = (current_user or {}).get("name") or data.get("createdByName") or "User"
        user_role = (current_user or {}).get("role") or data.get("userRole") or data.get("quizType") or "student"
        log_action(created_by_id, created_by_name, user_role, "AI_RESOURCE_SAVE", f"Saved generated {mode} to the library.")
        if isinstance(saved, AIGeneratedContentModel):
            return jsonify(_ai_content_to_dict(saved)), 201
        return jsonify(saved.to_dict()), 201
    except Exception as e:
        short = str(e).splitlines()[0][:180] if str(e) else e.__class__.__name__
        print(f"[Database] Unhandled error saving AI resource: {e}")
        return jsonify({"error": "Could not save the resource due to a server error. Please try again.", "code": "SAVE_ERROR", "reason": short}), 500

def explain_answer_ai():
    """Generates a plain-language explanation of a quiz item for a student."""
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    question = data.get("question") or ""
    options = data.get("options") or []

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    correct_index = int(data.get("correctAnswer", 0))
    selected_index = int(data.get("selectedAnswer", 0))
    text_context = data.get("context") or data.get("textContent") or ""

    if not question:
        return jsonify({"error": "No question provided.", "code": "EMPTY_TEXT"}), 400

    result = explain_answer_with_groq(question, options, correct_index, selected_index, text_context)
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    _save_ai_generated_content(author_id, data.get("materialId"), "Answer Explanation", "explanation", result)
    return jsonify(result), 200

def explain_answer_ai_alias():
    """Alias for /api/ai/explain so legacy components (e.g. FlashcardView) work."""
    return explain_answer_ai()

def ai_quiz_hint():
    """Generates a subtle educational hint for a quiz question without revealing the answer."""
    data = request.json or {}
    question = str(data.get("question") or "").strip()
    options = data.get("options") or []
    if not isinstance(options, list):
        options = []
    question_type = str(data.get("questionType") or data.get("type") or "").strip()
    topic = str(data.get("topicTag") or data.get("topic") or "").strip()

    if not question:
        return jsonify({"error": "No question provided.", "code": "EMPTY_TEXT"}), 400

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err

    hint = generate_hint_with_groq(question, options, question_type=question_type, topic=topic)
    return jsonify({"hint": hint}), 200

def ai_personalized_recommendations():
    """Personalized learning recommendations derived from stored quiz analytics."""
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    role = current_user.get("role") or ""

    # The target student must be the caller, or (for staff) a student the caller
    # actually teaches. The client-supplied studentId is never trusted on its own.
    student_id = data.get("studentId") or user_id or ""
    if student_id != user_id and role != "admin":
        if role != "teacher" or not _teacher_covers_student(user_id, student_id):
            return jsonify({
                "error": "You can only generate recommendations for yourself or students you teach.",
                "code": "FORBIDDEN",
            }), 403

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err

    subject_id = data.get("subjectId")
    profile = _build_student_learning_profile(student_id, subject_id)
    result = generate_recommendations_with_groq(profile)
    _save_ai_generated_content(student_id, None, "Personalized Learning Recommendations", "recommendation", result)
    return jsonify(result), 200

