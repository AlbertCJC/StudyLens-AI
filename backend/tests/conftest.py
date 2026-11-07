import os
import tempfile

# Must set JWT_SECRET before importing app
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

# Isolate tests from the developer's local database: point the app at a
# throwaway SQLite file so ``db.drop_all()`` can never touch real data.
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.close(_test_db_fd)
os.environ["MYSQL_DATABASE_URL"] = f"sqlite:///{_test_db_path.replace(os.sep, '/')}"

import pytest  # noqa: E402
import jwt  # noqa: E402
from datetime import datetime, timezone, timedelta  # noqa: E402

from app import (  # noqa: E402
    app, db, UserModel, RoleModel, SubjectModel, QuizModel, QuizAttemptModel,
    StudentSubjectModel, AIGeneratedContentModel, MaterialModel, ActivityLogModel, ReportModel,
)
from app import _build_report_summary, generate_token  # noqa: E402


@pytest.fixture
def app_instance():
    """Use the throwaway test database and reset its schema for each test."""
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app_instance):
    """Flask test client."""
    return app_instance.test_client()


@pytest.fixture
def init_database(app_instance):
    """Populate the database with test data."""
    with app_instance.app_context():
        # Create roles
        role_student = RoleModel(role_id=1, role_name="student")
        role_teacher = RoleModel(role_id=2, role_name="teacher")
        role_admin = RoleModel(role_id=3, role_name="admin")
        db.session.add_all([role_student, role_teacher, role_admin])

        # Create users (status must be "active", token_version for JWT validation)
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        student = UserModel(
            user_id="stu-1", role_id=1, role="student",
            first_name="Alice", last_name="Smith",
            email="alice@test.com", password_hash="hash",
            status="active", token_version=0, created_at=now
        )
        teacher = UserModel(
            user_id="tea-1", role_id=2, role="teacher",
            first_name="Bob", last_name="Teacher",
            email="bob@test.com", password_hash="hash",
            status="active", token_version=0, created_at=now
        )
        admin = UserModel(
            user_id="adm-1", role_id=3, role="admin",
            first_name="Carol", last_name="Admin",
            email="carol@test.com", password_hash="hash",
            status="active", token_version=0, created_at=now
        )
        db.session.add_all([student, teacher, admin])

        # Create subjects
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        sub1 = SubjectModel(
            subject_id="sub-1", subject_code="CS101", subject_name="Intro to CS",
            teacher_name="Bob Teacher", teacher_id="tea-1", created_at=now
        )
        sub2 = SubjectModel(
            subject_id="sub-2", subject_code="CS102", subject_name="Data Structures",
            teacher_name="Bob Teacher", teacher_id="tea-1", created_at=now
        )
        db.session.add_all([sub1, sub2])

        # Create enrollments
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        db.session.add(StudentSubjectModel(student_id="stu-1", subject_id="sub-1", date_enrolled=now))
        db.session.add(StudentSubjectModel(student_id="stu-1", subject_id="sub-2", date_enrolled=now))

        # Create quizzes
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        q1 = QuizModel(
            quiz_id="qz-1", title="Quiz 1", subject_id="sub-1", subject_name="Intro to CS",
            teacher_id="tea-1", quiz_type="teacher", pass_percentage=70,
            questions_json='[]', created_at=now
        )
        q2 = QuizModel(
            quiz_id="qz-2", title="Quiz 2", subject_id="sub-1", subject_name="Intro to CS",
            teacher_id="tea-1", quiz_type="teacher", pass_percentage=70,
            questions_json='[]', created_at=now
        )
        db.session.add_all([q1, q2])

        # Create quiz attempts
        db.session.add(QuizAttemptModel(
            attempt_id="att-1", quiz_id="qz-1", student_id="stu-1",
            subject_id="sub-1", subject_name="Intro to CS",
            quiz_title="Quiz 1", student_name="Alice Smith",
            score=8, max_score=10, percentage=80.0, passed=True,
            answers_json='[]', weak_topics_json='[]', strong_topics_json='["Algorithms"]',
            submitted_at="2026-01-15T10:00:00Z"
        ))
        db.session.add(QuizAttemptModel(
            attempt_id="att-2", quiz_id="qz-2", student_id="stu-1",
            subject_id="sub-1", subject_name="Intro to CS",
            quiz_title="Quiz 2", student_name="Alice Smith",
            score=6, max_score=10, percentage=60.0, passed=False,
            answers_json='[]', weak_topics_json='["Databases"]', strong_topics_json='[]',
            submitted_at="2026-01-16T10:00:00Z"
        ))

        # Create AI-generated content
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        db.session.add(AIGeneratedContentModel(
            content_id="ai-1", content_type="Flashcard", title="Flashcard 1",
            generated_by="stu-1", generated_text="Q: What is CS? A: Computer Science",
            created_at=now
        ))
        db.session.add(AIGeneratedContentModel(
            content_id="ai-2", content_type="Summary", title="Summary 1",
            generated_by="tea-1", generated_text="Summary of key concepts",
            created_at=now
        ))

        db.session.commit()
        yield


def auth_headers_for(user):
    """Generate auth headers for a user using the app's generate_token."""
    token = generate_token({
        "id": user.user_id,
        "email": user.email,
        "role": user.role,
        "tokenVersion": user.token_version or 0,
    })
    return {"Authorization": f"Bearer {token}"}
