"""System settings, settings audit, audit archiving, and backup tests."""

from datetime import datetime, timedelta, timezone

from app import db
from models import (
    ActivityLogArchiveModel,
    ActivityLogModel,
    SystemSettingModel,
    UserModel,
)
from tests.conftest import auth_headers_for


def _old_timestamp():
    return (datetime.now(timezone.utc) - timedelta(days=100)).isoformat().replace("+00:00", "Z")


def test_system_settings_defaults_and_roundtrip(client, init_database, app_instance):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    resp = client.get("/api/system/settings", headers=headers)
    assert resp.status_code == 200
    defaults = resp.get_json()
    for key in ("require2FA", "maintenanceMode", "sessionTimeoutMins", "autoAuditArchiving"):
        assert key in defaults

    resp = client.put(
        "/api/system/settings",
        json={
            "require2FA": True,
            "maintenanceMode": False,
            "sessionTimeoutMins": 30,
            "autoAuditArchiving": True,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
    saved = resp.get_json()
    assert saved["require2FA"] is True
    assert saved["maintenanceMode"] is False
    assert saved["sessionTimeoutMins"] == 30
    assert saved["autoAuditArchiving"] is True

    resp = client.get("/api/system/settings", headers=headers)
    persisted = resp.get_json()
    assert persisted["require2FA"] is True
    assert persisted["sessionTimeoutMins"] == 30

    with app_instance.app_context():
        row = db.session.get(SystemSettingModel, "sessionTimeoutMins")
        assert row is not None
        assert row.setting_value == "30"


def test_session_timeout_is_clamped(client, init_database, app_instance):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    resp = client.put(
        "/api/system/settings",
        json={"sessionTimeoutMins": 0},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["sessionTimeoutMins"] == 5


def test_settings_save_writes_settings_updated_audit(client, init_database, app_instance):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    client.put(
        "/api/system/settings",
        json={"require2FA": True},
        headers=headers,
    )

    resp = client.get("/api/logs", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    actions = [log["action"] for log in resp.get_json()["logs"]]
    assert "SETTINGS_UPDATED" in actions


def test_auto_audit_archiving_moves_old_logs(client, init_database, app_instance):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    client.put(
        "/api/system/settings",
        json={"autoAuditArchiving": True},
        headers=headers,
    )

    db.session.add(ActivityLogModel(
        log_id="audit-old-1",
        user_id="stu-1",
        user_name="Old User",
        user_role="student",
        activity="OLD_LOG",
        details="older than retention",
        ip_address="127.0.0.1",
        created_at=_old_timestamp(),
    ))
    db.session.commit()

    resp = client.get("/api/logs", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    activities = [log["action"] for log in resp.get_json()["logs"]]
    assert "OLD_LOG" not in activities

    with app_instance.app_context():
        archived = db.session.get(ActivityLogArchiveModel, 1)
        assert archived is not None
        assert archived.activity == "OLD_LOG"
        remaining = ActivityLogModel.query.filter_by(log_id="audit-old-1").first()
        assert remaining is None


def test_system_backup_returns_admin_payload(client, init_database, app_instance):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    resp = client.get("/api/system/backup", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    payload = resp.get_json()
    for key in ("users", "roles", "subjects", "activityLogs", "systemSettings"):
        assert key in payload
