"""Student progress, recommendations and staff analytics handlers."""

import datetime
import json

from flask import jsonify, request

from extensions import db
from models import (
    AIGeneratedContentModel,
    MaterialModel,
    QuizAttemptModel,
    QuizModel,
    StudentSubjectModel,
    SubjectModel,
    UserModel,
)
from services.access_service import _can_view_student_data
from services.analytics_service import (
    MASTERY_THRESHOLD,
    _accuracy_before_latest_tagged_attempt,
    _aggregate_topic_performance,
    _first_match_for_topic,
    _latest_attempt_percentages,
)


def get_student_progress(student_id):
    """Aggregated student progress, shaped like src/types.ts StudentProgress."""
    current_user = getattr(request, "current_user", None) or {}
    if not _can_view_student_data(current_user, student_id):
        return jsonify({
            "error": "You do not have permission to view this student's progress.",
            "code": "FORBIDDEN",
        }), 403
    student = db.session.get(UserModel, student_id)
    if not student or student.role != "student":
        return jsonify({"error": "Student not found.", "code": "NOT_FOUND"}), 404
    try:
        limit = int(request.args.get("limit", 10))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        limit, offset = 10, 0
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    attempts = QuizAttemptModel.query.filter_by(student_id=student_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
    # "Quizzes completed" counts distinct quizzes, not raw attempts (retakes
    # of the same quiz do not multiply the stat).
    total = len({a.quiz_id for a in attempts})

    topic_map = _aggregate_topic_performance(attempts)
    topic_performances = [
        {
            "topic": t,
            "totalQuestions": d["total"],
            "correctAnswers": d["correct"],
            "accuracyPercentage": d["accuracyPercentage"],
        }
        for t, d in topic_map.items()
    ]

    weak, strong = [], []
    for att in attempts:
        try:
            weak += json.loads(att.weak_topics_json) or []
            strong += json.loads(att.strong_topics_json) or []
        except Exception:
            continue

    # Accuracy-driven weak list: a topic only stays "weak" while its lifetime
    # accuracy sits below the mastery bar. Topics that were missed before but
    # are now at/above the bar move to masteredTopics so students can see
    # tangible proof they overcame them.
    historical_weak = list(dict.fromkeys(weak))
    if topic_map:
        current_weak = [
            t for t, d in topic_map.items()
            if d["total"] > 0 and d["accuracyPercentage"] < MASTERY_THRESHOLD
        ]
        current_weak.sort(key=lambda t: topic_map.get(t, {}).get("accuracyPercentage", 0))
        mastered = []
        for t in historical_weak:
            if t in current_weak:
                continue
            acc = topic_map.get(t, {}).get("accuracyPercentage", 0)
            if acc < MASTERY_THRESHOLD:
                continue
            mastered.append({
                "topic": t,
                "currentAccuracy": acc,
                "improvedFrom": _accuracy_before_latest_tagged_attempt(attempts, t),
            })
    else:
        # Legacy attempts without per-question data: fall back to stored tags.
        current_weak = historical_weak
        mastered = []

    latest_pcts = _latest_attempt_percentages(attempts)

    payload = {
        "studentId": student_id,
        "totalQuizzesTaken": total,
        "averageScore": round(sum(latest_pcts) / len(latest_pcts)) if latest_pcts else 0,
        "totalPersonalMaterialsUploaded": MaterialModel.query.filter(
            MaterialModel.uploader_role == "student",
            MaterialModel.subject_id.is_(None),
            MaterialModel.teacher_id == student_id,
        ).count(),
        "totalFlashcardDecksGenerated": AIGeneratedContentModel.query.filter(
            AIGeneratedContentModel.content_type == "Flashcard",
            AIGeneratedContentModel.generated_by == student_id,
        ).count(),
        "topicPerformances": topic_performances,
        "weakTopics": current_weak,
        "strongTopics": list(dict.fromkeys(strong)),
        "masteredTopics": mastered,
        "recentQuizAttempts": [a.to_dict() for a in attempts][offset:offset + limit],
        "recentQuizAttemptsHasMore": offset + limit < len(attempts),
    }
    return jsonify(payload)


def get_student_recommendations(student_id):
    """Personalized learning recommendations, shaped like src/types.ts Recommendation.

    Simple content-driven: each weak topic is paired with the first matching
    material, flashcard deck, reviewer, and quiz found in the library, with the
    difficulty derived from the student's actual per-topic accuracy.
    """
    current_user = getattr(request, "current_user", None) or {}
    if not _can_view_student_data(current_user, student_id):
        return jsonify({
            "error": "You do not have permission to view this student's recommendations.",
            "code": "FORBIDDEN",
        }), 403
    student = db.session.get(UserModel, student_id)
    if not student or student.role != "student":
        return jsonify({"error": "Student not found.", "code": "NOT_FOUND"}), 404
    attempts = QuizAttemptModel.query.filter_by(student_id=student_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
    topic_map = _aggregate_topic_performance(attempts)

    stored_weak = []
    for att in attempts:
        try:
            stored_weak += json.loads(att.weak_topics_json) or []
        except Exception:
            continue
    stored_weak = list(dict.fromkeys(stored_weak))

    weak_topics = []
    for t, d in topic_map.items():
        if d["total"] > 0 and d["accuracyPercentage"] < MASTERY_THRESHOLD:
            weak_topics.append(t)
    if not weak_topics:
        weak_topics = stored_weak

    if not weak_topics:
        return jsonify([])

    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    def accuracy_for(topic):
        return topic_map.get(topic, {}).get("accuracyPercentage")

    def difficulty_for(acc):
        if acc is None or acc < 50:
            return "easy"
        if acc < 75:
            return "medium"
        return "hard"

    def steps_for(topic, diff, content):
        mat_target = content["material"]["id"] if content["material"] else content["subjectId"]
        quiz_target = content["quiz"]["id"] if content["quiz"] else content["subjectId"]
        return [
            {"step": 1, "type": "review", "title": f"Quick review: {topic}", "targetId": mat_target, "difficultyTarget": diff},
            {"step": 2, "type": "flashcard", "title": f"Concept flashcards: {topic}", "targetId": content["flashcardId"], "difficultyTarget": "easy"},
            {"step": 3, "type": "reviewer", "title": f"Targeted reviewer: {topic}", "targetId": content["reviewerId"], "difficultyTarget": diff},
            {"step": 4, "type": "quiz", "title": f"Adaptive {diff} quiz on {topic}", "targetId": quiz_target, "difficultyTarget": diff},
        ]

    recommendations = []
    for idx, topic in enumerate(weak_topics, start=1):
        acc = accuracy_for(topic)
        diff = difficulty_for(acc)
        content = _first_match_for_topic(topic)
        steps = steps_for(topic, diff, content)
        quiz_target = content["quiz"]["id"] if content["quiz"] else content["subjectId"]
        recommendations.append({
            "id": f"rec-{idx}",
            "studentId": student_id,
            "weakTopic": topic,
            "recommendationType": "quiz",
            "title": f"Adaptive Practice Quiz: {topic}",
            "description": f"You scored {acc if acc is not None else 'low'}% on {topic}. Retake a targeted {diff} quiz to reinforce these concepts.",
            "targetId": quiz_target,
            "difficultyTarget": diff,
            "accuracyPercentage": acc,
            "createdAt": now,
            "steps": steps,
        })
        recommendations.append({
            "id": f"rec-{idx + 10}",
            "studentId": student_id,
            "weakTopic": topic,
            "recommendationType": "reviewer",
            "title": f"Targeted Reviewer: {topic}",
            "description": f"Consolidate your understanding of {topic} with this focused reviewer before retaking quizzes.",
            "targetId": content["reviewerId"],
            "difficultyTarget": diff,
            "accuracyPercentage": acc,
            "createdAt": now,
            "steps": steps,
        })
    return jsonify(recommendations)


def get_teacher_analytics():
    """Class-level analytics for a teacher: per-subject rollups of student
    performance, weak topics, and at-risk students."""
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") not in ("teacher", "admin"):
        return jsonify({"error": "You do not have permission to view teacher analytics.", "code": "FORBIDDEN"}), 403

    teacher_id = request.args.get("teacherId", "") or ""
    if not teacher_id:
        return jsonify({"error": "teacherId is required.", "code": "BAD_REQUEST"}), 400
    if current_user.get("role") == "teacher" and current_user.get("id") != teacher_id:
        return jsonify({"error": "You can only view your own analytics.", "code": "FORBIDDEN"}), 403

    subjects = SubjectModel.query.filter_by(teacher_id=teacher_id).all()
    rows = []
    total_students = 0
    total_attempts = 0
    total_passed = 0
    total_at_risk = 0
    all_scores = []

    for sub in subjects:
        enrollments = StudentSubjectModel.query.filter_by(subject_id=sub.subject_id).all()
        student_ids = [e.student_id for e in enrollments]
        attempts = QuizAttemptModel.query.filter_by(subject_id=sub.subject_id).all()
        quiz_count = QuizModel.query.filter_by(subject_id=sub.subject_id).count()

        per_student_avg = {}
        for a in attempts:
            per_student_avg.setdefault(a.student_id, []).append(a.percentage)
        at_risk = []
        for sid in student_ids:
            scores = per_student_avg.get(sid, [])
            if not scores:
                continue
            avg = sum(scores) / len(scores)
            if avg < 70:
                stu = db.session.get(UserModel, sid)
                at_risk.append({"id": sid, "name": stu.first_name + " " + stu.last_name if stu else sid, "averageScore": round(avg)})

        weak = []
        for att in attempts:
            try: weak += json.loads(att.weak_topics_json) or []
            except Exception: pass
        weak_counts = {}
        for w in weak:
            weak_counts[w] = weak_counts.get(w, 0) + 1
        top_weak = [t for t, _ in sorted(weak_counts.items(), key=lambda kv: -kv[1])[:5]]

        avg = round(sum(a.percentage for a in attempts) / len(attempts)) if attempts else 0
        passed = sum(1 for a in attempts if a.passed)
        total_students += len(student_ids)
        total_attempts += len(attempts)
        total_passed += passed
        total_at_risk += len(at_risk)
        all_scores += [a.percentage for a in attempts]

        rows.append({
            "subjectId": sub.subject_id,
            "subjectCode": sub.subject_code,
            "subjectName": sub.subject_name,
            "teacherName": sub.teacher_name,
            "studentCount": len(student_ids),
            "quizCount": quiz_count,
            "attempts": len(attempts),
            "averageScore": avg,
            "passRate": round(passed / len(attempts) * 100) if attempts else 0,
            "weakTopics": top_weak,
            "atRiskStudents": at_risk,
        })

    return jsonify({
        "teacherId": teacher_id,
        "subjects": rows,
        "totals": {
            "subjectCount": len(subjects),
            "studentCount": total_students,
            "attempts": total_attempts,
            "averageScore": round(sum(all_scores) / len(all_scores)) if all_scores else 0,
            "passRate": round(total_passed / total_attempts * 100) if total_attempts else 0,
            "atRiskCount": total_at_risk,
        },
    }), 200


def get_admin_analytics():
    """Institution-wide analytics for admins: per-subject rollups across all
    teachers, with institution-wide totals and at-risk students."""
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required.", "code": "FORBIDDEN"}), 403

    subjects = SubjectModel.query.all()
    rows = []
    all_student_ids = set()
    total_attempts = 0
    total_passed = 0
    total_at_risk = 0
    all_scores = []

    for sub in subjects:
        enrollments = StudentSubjectModel.query.filter_by(subject_id=sub.subject_id).all()
        student_ids = [e.student_id for e in enrollments]
        all_student_ids.update(student_ids)
        attempts = QuizAttemptModel.query.filter_by(subject_id=sub.subject_id).all()
        quiz_count = QuizModel.query.filter_by(subject_id=sub.subject_id).count()

        per_student_avg = {}
        for a in attempts:
            per_student_avg.setdefault(a.student_id, []).append(a.percentage)
        at_risk = []
        for sid in student_ids:
            scores = per_student_avg.get(sid, [])
            if not scores:
                continue
            avg = sum(scores) / len(scores)
            if avg < 70:
                stu = db.session.get(UserModel, sid)
                at_risk.append({"id": sid, "name": stu.first_name + " " + stu.last_name if stu else sid, "averageScore": round(avg)})

        weak = []
        for att in attempts:
            try: weak += json.loads(att.weak_topics_json) or []
            except Exception: pass
        weak_counts = {}
        for w in weak:
            weak_counts[w] = weak_counts.get(w, 0) + 1
        top_weak = [t for t, _ in sorted(weak_counts.items(), key=lambda kv: -kv[1])[:5]]

        avg = round(sum(a.percentage for a in attempts) / len(attempts)) if attempts else 0
        passed = sum(1 for a in attempts if a.passed)
        total_attempts += len(attempts)
        total_passed += passed
        total_at_risk += len(at_risk)
        all_scores += [a.percentage for a in attempts]

        rows.append({
            "subjectId": sub.subject_id,
            "subjectCode": sub.subject_code,
            "subjectName": sub.subject_name,
            "teacherName": sub.teacher_name,
            "studentCount": len(student_ids),
            "quizCount": quiz_count,
            "attempts": len(attempts),
            "averageScore": avg,
            "passRate": round(passed / len(attempts) * 100) if attempts else 0,
            "weakTopics": top_weak,
            "atRiskStudents": at_risk,
        })

    return jsonify({
        "subjects": rows,
        "totals": {
            "subjectCount": len(subjects),
            "studentCount": len(all_student_ids),
            "attempts": total_attempts,
            "averageScore": round(sum(all_scores) / len(all_scores)) if all_scores else 0,
            "passRate": round(total_passed / total_attempts * 100) if total_attempts else 0,
            "atRiskCount": total_at_risk,
        },
    }), 200
