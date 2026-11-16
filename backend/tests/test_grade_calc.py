"""Subject grade calculation (P2-10): refactored, no walrus expression."""

from controllers.subjects_controller import get_subject_grades
from services.analytics_service import _latest_attempt_percentages


def test_latest_attempt_percentages_is_pure(app_instance, init_database):
    """_latest_attempt_percentages returns latest % per quiz, no side effects."""
    with app_instance.app_context():
        from models import QuizAttemptModel
        attempts = QuizAttemptModel.query.filter_by(subject_id="sub-1", student_id="stu-1").all()
        # Two attempts: 80% and 60% -> latest per quiz -> both quizzes represented.
        pcts = _latest_attempt_percentages(attempts)
        assert sorted(pcts) == [60.0, 80.0]
        # Pure: calling twice gives the same result.
        assert _latest_attempt_percentages(attempts) == pcts


def test_latest_attempt_percentages_empty():
    assert _latest_attempt_percentages([]) == []


def _token(app_instance, user):
    from app import generate_token
    token, _ = generate_token({
        "id": user.user_id, "email": user.email, "role": user.role,
        "tokenVersion": user.token_version or 0,
    })
    return token


def test_subject_grades_teacher_roster(app_instance, init_database):
    """Teacher sees a per-student roster with averagePercentage (no walrus)."""
    with app_instance.app_context():
        from models import UserModel
        teacher = UserModel.query.filter_by(user_id="tea-1").first()
        token = _token(app_instance, teacher)

    with app_instance.test_client() as client:
        resp = client.get(f"/api/subjects/sub-1/grades", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.get_data(as_text=True)
        body = resp.get_json()
        assert body["subjectId"] == "sub-1"
        assert "students" in body
        # stu-1 has 80% and 60% -> average 70.
        stu = next(s for s in body["students"] if s["studentId"] == "stu-1")
        assert stu["averagePercentage"] == 70


def test_subject_grades_student_own(app_instance, init_database):
    """Student sees their own grades with averagePercentage."""
    with app_instance.app_context():
        from models import UserModel
        student = UserModel.query.filter_by(user_id="stu-1").first()
        token = _token(app_instance, student)

    with app_instance.test_client() as client:
        resp = client.get(f"/api/subjects/sub-1/grades", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.get_data(as_text=True)
        body = resp.get_json()
        assert body["averagePercentage"] == 70
