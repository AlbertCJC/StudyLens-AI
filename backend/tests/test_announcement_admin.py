"""Admin permissions for system announcements."""

from app import db, generate_token
from models import AnnouncementModel


def _auth_headers(app_instance, user_id, email, role, token_version=0):
    with app_instance.app_context():
        token, _jti = generate_token(
            {
                "id": user_id,
                "email": email,
                "role": role,
                "tokenVersion": token_version or 0,
            }
        )
    return {"Authorization": f"Bearer {token}"}


def _add_announcement(app_instance, *, announcement_id, teacher_id, subject_id):
    with app_instance.app_context():
        ann = AnnouncementModel(
            announcement_id=announcement_id,
            teacher_id=teacher_id,
            subject_id=subject_id,
            title="Original title",
            message="Original message",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
            posted_at="2026-01-01T00:00:00Z",
            author_name="Original Author",
            target_audience="all",
            priority="medium",
        )
        db.session.add(ann)
        db.session.commit()


def _admin_headers(app_instance):
    return _auth_headers(app_instance, "adm-1", "carol@test.com", "admin")


def _teacher_headers(app_instance):
    return _auth_headers(app_instance, "tea-1", "bob@test.com", "teacher")


def test_admin_can_edit_and_delete_legacy_system_announcement(app_instance, init_database):
    client = app_instance.test_client()
    _add_announcement(
        app_instance,
        announcement_id="ann-system-1",
        teacher_id="usr-admin-legacy",
        subject_id=None,
    )
    admin_headers = _admin_headers(app_instance)

    resp = client.put(
        "/api/announcements/ann-system-1",
        json={
            "title": "Edited title",
            "content": "Edited message",
            "priority": "high",
            "targetAudience": "teachers",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    with app_instance.app_context():
        ann = db.session.get(AnnouncementModel, "ann-system-1")
        assert ann.title == "Edited title"
        assert ann.message == "Edited message"
        assert ann.priority == "high"
        assert ann.target_audience == "teachers"

    resp = client.delete(
        "/api/announcements/ann-system-1",
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
    with app_instance.app_context():
        assert db.session.get(AnnouncementModel, "ann-system-1") is None


def test_admin_cannot_edit_teacher_course_announcement(app_instance, init_database):
    client = app_instance.test_client()
    _add_announcement(
        app_instance,
        announcement_id="ann-course-1",
        teacher_id="tea-1",
        subject_id="sub-1",
    )
    admin_headers = _admin_headers(app_instance)
    teacher_headers = _teacher_headers(app_instance)

    resp = client.put(
        "/api/announcements/ann-course-1",
        json={"title": "Admin overwrite"},
        headers=admin_headers,
    )
    assert resp.status_code == 403

    resp = client.delete(
        "/api/announcements/ann-course-1",
        headers=admin_headers,
    )
    assert resp.status_code == 403

    resp = client.put(
        "/api/announcements/ann-course-1",
        json={"title": "Teacher edit"},
        headers=teacher_headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
