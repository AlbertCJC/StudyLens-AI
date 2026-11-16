"""Query-count regression tests (P2-02).

Verifies list endpoints issue a bounded (constant) number of queries
independent of result-set size, and that serializers perform no per-row
database lookups.
"""

from sqlalchemy import event

from app import db
from models import (
    MaterialModel,
    RoleModel,
    StudentSubjectModel,
    SubjectModel,
    UserModel,
)


class QueryCounter:
    """Context manager that counts SQL queries issued on the engine."""

    def __init__(self):
        self.count = 0

    def __enter__(self):
        self.count = 0

        def listener(conn, cursor, statement, parameters, context, executemany):
            self.count += 1

        self._listener = listener
        event.listen(db.engine, "before_cursor_execute", self._listener)
        return self

    def __exit__(self, *exc):
        event.remove(db.engine, "before_cursor_execute", self._listener)


def _seed_role(role_name):
    role = RoleModel.query.filter_by(role_name=role_name).first()
    if not role:
        role = RoleModel(role_name=role_name)
        db.session.add(role)
        db.session.flush()
    return role


def _seed_subjects_and_materials(app_instance, n=50):
    with app_instance.app_context():
        teacher_role = _seed_role("teacher")
        teacher = UserModel(
            user_id="usr-teacher-qc",
            role_id=teacher_role.role_id,
            role="teacher",
            first_name="QC",
            last_name="Teacher",
            email="qc.teacher@test.com",
            password_hash="hash",
            status="active",
            token_version=0,
            email_verified=1,
            created_at="2026-01-01T00:00:00Z",
        )
        db.session.add(teacher)
        subjects = []
        for i in range(n):
            sub = SubjectModel(
                subject_id=f"sub-qc-{i:03d}",
                teacher_id=teacher.user_id,
                subject_code=f"QC{i:03d}",
                subject_name=f"QC Subject {i}",
                created_at="2026-01-01T00:00:00Z",
            )
            db.session.add(sub)
            subjects.append(sub)
            for j in range(3):
                db.session.add(
                    StudentSubjectModel(
                        student_id=f"stu-qc-{j}",
                        subject_id=sub.subject_id,
                        date_enrolled="2026-01-01T00:00:00Z",
                    )
                )
        for i in range(n):
            db.session.add(
                MaterialModel(
                    material_id=f"mat-qc-{i:03d}",
                    teacher_id=teacher.user_id,
                    subject_id=subjects[i % n].subject_id,
                    title=f"Material {i}",
                    uploaded_by="QC Teacher",
                    uploader_role="teacher",
                    file_type="pdf",
                    file_url=f"https://example.com/file{i}.pdf",
                    uploaded_at="2026-01-01T00:00:00Z",
                )
            )
        db.session.commit()
        return teacher.user_id


def test_subjects_list_query_count_bounded(app_instance, init_database):
    """Listing 50 subjects issues a constant number of queries (not N+1)."""
    teacher_id = _seed_subjects_and_materials(app_instance, n=50)
    from app import generate_token

    token, _ = generate_token({
        "id": teacher_id,
        "email": "qc.teacher@test.com",
        "role": "teacher",
        "tokenVersion": 0,
    })
    headers = {"Authorization": f"Bearer {token}"}

    with QueryCounter() as counter:
        resp = app_instance.test_client().get("/api/subjects", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    body = resp.get_json()
    assert isinstance(body, list) and len(body) == 50
    # Bounded: subjects query + one grouped roster-count query (not N+1).
    assert counter.count <= 8, f"Expected bounded queries, got {counter.count}"


def test_materials_list_query_count_bounded(app_instance, init_database):
    """Listing 50 materials issues a constant number of queries (not N+1)."""
    _seed_subjects_and_materials(app_instance, n=50)
    from app import generate_token

    with app_instance.app_context():
        from models import UserModel
        teacher = UserModel.query.filter_by(email="qc.teacher@test.com").first()
        teacher_id = teacher.user_id

    token, _ = generate_token({
        "id": teacher_id,
        "email": "qc.teacher@test.com",
        "role": "teacher",
        "tokenVersion": 0,
    })
    headers = {"Authorization": f"Bearer {token}"}

    with QueryCounter() as counter:
        resp = app_instance.test_client().get("/api/materials", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    body = resp.get_json()
    assert isinstance(body, list) and len(body) == 50
    # Bounded: materials query (subject eager-loaded in same query).
    assert counter.count <= 8, f"Expected bounded queries, got {counter.count}"
