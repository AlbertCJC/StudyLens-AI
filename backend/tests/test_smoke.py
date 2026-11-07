"""Cross-cutting smoke tests for auth, RBAC, and core read endpoints.

These are intentionally shallow: they guard the public contract while the
single-module backend is decomposed into blueprints/services.
"""

import json

from conftest import auth_headers_for


def test_system_info_is_public(client):
    resp = client.get("/api/system/info")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["platformName"].startswith("StudyLens AI")
    assert body["techStack"]["backend"] == "Python - Flask"


def test_auth_required_endpoints_return_401(client):
    for path in (
        "/api/users",
        "/api/subjects",
        "/api/materials",
        "/api/quizzes",
        "/api/flashcards",
        "/api/summaries",
        "/api/reviewers",
        "/api/notifications",
        "/api/reports",
        "/api/logs",
        "/api/analytics/admin",
    ):
        resp = client.get(path)
        assert resp.status_code == 401, f"{path} should require auth, got {resp.status_code}"


def test_login_rejects_empty_payload(client):
    resp = client.post("/api/auth/login", data=json.dumps({}), content_type="application/json")
    assert resp.status_code in (400, 401)
    assert "error" in resp.get_json()


def test_student_can_read_own_domain(app_instance, client, init_database):
    with app_instance.app_context():
        from app import UserModel

        student = UserModel.query.filter_by(user_id="stu-1").first()
        headers = auth_headers_for(student)

    for path in (
        "/api/subjects",
        "/api/materials",
        "/api/quizzes",
        "/api/flashcards",
        "/api/summaries",
        "/api/reviewers",
        "/api/notifications",
        "/api/progress/stu-1",
    ):
        resp = client.get(path, headers=headers)
        assert resp.status_code == 200, f"{path} returned {resp.status_code}: {resp.get_json()}"


def test_admin_only_endpoint_rejects_student(app_instance, client, init_database):
    with app_instance.app_context():
        from app import UserModel

        student = UserModel.query.filter_by(user_id="stu-1").first()
        headers = auth_headers_for(student)

    resp = client.get("/api/analytics/admin", headers=headers)
    assert resp.status_code == 403


def test_admin_can_read_admin_analytics(app_instance, client, init_database):
    with app_instance.app_context():
        from app import UserModel

        admin = UserModel.query.filter_by(user_id="adm-1").first()
        headers = auth_headers_for(admin)

    resp = client.get("/api/analytics/admin", headers=headers)
    assert resp.status_code == 200
    assert "totals" in resp.get_json()


def test_reports_require_staff(app_instance, client, init_database):
    with app_instance.app_context():
        from app import UserModel

        student = UserModel.query.filter_by(user_id="stu-1").first()
        teacher = UserModel.query.filter_by(user_id="tea-1").first()
        student_headers = auth_headers_for(student)
        teacher_headers = auth_headers_for(teacher)

    assert client.get("/api/reports", headers=student_headers).status_code == 403
    assert client.get("/api/reports", headers=teacher_headers).status_code == 200
