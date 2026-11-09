"""Quiz authoring, listing, download, and grading handlers."""

import datetime
import json

from flask import jsonify, request, send_file

from db.session import _commit_or_warn
from extensions import db
from lib.auth import require_auth, require_roles
from lib.quiz import _answer_index
from lib.validation import _clamp_attempts, _reveal_answers
from models.quiz import (
    QuizAttemptModel,
    QuizModel,
    QuizQuestionModel,
    _merge_questions_json,
    _quiz_questions_for,
    _replace_quiz_questions,
)
from models.subject import StudentSubjectModel, SubjectModel
from models.progress import StudentProgressModel
from services.log_service import log_action
from services.notification_service import _fan_out_quiz_notification
from pdf.quiz import _build_quiz_pdf

def get_quizzes():
    qs = QuizModel.query.all()
    current_user = getattr(request, "current_user", None) or {}
    requester_id = current_user.get("id") or ""
    requester_role = current_user.get("role") or ""
    # Privacy Rule: Personal practice quizzes (quizType "student") are strictly
    # private to their creator. Teacher/course quizzes are distributed to enrolled
    # class rosters (per the spec): a student sees them only when enrolled in the
    # quiz's subject (subjectless drafts and unpublished quizzes stay hidden).
    if requester_role == "student":
        enrolled = {
            e.subject_id
            for e in StudentSubjectModel.query.filter_by(student_id=requester_id).all()
        }
        qs = [
            q for q in qs
            if (q.quiz_type != "student" or q.teacher_id == requester_id)
            and (q.quiz_type != "teacher" or (q.subject_id in enrolled and q.is_published))
        ]
    elif requester_role == "teacher":
        # Teachers see ONLY their own quizzes plus course quizzes assigned to
        # subjects they manage — never other teachers' assessments.
        managed = {
            s.subject_id
            for s in SubjectModel.query.filter_by(teacher_id=requester_id).all()
        }
        qs = [
            q for q in qs
            if q.teacher_id == requester_id
            or (q.quiz_type != "student" and q.subject_id in managed)
        ]
    else:
        qs = [q for q in qs if q.quiz_type != "student" or q.teacher_id == requester_id]

    used = {}
    last_score = {}
    best_score = {}
    last_raw = {}
    last_max = {}
    if requester_role == "student" and requester_id:
        for a in QuizAttemptModel.query.filter_by(student_id=requester_id).order_by(QuizAttemptModel.submitted_at.desc()).all():
            used[a.quiz_id] = used.get(a.quiz_id, 0) + 1
            last_score.setdefault(a.quiz_id, a.percentage)
            best_score[a.quiz_id] = max(best_score.get(a.quiz_id, 0.0), a.percentage)
            last_raw.setdefault(a.quiz_id, a.score)
            last_max.setdefault(a.quiz_id, a.max_score)
    return jsonify([
        {**_public_quiz_payload(q, requester_role), **({"attemptsUsed": used.get(q.quiz_id, 0), "lastScore": last_score.get(q.quiz_id), "bestScore": best_score.get(q.quiz_id), "lastScoreRaw": last_raw.get(q.quiz_id), "lastMaxScore": last_max.get(q.quiz_id)} if requester_role == "student" else {})}
        for q in qs
    ])

def download_quiz_pdf(quiz_id):
    """Download a quiz as a formatted PDF (question sheet + answer key).

    Teachers may download only quizzes they personally created. Students may
    download only the practice quizzes they generated themselves - never a
    teacher-assigned course quiz.
    """
    import re

    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    role = current_user.get("role") or ""

    if role == "student":
        if quiz.quiz_type != "student" or quiz.teacher_id != user_id:
            return jsonify({"error": "Students can only download quizzes they generated themselves.", "code": "FORBIDDEN"}), 403
    elif role == "teacher":
        if quiz.teacher_id != user_id:
            return jsonify({"error": "You can only download quizzes you created.", "code": "FORBIDDEN"}), 403
    elif role != "admin":
        return jsonify({"error": "You do not have permission to download this quiz.", "code": "FORBIDDEN"}), 403

    try:
        questions = json.loads(quiz.questions_json or "[]")
    except Exception:
        questions = []

    buf = _build_quiz_pdf(quiz.title, quiz.subject_name or "", questions)
    if buf is None:
        return jsonify({"error": "PDF library (reportlab) is not installed.", "code": "PDF_UNAVAILABLE"}), 500

    slug = re.sub(r"[^A-Za-z0-9]+", "-", quiz.title or "quiz").strip("-") or "quiz"
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{slug[:60]}.pdf",
    )

