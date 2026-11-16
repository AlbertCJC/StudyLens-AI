"""Audit log staging: log_action must not commit mid-request (P1-04)."""

import datetime

from app import app, db
from models import ActivityLogModel, RoleModel, UserModel
from services.log_service import log_action


def _seed_admin(app_instance):
    with app_instance.app_context():
        role = RoleModel(role_name="admin")
        db.session.add(role)
        db.session.flush()
        user = UserModel(
            user_id="usr-admin-logtest",
            role_id=role.role_id,
            role="admin",
            first_name="Log",
            last_name="Test",
            email="log.test@example.com",
            password_hash="hash",
            status="active",
            token_version=0,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        )
        db.session.add(user)
        db.session.commit()
        return user.user_id


def _log_count(app_instance, action):
    with app_instance.app_context():
        return db.session.query(ActivityLogModel).filter_by(activity=action).count()


def test_log_action_stages_without_commit(app_instance):
    _seed_admin(app_instance)
    with app_instance.test_request_context("/"):
        log_action("usr-admin-logtest", "Log Test", "admin", "TEST_ACTION", "details")
    # No explicit commit by the caller: the staged entry must not survive a reset.
    db.session.remove()
    assert _log_count(app_instance, "TEST_ACTION") == 0


def test_log_action_persists_when_caller_commits(app_instance):
    _seed_admin(app_instance)
    with app_instance.test_request_context("/"):
        log_action("usr-admin-logtest", "Log Test", "admin", "TEST_ACTION", "details")
        db.session.commit()
    assert _log_count(app_instance, "TEST_ACTION") == 1


def test_log_action_rolls_back_with_caller(app_instance):
    _seed_admin(app_instance)
    with app_instance.test_request_context("/"):
        log_action("usr-admin-logtest", "Log Test", "admin", "TEST_ACTION", "details")
        db.session.rollback()
    assert _log_count(app_instance, "TEST_ACTION") == 0
