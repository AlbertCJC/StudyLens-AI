"""Demo credential and seeding hardening tests (P0-02/03/04)."""

from werkzeug.security import generate_password_hash

from app import db, UserModel
import db.migrations as migrations
import db.seed as seed
import lib.middleware as middleware


STRONG_TEACHER = "Teacher-Strong-2026!"
STRONG_ADMIN = "Admin-Strong-2026!"


def _set_seed_config(monkeypatch, *, enabled=True, production=False,
                     teacher=STRONG_TEACHER, admin=STRONG_ADMIN):
    monkeypatch.setattr(seed, "SEED_DEMO_DATA", enabled)
    monkeypatch.setattr(seed, "IS_PRODUCTION", production)
    monkeypatch.setattr(seed, "DEMO_TEACHER_PASSWORD", teacher)
    monkeypatch.setattr(seed, "DEMO_ADMIN_PASSWORD", admin)


def test_app_start_does_not_seed_by_default(app_instance, monkeypatch):
    _set_seed_config(monkeypatch, enabled=False)
    result = seed.seed_database_if_empty()
    assert result["seeded"] is False
    assert "disabled" in result["reason"]
    with app_instance.app_context():
        assert UserModel.query.count() == 0


def test_demo_seed_requires_explicit_passwords(app_instance, monkeypatch):
    _set_seed_config(monkeypatch, enabled=True, admin=None)
    result = seed.seed_database_if_empty()
    assert result["seeded"] is False
    assert "DEMO_ADMIN_PASSWORD" in result["reason"]
    with app_instance.app_context():
        assert UserModel.query.count() == 0


def test_known_default_password_rejected(app_instance, monkeypatch):
    _set_seed_config(monkeypatch, enabled=True, admin="Admin!123")
    result = seed.seed_database_if_empty()
    assert result["seeded"] is False
    assert "known default" in result["reason"].lower()
    with app_instance.app_context():
        assert UserModel.query.count() == 0


def test_production_refuses_demo_seed(app_instance, monkeypatch):
    _set_seed_config(monkeypatch, enabled=True, production=True)
    result = seed.seed_database_if_empty()
    assert result["seeded"] is False
    assert "production" in result["reason"].lower()
    with app_instance.app_context():
        assert UserModel.query.count() == 0


def test_seed_command_is_idempotent(app_instance, monkeypatch):
    _set_seed_config(monkeypatch, enabled=True)
    first = seed.seed_database_if_empty()
    assert first["seeded"] is True
    assert first["created"]["users"] == 2

    second = seed.seed_database_if_empty()
    assert second["seeded"] is False
    with app_instance.app_context():
        assert UserModel.query.count() == 2


def test_demo_password_backfill_only_when_missing(app_instance, monkeypatch):
    monkeypatch.setattr(migrations, "DEMO_ADMIN_PASSWORD", STRONG_ADMIN)
    monkeypatch.setattr(migrations, "DEMO_TEACHER_PASSWORD", STRONG_TEACHER)

    with app_instance.app_context():
        db.session.add(UserModel(
            user_id="usr-admin-1", role_id=3, role="admin",
            first_name="Neil", last_name="Admin",
            email="admin@test.com", password_hash=generate_password_hash("operator-changed"),
            status="active", token_version=0, created_at="2026-01-01T00:00:00Z",
        ))
        db.session.commit()
        original_hash = db.session.get(UserModel, "usr-admin-1").password_hash

        migrations._ensure_demo_passwords()
        assert db.session.get(UserModel, "usr-admin-1").password_hash == original_hash


def test_admin_password_change_survives_restart_simulation(app_instance, monkeypatch):
    monkeypatch.setattr(migrations, "DEMO_ADMIN_PASSWORD", STRONG_ADMIN)

    with app_instance.app_context():
        db.session.add(UserModel(
            user_id="usr-admin-1", role_id=3, role="admin",
            first_name="Neil", last_name="Admin",
            email="admin@test.com", password_hash=None,
            status="active", token_version=0, created_at="2026-01-01T00:00:00Z",
        ))
        db.session.commit()

        migrations._ensure_demo_passwords()
        backfilled = db.session.get(UserModel, "usr-admin-1").password_hash
        assert backfilled

        # Operator rotates the password, then the app restarts.
        db.session.get(UserModel, "usr-admin-1").password_hash = "operator-rotation-hash"
        db.session.commit()
        migrations._ensure_demo_passwords()
        assert db.session.get(UserModel, "usr-admin-1").password_hash == "operator-rotation-hash"


def test_production_rejects_weak_demo_account(app_instance, monkeypatch):
    monkeypatch.setattr(middleware, "IS_PRODUCTION", True)
    monkeypatch.setattr(middleware, "_DEMO_SAFETY_CHECKED", False)

    with app_instance.app_context():
        db.session.add(UserModel(
            user_id="usr-admin-1", role_id=3, role="admin",
            first_name="Neil", last_name="Admin",
            email="admin@test.com",
            password_hash=generate_password_hash("Admin!123"),
            status="active", token_version=0, created_at="2026-01-01T00:00:00Z",
        ))
        db.session.commit()

        with app_instance.test_request_context("/api/materials"):
            response = middleware.enforce_production_demo_account_safety()
            assert response is not None
            body, status = response
            assert status == 503
            assert body.get_json()["code"] == "UNSAFE_DEMO_ACCOUNT"
