"""Regression tests: deleting an announcement cascades to its notifications (Option B)."""

from app import db, generate_token
from models import AnnouncementModel, NotificationModel, UserModel


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


def _admin_headers(app_instance):
    return _auth_headers(app_instance, "adm-1", "carol@test.com", "admin")


def _teacher_headers(app_instance):
    return _auth_headers(app_instance, "tea-1", "bob@test.com", "teacher")


def _student_headers(app_instance):
    return _auth_headers(app_instance, "stu-1", "alice@test.com", "student")


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


def _add_notification(app_instance, *, notification_id, user_id, target):
    with app_instance.app_context():
        notif = NotificationModel(
            notification_id=notification_id,
            user_id=user_id,
            title="Announcement notice",
            message="A new announcement was posted.",
            created_at="2026-01-01T00:00:00Z",
            target=target,
        )
        db.session.add(notif)
        db.session.commit()


def test_delete_announcement_cascades_to_tied_notification_teacher(
    app_instance, init_database
):
    client = app_instance.test_client()
    _add_announcement(
        app_instance,
        announcement_id="ann-teacher-1",
        teacher_id="tea-1",
        subject_id="sub-1",
    )
    # Notification tied to this announcement (target = announcement:<id>).
    _add_notification(
        app_instance,
        notification_id="notif-tied-1",
        user_id="stu-1",
        target="announcement:ann-teacher-1",
    )
    # Unrelated notification must survive.
    _add_notification(
        app_instance,
        notification_id="notif-other-1",
        user_id="stu-1",
        target="quiz:qz-1",
    )

    resp = client.delete(
        "/api/announcements/ann-teacher-1", headers=_teacher_headers(app_instance)
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    with app_instance.app_context():
        assert db.session.get(AnnouncementModel, "ann-teacher-1") is None
        assert (
            db.session.get(NotificationModel, "notif-tied-1") is None
        ), "Tied notification should be cascade-deleted"
        assert (
            db.session.get(NotificationModel, "notif-other-1") is not None
        ), "Unrelated notification should survive"


def test_delete_announcement_cascades_to_tied_notification_admin(
    app_instance, init_database
):
    client = app_instance.test_client()
    _add_announcement(
        app_instance,
        announcement_id="ann-system-1",
        teacher_id="usr-admin-1",
        subject_id=None,
    )
    _add_notification(
        app_instance,
        notification_id="notif-tied-2",
        user_id="stu-1",
        target="announcement:ann-system-1",
    )

    resp = client.delete(
        "/api/announcements/ann-system-1", headers=_admin_headers(app_instance)
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    with app_instance.app_context():
        assert db.session.get(AnnouncementModel, "ann-system-1") is None
        assert db.session.get(NotificationModel, "notif-tied-2") is None


def test_delete_announcement_forbidden_leaves_notifications_intact(
    app_instance, init_database
):
    client = app_instance.test_client()
    _add_announcement(
        app_instance,
        announcement_id="ann-teacher-2",
        teacher_id="tea-1",
        subject_id="sub-1",
    )
    _add_notification(
        app_instance,
        notification_id="notif-tied-3",
        user_id="stu-1",
        target="announcement:ann-teacher-2",
    )

    # A student is neither the author nor an admin system poster.
    resp = client.delete(
        "/api/announcements/ann-teacher-2", headers=_student_headers(app_instance)
    )
    assert resp.status_code == 403, resp.get_data(as_text=True)

    with app_instance.app_context():
        assert db.session.get(AnnouncementModel, "ann-teacher-2") is not None
        assert (
            db.session.get(NotificationModel, "notif-tied-3") is not None
        ), "Notifications must survive a forbidden delete"


def test_delete_announcement_not_found_returns_404(
    app_instance, init_database
):
    client = app_instance.test_client()
    resp = client.delete(
        "/api/announcements/ann-does-not-exist", headers=_admin_headers(app_instance)
    )
    assert resp.status_code == 404, resp.get_data(as_text=True)
