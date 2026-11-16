"""Analytics regression tests: unique students and latest-attempt grading."""

import json

from app import db
from models import QuizAttemptModel, UserModel
from services.analytics_service import _latest_attempts_by_student_quiz
from tests.conftest import auth_headers_for


def _add_attempt(attempt_id, quiz_id, student_id, subject_id, percentage, passed, submitted_at):
    db.session.add(QuizAttemptModel(
        attempt_id=attempt_id,
        quiz_id=quiz_id,
        student_id=student_id,
        subject_id=subject_id,
        subject_name="Intro to CS",
        quiz_title="Quiz 1",
        student_name="Alice Smith",
        score=int(percentage),
        max_score=10,
        percentage=percentage,
        passed=passed,
        answers_json="[]",
        weak_topics_json="[]",
        strong_topics_json="[]",
        submitted_at=submitted_at,
    ))
    db.session.commit()


def test_latest_attempts_by_student_quiz_ignores_earlier_retakes(init_database):
    attempts = [
        QuizAttemptModel(attempt_id="a1", quiz_id="q1", student_id="s1", percentage=60.0, passed=True, submitted_at="2026-01-01T10:00:00Z"),
        QuizAttemptModel(attempt_id="a2", quiz_id="q1", student_id="s1", percentage=90.0, passed=True, submitted_at="2026-01-02T10:00:00Z"),
        QuizAttemptModel(attempt_id="a3", quiz_id="q2", student_id="s1", percentage=50.0, passed=False, submitted_at="2026-01-03T10:00:00Z"),
    ]
    latest = _latest_attempts_by_student_quiz(attempts)

    assert set(latest.keys()) == {("s1", "q1"), ("s1", "q2")}
    assert latest[("s1", "q1")].percentage == 90.0
    assert latest[("s1", "q2")].percentage == 50.0


def test_teacher_analytics_uses_unique_students_and_latest_attempts(client, init_database, app_instance):
    with app_instance.app_context():
        teacher = db.session.get(UserModel, "tea-1")
        headers = auth_headers_for(teacher)

    _add_attempt("att-1-retake", "qz-1", "stu-1", "sub-1", 90.0, True, "2026-01-20T10:00:00Z")

    resp = client.get("/api/analytics/teacher?teacherId=tea-1", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()

    assert data["totals"]["studentCount"] == 1
    assert data["totals"]["attempts"] == 2
    assert data["totals"]["averageScore"] == 75
    assert data["totals"]["passRate"] == 50
    assert data["totals"]["atRiskCount"] == 0

    sub1 = next(s for s in data["subjects"] if s["subjectId"] == "sub-1")
    assert sub1["studentCount"] == 1
    assert sub1["attempts"] == 2
    assert sub1["averageScore"] == 75
    assert sub1["passRate"] == 50
    assert sub1["atRiskStudents"] == []


def test_teacher_analytics_counts_at_risk_student_once_across_subjects(client, init_database, app_instance):
    with app_instance.app_context():
        teacher = db.session.get(UserModel, "tea-1")
        headers = auth_headers_for(teacher)

    db.session.add(QuizAttemptModel(
        attempt_id="att-sub2-latest",
        quiz_id="qz-1",
        student_id="stu-1",
        subject_id="sub-2",
        subject_name="Data Structures",
        quiz_title="Quiz 1",
        student_name="Alice Smith",
        score=6,
        max_score=10,
        percentage=60.0,
        passed=False,
        answers_json="[]",
        weak_topics_json="[]",
        strong_topics_json="[]",
        submitted_at="2026-01-21T10:00:00Z",
    ))
    db.session.commit()

    resp = client.get("/api/analytics/teacher?teacherId=tea-1", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()

    # stu-1 remains one unique student despite enrollment in two subjects.
    assert data["totals"]["studentCount"] == 1
    # stu-1 is at risk in sub-2 but deduplicated in the institution-wide count.
    assert data["totals"]["atRiskCount"] == 1
    at_risk_subjects = [s for s in data["subjects"] if s["atRiskStudents"]]
    assert len(at_risk_subjects) == 1
    assert at_risk_subjects[0]["subjectId"] == "sub-2"
    assert at_risk_subjects[0]["atRiskStudents"][0]["id"] == "stu-1"


def test_teacher_cannot_view_another_teacher_analytics(client, init_database, app_instance):
    with app_instance.app_context():
        other = db.session.get(UserModel, "tea-1")
        headers = auth_headers_for(other)

    resp = client.get("/api/analytics/teacher?teacherId=tea-2", headers=headers)
    assert resp.status_code == 403


def test_admin_analytics_uses_unique_students_and_latest_attempts(client, init_database, app_instance):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    _add_attempt("att-admin-retake", "qz-1", "stu-1", "sub-1", 90.0, True, "2026-01-22T10:00:00Z")

    resp = client.get("/api/analytics/admin", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()

    assert data["totals"]["studentCount"] == 1
    assert data["totals"]["attempts"] == 2
    assert data["totals"]["averageScore"] == 75
    assert data["totals"]["passRate"] == 50
    assert data["totals"]["atRiskCount"] == 0
