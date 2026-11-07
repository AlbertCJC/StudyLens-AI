"""Subject-domain helpers."""

import datetime
import json

from models import QuizModel


def _missing_attempt_entries(subject_id, student_id, student_name, own_dicts):
    """Synthetic 0% 'Missing' grade rows for published course quizzes whose
    deadline has passed without any attempt by the given student."""
    attempted = {a.get("quizId") for a in own_dicts}
    quizzes = (QuizModel.query
               .filter_by(subject_id=subject_id, quiz_type="teacher", is_published=True)
               .all())
    out = []
    for qz in quizzes:
        if not qz.deadline or qz.quiz_id in attempted:
            continue
        try:
            dl = str(qz.deadline).replace("Z", "+00:00")
            dl_dt = datetime.datetime.fromisoformat(dl)
            now_dt = datetime.datetime.now(dl_dt.tzinfo) if dl_dt.tzinfo else datetime.datetime.now(datetime.timezone.utc)
            if now_dt <= dl_dt:
                continue
        except ValueError:
            continue
        try:
            qs = json.loads(qz.questions_json) if qz.questions_json else []
        except Exception:
            qs = []
        max_score = 0
        for qq in qs:
            try:
                max_score += int(qq.get("points") or qq.get("maxPoints") or 1)
            except Exception:
                max_score += 1
        total = max_score or len(qs) or 1
        out.append({
            "id": f"missing-{qz.quiz_id}-{student_id}",
            "quizId": qz.quiz_id,
            "quizTitle": qz.title,
            "studentId": student_id,
            "studentName": student_name,
            "subjectId": subject_id,
            "subjectName": qz.subject_name,
            "score": 0,
            "maxScore": total,
            "totalPoints": total,
            "percentage": 0,
            "passed": False,
            "timeTaken": 0,
            "answers": [],
            "feedback": [],
            "weakTopics": [],
            "strongTopics": [],
            "submittedAt": str(qz.deadline),
            "completedAt": str(qz.deadline),
            "status": "Missing"
        })
    return out
