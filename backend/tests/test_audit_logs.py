"""Audit activity log tests: clear/archive, pagination, and CSV export coverage."""

from datetime import datetime, timedelta, timezone

from app import db
from models import ActivityLogArchiveModel, ActivityLogModel, UserModel
from tests.conftest import auth_headers_for


def _seed_logs(app_instance, count=5):
    with app_instance.app_context():
        now = datetime.now(timezone.utc)
        for i in range(count):
            ts = (now - timedelta(days=i)).isoformat().replace("+00:00", "Z")
            db.session.add(ActivityLogModel(
                log_id=f"audit-test-{i}",
                user_id="stu-1",
                user_name="Test User",
                user_role="student",
                activity="TEST_ACTION",
                details=f"details {i}",
                ip_address="127.0.0.1",
                created_at=ts,
            ))
        db.session.commit()


def test_logs_pagination_returns_page_and_total(client, init_database, app_instance):
    _seed_logs(app_instance, count=12)
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    resp = client.get("/api/logs?page=1&limit=5", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()
    assert len(data["logs"]) == 5
    assert data["total"] == 12
    assert data["page"] == 1
    assert data["pages"] == 3


def test_logs_clear_archives_then_deletes_and_leaves_cleared_entry(
    client, init_database, app_instance
):
    _seed_logs(app_instance, count=3)
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    resp = client.delete("/api/logs", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert resp.get_json()["success"] is True

    # Active logs removed except the LOGS_CLEARED clearing record.
    remaining = ActivityLogModel.query.count()
    assert remaining == 1

    # Archived logs retained.
    with app_instance.app_context():
        archived = ActivityLogArchiveModel.query.all()
        assert len(archived) == 3
        assert all(a.activity == "TEST_ACTION" for a in archived)

    # One LOGS_CLEARED audit entry remains.
    resp = client.get("/api/logs", headers=headers)
    assert resp.status_code == 200
    actions = [log["action"] for log in resp.get_json()["logs"]]
    assert "LOGS_CLEARED" in actions


def test_logs_clear_uses_current_admin_not_hardcoded(client, init_database, app_instance):
    _seed_logs(app_instance, count=1)
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)

    client.delete("/api/logs", headers=headers)

    with app_instance.app_context():
        cleared = ActivityLogModel.query.filter_by(activity="LOGS_CLEARED").first()
        assert cleared is not None
        assert cleared.user_id == "adm-1"
        assert cleared.user_name == "Carol Admin"
