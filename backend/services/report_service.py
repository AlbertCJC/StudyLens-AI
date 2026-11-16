"""Academic report aggregation."""

import json

from extensions import db
from models import (
    AIGeneratedContentModel,
    ActivityLogModel,
    MaterialModel,
    QuizAttemptModel,
    QuizModel,
    StudentProgressModel,
    StudentSubjectModel,
    SubjectModel,
    UserModel,
)

REPORT_TYPES = ("Student Performance", "Quiz Analytics", "Subject Summary", "AI Usage")


def _build_report_summary(report_type, target_id="", teacher_id="", role=""):
    """Aggregates academic data into a structured report summary.

    When teacher_id is provided the report is scoped to that teacher's own
    subjects, students, quizzes, and AI-generated content. When target_id is
    omitted for Student Performance and the caller is a teacher or admin, the
    summary aggregates every student the caller may see.
    """
    subject_ids = set()
    teacher_quiz_ids = set()
    enrolled_student_ids = set()
    own_ai_query = None
    if teacher_id:
        subject_ids = {s.subject_id for s in SubjectModel.query.filter_by(teacher_id=teacher_id).all()}
        teacher_quiz_ids = {q.quiz_id for q in QuizModel.query.filter_by(teacher_id=teacher_id).all()}
        enrolled_student_ids = {
            e.student_id
            for e in StudentSubjectModel.query.all()
            if e.subject_id in subject_ids
        }
        own_ai_query = AIGeneratedContentModel.query.filter_by(generated_by=teacher_id)

    if report_type == "Student Performance":
        if target_id:
            student = db.session.get(UserModel, target_id)
            if not student:
                return {"error": "A valid student is required for a Student Performance report.", "code": "BAD_REQUEST"}, 400
            if teacher_id and target_id not in enrolled_student_ids:
                return {"error": "This student is not enrolled in any of your subjects.", "code": "FORBIDDEN"}, 403
            attempts = QuizAttemptModel.query.filter_by(student_id=target_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
            if teacher_id:
                attempts = [a for a in attempts if a.subject_id in subject_ids or a.quiz_id in teacher_quiz_ids]
            total = len(attempts)
            avg = round(sum(a.percentage or 0 for a in attempts) / total) if total else 0
            passed = sum(1 for a in attempts if a.passed)
            weak, strong = [], []
            for att in attempts:
                try: weak += json.loads(att.weak_topics_json) or []
                except Exception: pass
                try: strong += json.loads(att.strong_topics_json) or []
                except Exception: pass
            progress_rows = StudentProgressModel.query.filter_by(student_id=target_id).all()
            summary = {
                "studentId": target_id,
                "studentName": (student.first_name or "") + (" " + student.last_name if student.last_name else ""),
                "quizzesTaken": total,
                "averageScore": avg,
                "passRate": round(passed / total * 100) if total else 0,
                "weakTopics": list(dict.fromkeys(weak)),
                "strongTopics": list(dict.fromkeys(strong)),
                "subjects": [
                    {"subjectId": p.subject_id, "completionPercentage": p.completion_percentage, "averageScore": p.average_score, "learningLevel": p.learning_level}
                    for p in progress_rows
                ],
                "recentAttempts": [a.to_dict() for a in attempts][:10],
            }
            return summary, 200

        if teacher_id:
            candidate_ids = sorted(enrolled_student_ids)
        elif role == "admin":
            candidate_ids = sorted({u.user_id for u in UserModel.query.filter_by(role="student").all()})
        else:
            return {"error": "A valid student is required for a Student Performance report.", "code": "BAD_REQUEST"}, 400

        student_rows = []
        aggregate_attempts = []
        for sid in candidate_ids:
            student = db.session.get(UserModel, sid)
            if not student:
                continue
            attempts = QuizAttemptModel.query.filter_by(student_id=sid).order_by(QuizAttemptModel.submitted_at.desc()).all()
            if teacher_id:
                attempts = [a for a in attempts if a.subject_id in subject_ids or a.quiz_id in teacher_quiz_ids]
            total = len(attempts)
            avg = round(sum(a.percentage or 0 for a in attempts) / total) if total else 0
            passed = sum(1 for a in attempts if a.passed)
            aggregate_attempts.extend(attempts)
            student_rows.append({
                "studentId": sid,
                "studentName": (student.first_name or "") + (" " + student.last_name if student.last_name else ""),
                "quizzesTaken": total,
                "averageScore": avg,
                "passRate": round(passed / total * 100) if total else 0,
                "recentAttempts": [a.to_dict() for a in attempts][:5],
            })
        student_rows.sort(key=lambda r: r["studentName"].lower())
        total = len(aggregate_attempts)
        avg = round(sum(a.percentage or 0 for a in aggregate_attempts) / total) if total else 0
        passed = sum(1 for a in aggregate_attempts if a.passed)
        summary = {
            "allStudents": True,
            "studentCount": len(student_rows),
            "quizzesTaken": total,
            "averageScore": avg,
            "passRate": round(passed / total * 100) if total else 0,
            "students": student_rows,
        }
        return summary, 200

    if report_type == "Quiz Analytics":
        attempts = QuizAttemptModel.query.order_by(QuizAttemptModel.submitted_at.desc()).all()
        if teacher_id:
            attempts = [a for a in attempts if a.subject_id in subject_ids or a.quiz_id in teacher_quiz_ids]
        if target_id:
            attempts = [a for a in attempts if a.quiz_id == target_id]
        quiz_totals = {}
        for a in attempts:
            key = a.quiz_id
            q = quiz_totals.setdefault(key, {"quizId": key, "quizTitle": a.quiz_title, "subjectName": a.subject_name, "attempts": 0, "totalScore": 0.0, "passed": 0, "scores": []})
            q["attempts"] += 1
            q["totalScore"] += a.percentage or 0
            q["passed"] += 1 if a.passed else 0
            q["scores"].append(a.percentage or 0)
        quiz_rows = []
        for q in quiz_totals.values():
            quiz_rows.append({
                "quizId": q["quizId"],
                "quizTitle": q["quizTitle"],
                "subjectName": q["subjectName"],
                "attempts": q["attempts"],
                "averageScore": round(q["totalScore"] / q["attempts"]) if q["attempts"] else 0,
                "passRate": round(q["passed"] / q["attempts"] * 100) if q["attempts"] else 0,
                "highestScore": round(max(q["scores"])) if q["scores"] else 0,
                "lowestScore": round(min(q["scores"])) if q["scores"] else 0,
            })
        # Attempt-weighted overall average (not an average of per-quiz averages)
        weighted_avg = round(sum(a.percentage or 0 for a in attempts) / len(attempts)) if attempts else 0
        summary = {
            "totalAttempts": len(attempts),
            "quizzes": quiz_rows,
            "overallAverage": weighted_avg,
        }
        return summary, 200

    if report_type == "Subject Summary":
        subjects = SubjectModel.query.all()
        if teacher_id:
            subjects = [s for s in subjects if s.subject_id in subject_ids]
        if target_id:
            subjects = [s for s in subjects if s.subject_id == target_id]
        rows = []
        for sub in subjects:
            materials = MaterialModel.query.filter_by(subject_id=sub.subject_id).count()
            quizzes = QuizModel.query.filter_by(subject_id=sub.subject_id).count()
            attempts = QuizAttemptModel.query.filter_by(subject_id=sub.subject_id).all()
            avg = round(sum(a.percentage or 0 for a in attempts) / len(attempts)) if attempts else 0
            passed = sum(1 for a in attempts if a.passed)
            # AI items linked to this subject's mirrored materials
            material_rows = MaterialModel.query.filter_by(subject_id=sub.subject_id).all()
            material_ids = [m.material_id for m in material_rows]
            ai_items = AIGeneratedContentModel.query.filter(
                AIGeneratedContentModel.material_id.in_(material_ids)
            ).all() if material_ids else []
            ai_total = len(ai_items)
            rows.append({
                "subjectId": sub.subject_id,
                "subjectName": f"{sub.subject_code} - {sub.subject_name}",
                "teacherName": sub.teacher_name,
                "materials": materials,
                "quizzes": quizzes,
                "aiGeneratedItems": ai_total,
                "quizAttempts": len(attempts),
                "averageScore": avg,
                "passRate": round(passed / len(attempts) * 100) if attempts else 0,
            })
        summary = {"subjects": rows}
        return summary, 200

    # AI Usage
    items = own_ai_query.all() if own_ai_query is not None else AIGeneratedContentModel.query.all()
    by_type = {}
    for item in items:
        content_type = item.content_type or "Unknown"
        by_type[content_type] = by_type.get(content_type, 0) + 1
    if teacher_id:
        quiz_count = QuizModel.query.filter_by(teacher_id=teacher_id).count()
        ai_quiz_count = QuizModel.query.filter_by(teacher_id=teacher_id, quiz_type="student").count()
        generate_logs = ActivityLogModel.query.filter(
            ActivityLogModel.user_id == teacher_id,
            ActivityLogModel.activity.in_(["AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE"]),
        ).count()
    else:
        quiz_count = QuizModel.query.count()
        ai_quiz_count = QuizModel.query.filter_by(quiz_type="student").count()
        generate_logs = ActivityLogModel.query.filter(ActivityLogModel.activity.in_(["AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE"])).count()
    if ai_quiz_count:
        by_type = {**by_type, "Quiz": by_type.get("Quiz", 0) + ai_quiz_count}
    summary = {
        "totalGenerated": sum(by_type.values()),
        "quizCount": quiz_count,
        "generationEvents": generate_logs,
        "breakdown": {k: v for k, v in sorted(by_type.items(), key=lambda kv: -kv[1])},
    }
    return summary, 200