def create_quiz():
    data = request.json or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Quiz title is required.", "code": "BAD_REQUEST"}), 400

    # "" = subjectless draft (teacher-created, awaiting assignment); "personal"
    # = the student's private practice bucket. No default subject is forced here.
    subject_id = data.get("subjectId") or ""
    subject = db.session.get(SubjectModel, subject_id) if subject_id else None
    subject_name = data.get("subjectName")
    if not subject_name and subject:
        subject_name = f"{subject.subject_code} - {subject.subject_name}"

    current_user = getattr(request, "current_user", None) or {}
    user_role = current_user.get("role") or data.get("userRole") or data.get("uploaderRole") or ""
    if user_role == "admin":
        return jsonify({"error": "Administrators have read-only access to quizzes and cannot create them.", "code": "FORBIDDEN"}), 403
    created_by_id = current_user.get("id") or data.get("createdById") or (data.get("created_by_id") or "usr-teacher-1")
    created_by_name = data.get("createdByName") or (data.get("created_by_name") or "User")
    quiz_type = data.get("quizType") or ("teacher" if str(created_by_id).startswith("usr-teacher") else "student")

    # Students may ONLY create private practice quizzes: scope and subject are
    # forced server-side regardless of what the client sends.
    if user_role == "student":
        quiz_type = "student"
        subject_id = "personal"
        subject = None
        subject_name = "Personal Practice"

    questions = data.get("questions") or []
    if not isinstance(questions, list):
        return jsonify({"error": "questions must be a list.", "code": "BAD_REQUEST"}), 400

    # Ownership rule: teacher quizzes may only target a subject the creator manages
    # (or stay subjectless). Admins may target any subject. Students cannot create
    # course quizzes at all.
    if quiz_type == "teacher" and user_role not in ("teacher", "admin"):
        return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
    if quiz_type == "teacher" and user_role == "teacher" and subject_id not in ("", "personal"):
        if not subject or subject.teacher_id != created_by_id:
            return jsonify({"error": "You can only create quizzes in a subject assigned to you.", "code": "FORBIDDEN"}), 403

    new_quiz = QuizModel(
        quiz_id=f"quiz-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        teacher_id=created_by_id,
        title=title,
        description=data.get("description"),
        status="active",
        subject_id=subject_id,
        subject_name=subject_name or "",
        created_by_name=created_by_name,
        quiz_type=quiz_type,
        questions_json=json.dumps(questions),
        is_published=bool(data.get("isPublished", quiz_type == "teacher")),
        time_limit_minutes=int(data.get("timeLimitMinutes") or 15),
        pass_percentage=int(data.get("passPercentage") or 70),
        difficulty=data.get("difficulty") or "medium",
        attempts_allowed=_clamp_attempts(data.get("attemptsAllowed")),
        reveal_answers=_reveal_answers(data.get("revealAnswers")),
        deadline=(data.get("deadline") or None),
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(new_quiz)
    _replace_quiz_questions(new_quiz.quiz_id, questions)
    _commit_or_warn("quiz creation")
    if new_quiz.is_published and quiz_type == "teacher" and subject_id not in ("", "personal"):
        _fan_out_quiz_notification(new_quiz)
        _commit_or_warn("quiz publish notifications")
    log_action(created_by_id, created_by_name, quiz_type, "QUIZ_CREATE", f"Created quiz '{title}'")
    return jsonify(new_quiz.to_dict()), 201

def update_quiz(quiz_id):
    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to quizzes and cannot edit them.", "code": "FORBIDDEN"}), 403

    # Ownership rule: students may only edit their own practice quizzes; teachers
    # may only edit quizzes in subjects they manage; admins unrestricted.
    if role == "student":
        if not (quiz.quiz_type == "student" and quiz.teacher_id == user_id):
            return jsonify({"error": "Only the owner can edit this quiz.", "code": "FORBIDDEN"}), 403
        data_probe = request.json or {}
        for forbidden in ("subjectId", "subjectName", "quizType", "isPublished"):
            if forbidden in data_probe:
                return jsonify({"error": "Practice quizzes cannot change subject, type, or visibility.", "code": "FORBIDDEN"}), 403
    elif role == "teacher":
        if quiz.subject_id and quiz.subject_id != "personal":
            subject = db.session.get(SubjectModel, quiz.subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only edit quizzes from a subject assigned to you.", "code": "FORBIDDEN"}), 403
        elif quiz.teacher_id != user_id:
            # Subjectless draft / legacy "personal" practice quizzes belong to
            # their creator only; other teachers may not edit them.
            return jsonify({"error": "You can only edit quizzes you created.", "code": "FORBIDDEN"}), 403
    elif role != "admin":
        return jsonify({"error": "Only the owner can edit this quiz.", "code": "FORBIDDEN"}), 403

    data = request.json or {}
    publish_changed = False
    if "title" in data and data.get("title"):
        quiz.title = data["title"]
    if "description" in data:
        quiz.description = data.get("description")
    if "subjectId" in data:
        new_subject_id = data["subjectId"]
        # Ownership rule: teachers may only assign a quiz to a subject they manage,
        # or move it to a subjectless draft ("") / legacy personal practice.
        if role == "teacher" and new_subject_id not in ("", "personal"):
            subject = db.session.get(SubjectModel, new_subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only assign quizzes to a subject assigned to you.", "code": "FORBIDDEN"}), 403
        quiz.subject_id = new_subject_id
        # Assigning a subject NEVER publishes a quiz: publishing is an explicit,
        # deliberate action that appears only once a quiz is subject-assigned.
        # (See the "isPublished" block below, which still guards against
        # publishing a subjectless quiz.)
    if "subjectName" in data:
        quiz.subject_name = data["subjectName"]
    if "quizType" in data:
        quiz.quiz_type = data["quizType"]
    if "timeLimitMinutes" in data:
        quiz.time_limit_minutes = int(data.get("timeLimitMinutes") or 15)
    if "passPercentage" in data:
        quiz.pass_percentage = int(data.get("passPercentage") or 70)
    if "difficulty" in data:
        quiz.difficulty = data.get("difficulty") or "medium"
    if "attemptsAllowed" in data:
        quiz.attempts_allowed = _clamp_attempts(data.get("attemptsAllowed"))
    if "revealAnswers" in data:
        quiz.reveal_answers = _reveal_answers(data.get("revealAnswers"))
    if "deadline" in data:
        quiz.deadline = data.get("deadline") or None
    if "questions" in data:
        qs = data.get("questions") or []
        if not isinstance(qs, list):
            return jsonify({"error": "questions must be a list.", "code": "BAD_REQUEST"}), 400
        quiz.questions_json = json.dumps(qs)
        _replace_quiz_questions(quiz.quiz_id, qs)
    if "isPublished" in data and data.get("isPublished") != quiz.is_published and role not in ("teacher", "admin"):
        return jsonify({"error": "Only instructors can publish or unpublish quizzes.", "code": "FORBIDDEN"}), 403
    if "isPublished" in data:
        was_published = bool(quiz.is_published)
        if bool(data.get("isPublished")) and not quiz.subject_id:
            return jsonify({"error": "Assign this quiz to a subject before publishing it.", "code": "SUBJECT_REQUIRED"}), 400
        quiz.is_published = bool(data.get("isPublished"))
        publish_changed = quiz.is_published != was_published

    _commit_or_warn("quiz update")
    if publish_changed:
        log_action(user_id or quiz.teacher_id, quiz.created_by_name or "", quiz.quiz_type or "teacher",
                   "QUIZ_PUBLISH" if quiz.is_published else "QUIZ_UNPUBLISH",
                   f"{'Published' if quiz.is_published else 'Unpublished'} quiz '{quiz.title}'")
        if quiz.is_published and quiz.quiz_type == "teacher":
            _fan_out_quiz_notification(quiz)
            _commit_or_warn("quiz publish notifications")
    log_action(user_id or quiz.teacher_id, quiz.created_by_name or "", quiz.quiz_type or "teacher", "QUIZ_UPDATE", f"Updated quiz '{quiz.title}'")
    return jsonify(quiz.to_dict()), 200

def delete_quiz(quiz_id):
    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to quizzes and cannot delete them.", "code": "FORBIDDEN"}), 403

    # Ownership rule mirrors update_quiz: students may only delete their own
    # practice quizzes; teachers only quizzes in subjects they manage; admins any.
    if role == "student":
        if not (quiz.quiz_type == "student" and quiz.teacher_id == user_id):
            return jsonify({"error": "Only the owner can delete this quiz.", "code": "FORBIDDEN"}), 403
    elif role == "teacher":
        if quiz.subject_id and quiz.subject_id != "personal":
            subject = db.session.get(SubjectModel, quiz.subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only delete quizzes from a subject assigned to you.", "code": "FORBIDDEN"}), 403
        elif quiz.teacher_id != user_id:
            # Subjectless draft / legacy "personal" practice quizzes belong to
            # their creator only; other teachers may not delete them.
            return jsonify({"error": "You can only delete quizzes you created.", "code": "FORBIDDEN"}), 403
    elif role != "admin":
        return jsonify({"error": "Only the owner can delete this quiz.", "code": "FORBIDDEN"}), 403

    QuizAttemptModel.query.filter_by(quiz_id=quiz_id).delete(synchronize_session=False)
    QuizQuestionModel.query.filter_by(quiz_id=quiz_id).delete(synchronize_session=False)
    db.session.delete(quiz)
    _commit_or_warn("quiz deletion")
    log_action(user_id or quiz.teacher_id, quiz.created_by_name or "", quiz.quiz_type or "teacher",
               "QUIZ_DELETE", f"Deleted quiz '{quiz.title}'")
    return jsonify({"success": True}), 200

def _public_quiz_payload(quiz, requester_role):
    """Quiz dict for the list endpoint.

    Students never receive the answer key of teacher-authored quizzes before
    submitting: grading happens server-side, so exposing correctAnswer (and the
    explanation, which usually spells out the answer) upfront would leak it.
    Practice quizzes still return the key to their own author, and teachers/admins
    keep full fidelity.
    """
    d = quiz.to_dict()
    if requester_role == "student" and quiz.quiz_type == "teacher":
        d["questions"] = [
            {k: v for k, v in q.items() if k not in ("correctAnswer", "explanation")}
            for q in (d.get("questions") or [])
        ]
    return d

def submit_quiz_attempt(quiz_id):
    """Grades a submitted quiz and persists a QuizAttempt for analytics."""
    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""

    # Who may submit: admins anywhere; the teacher previewing their OWN course
    # quizzes; students enrolled in the quiz's subject (course quizzes) or the
    # owner of a practice quiz.
    if role == "teacher":
        if quiz.quiz_type == "student" or quiz.teacher_id != user_id:
            return jsonify({"error": "You can only submit your own course quizzes.", "code": "FORBIDDEN"}), 403
    elif role == "student":
        if quiz.quiz_type == "student":
            if quiz.teacher_id != user_id:
                return jsonify({"error": "You can only submit your own practice quizzes.", "code": "FORBIDDEN"}), 403
        elif quiz.subject_id in ("", "personal"):
            # A subjectless / "personal" teacher draft has no enrolling class,
            # so only its creator may submit it (as a preview).
            if quiz.teacher_id != user_id:
                return jsonify({"error": "You can only submit your own quizzes.", "code": "FORBIDDEN"}), 403
        else:
            enrolled = StudentSubjectModel.query.filter_by(subject_id=quiz.subject_id, student_id=user_id).first()
            if not enrolled:
                return jsonify({"error": "You must be enrolled in this subject to submit the quiz.", "code": "NOT_ENROLLED"}), 403
    elif role != "admin":
        return jsonify({"error": "You do not have permission to submit this quiz.", "code": "FORBIDDEN"}), 403

    # Deadline enforcement: students cannot submit after the quiz deadline.
    if quiz.deadline and role != "admin":
        try:
            dl = str(quiz.deadline).replace("Z", "+00:00")
            deadline_dt = datetime.datetime.fromisoformat(dl)
            now_dt = datetime.datetime.now(deadline_dt.tzinfo) if deadline_dt.tzinfo else datetime.datetime.now(datetime.timezone.utc)
            if now_dt > deadline_dt:
                return jsonify({"error": "The deadline for this quiz has passed. It was recorded as Missing.", "code": "DEADLINE_PASSED"}), 409
        except ValueError:
            pass

    try:
        questions = _quiz_questions_for(quiz.quiz_id)
        if questions is None:
            questions = json.loads(quiz.questions_json)
        else:
            questions = _merge_questions_json(questions, quiz.questions_json)
    except Exception:
        questions = []

    data = request.json or {}
    payload_answers = data.get("answers") or data.get("userAnswers") or []
    # Attribution always comes from the verified token, never from the body:
    # a client-supplied studentId could otherwise forge attempts for peers.
    student_id = user_id
    student_name = current_user.get("name") or "Student"
    time_taken = int(data.get("timeTaken") or 0)
    pass_percentage = quiz.pass_percentage or 70

    # Attempt limit: teacher quizzes with a configured cap reject submissions once
    # the student has exhausted their allowed attempts. Practice quizzes and
    # uncapped (0) quizzes stay unlimited.
    if quiz.quiz_type == "teacher" and (quiz.attempts_allowed or 0) > 0:
        used = QuizAttemptModel.query.filter_by(quiz_id=quiz_id, student_id=student_id).count()
        if used >= quiz.attempts_allowed:
            return jsonify({
                "error": "You have reached the maximum number of attempts allowed for this quiz.",
                "code": "ATTEMPTS_EXHAUSTED",
                "attemptsUsed": used,
                "attemptsAllowed": quiz.attempts_allowed,
            }), 409

    if not isinstance(payload_answers, list):
        payload_answers = []

    q_by_id = {}
    for idx, q in enumerate(questions):
        q_by_id.setdefault(str(q.get("id")), q)
        q_by_id.setdefault(str(idx), q)

    score = 0
    feedback = []
    weak_topics = []
    strong_topics = []
    for q_idx, q in enumerate(questions):
        qid = str(q.get("id"))
        selected = None
        for ua in payload_answers:
            ua_qid = str(ua.get("questionId") or ua.get("id"))
            if ua_qid == qid or ua_qid == str(q_idx):
                selected = ua.get("selectedAnswer") or ua.get("answer")
                break

        correct = q.get("correctAnswer")
        options = q.get("options") or []
        if isinstance(correct, list):
            # Multiple-correct-answer question: exact set match wins.
            selected_items = selected if isinstance(selected, list) else [selected]
            selected_idx = [_answer_index(s, options) for s in selected_items]
            correct_idx = [_answer_index(c, options) for c in correct]
            if (not selected_idx or not correct_idx
                    or any(i is None for i in selected_idx) or any(i is None for i in correct_idx)):
                is_correct = False
                correct_idx = None
            else:
                is_correct = set(selected_idx) == set(correct_idx)
        elif not options:
            is_correct = (
                selected is not None
                and correct is not None
                and str(selected).strip().lower() == str(correct).strip().lower()
            )
            correct_idx = None
        else:
            selected_idx = _answer_index(selected, options)
            correct_idx = _answer_index(correct, options)
            is_correct = selected_idx is not None and correct_idx is not None and selected_idx == correct_idx
        if is_correct:
            score += 1

        correct_text = ""
        if isinstance(correct_idx, list):
            correct_text = ", ".join(str(options[i]) for i in correct_idx if i is not None)
        elif correct_idx is not None:
            correct_text = str(options[correct_idx])
        elif isinstance(correct, str):
            correct_text = correct

        topic = q.get("topicTag") or "General Concepts"
        if is_correct:
            if topic not in strong_topics:
                strong_topics.append(topic)
        elif topic not in weak_topics:
            weak_topics.append(topic)

        feedback.append({
            "questionId": qid,
            "question": q.get("question", ""),
            "options": options,
            "userAnswer": selected,
            "correctAnswer": correct,
            "isCorrect": is_correct,
            "explanation": q.get("explanation") or (
                f"The correct answer is {correct_text or 'the option highlighted as correct'}."
            ),
            "topic": topic,
            "bloomsLevel": q.get("bloomsLevel", ""),
            "difficulty": q.get("difficulty", "")
        })

    max_score = len(questions)
    percentage = round((score / max_score) * 100, 1) if max_score else 0.0
    passed = percentage >= pass_percentage

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    attempt = QuizAttemptModel(
        attempt_id=f"att-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        quiz_id=quiz_id,
        student_id=student_id,
        attempt_status="Completed",
        score=score,
        time_taken=time_taken or 300,
        submitted_at=now_str,
        quiz_title=quiz.title,
        student_name=student_name,
        subject_id=quiz.subject_id,
        subject_name=quiz.subject_name,
        max_score=max_score,
        percentage=percentage,
        passed=passed,
        answers_json=json.dumps(feedback),
        weak_topics_json=json.dumps(weak_topics),
        strong_topics_json=json.dumps(strong_topics)
    )
    db.session.add(attempt)
    _commit_or_warn("quiz attempt")

    # --- Progress model upsert (student_progress table) ---
    # Only persist for real course subjects; skip subjectless/personal quizzes
    # because student_progress.subject_id is a required FK to subjects.
    try:
        subject_id = quiz.subject_id
        if subject_id and subject_id not in ("", "personal"):
            total_quizzes = QuizModel.query.filter_by(subject_id=subject_id).count()
            attempted_rows = (
                QuizAttemptModel.query.filter_by(student_id=student_id, subject_id=subject_id)
                .with_entities(QuizAttemptModel.quiz_id)
                .distinct()
                .all()
            )
            attempted_quizzes = len(attempted_rows)
            completion_percentage = (
                round((attempted_quizzes / total_quizzes) * 100, 1) if total_quizzes else 0.0
            )

            subject_attempts = (
                QuizAttemptModel.query.filter_by(student_id=student_id, subject_id=subject_id)
                .order_by(QuizAttemptModel.submitted_at.desc())
                .all()
            )
            latest_by_quiz = {}
            for a in subject_attempts:
                if a.quiz_id not in latest_by_quiz:
                    latest_by_quiz[a.quiz_id] = float(a.percentage or 0)
            average_score = (
                round(sum(latest_by_quiz.values()) / len(latest_by_quiz), 1)
                if latest_by_quiz else 0.0
            )

            if average_score >= 80:
                learning_level = "Advanced"
            elif average_score >= 60:
                learning_level = "Intermediate"
            else:
                learning_level = "Beginner"

            progress_id = f"prog-{student_id}-{subject_id}"
            prog = db.session.get(StudentProgressModel, progress_id)
            if prog is None:
                prog = StudentProgressModel(
                    progress_id=progress_id,
                    student_id=student_id,
                    subject_id=subject_id,
                )
            prog.completion_percentage = completion_percentage
            prog.average_score = average_score
            prog.learning_level = learning_level
            prog.updated_at = now_str
            prog.last_activity = now_str
            db.session.add(prog)
            _commit_or_warn("student progress")
    except Exception as e:
        print("[Database] Could not upsert student progress:", e)

    log_action(student_id, student_name, "student", "QUIZ_SUBMIT",
               f"Submitted '{quiz.title}' — {score}/{max_score} ({percentage}%)")

    response_attempt = attempt.to_dict()
    # Answer-reveal gate: when the teacher disabled "students can see correct
    # answers", strip the correct answer + explanation from the student-facing
    # response (the stored attempt keeps the full record for grading views).
    if quiz.reveal_answers is False:
        for fb in response_attempt.get("feedback") or []:
            if isinstance(fb, dict):
                fb.pop("correctAnswer", None)
                fb.pop("explanation", None)
                fb.pop("options", None)

    return jsonify({"attempt": response_attempt}), 200

