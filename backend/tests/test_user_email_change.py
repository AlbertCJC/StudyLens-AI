"""User email-change handling (P1-08)."""

import pytest

from app import generate_token, db
from models import UserModel
from werkzeug.security import generate_password_hash


@pytest.fixture(autouse=True)
def _stub_otp_email(monkeypatch):
    monkeypatch.setattr("services.auth_service.send_otp_email", lambda *args, **kwargs: True)


def _auth_headers(app_instance, user_id, email, role, token_version):
    """Generate auth headers inside an app context (generate_token now records the session)."""
    with app_instance.app_context():
        token, _jti = generate_token({
            "id": user_id,
            "email": email,
            "role": role,
            "tokenVersion": token_version or 0,
        })
    return {"Authorization": f"Bearer {token}"}


def test_self_email_change_needs_no_password_or_reverification(
    app_instance, init_database
):
    """Profile email edits save immediately and keep the current session valid."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
        user.email_verified = 1
        old_version = user.token_version or 0
        user_id = user.user_id
        email = user.email
        role = user.role
        user.password_hash = generate_password_hash("Strong.Pass123")
        db.session.commit()

    headers = _auth_headers(app_instance, user_id, email, role, old_version)
    resp = client.put(
        f"/api/users/{user_id}",
        json={"email": "newaddr@example.com"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    with app_instance.app_context():
        u = UserModel.query.get(user_id)
        assert u.email == "newaddr@example.com"
        assert u.email_verified == 1
        assert (u.token_version or 0) == old_version
        assert u.email_verify_code is None

    # The old session must remain usable (no forced sign-out).
    stats = client.get(f"/api/users/{user_id}/stats", headers=headers)
    assert stats.status_code == 200, stats.get_data(as_text=True)


def test_self_profile_fields_do_not_invalidate_session(
    app_instance, init_database
):
    """Name/avatar edits keep the same token version and session."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
        user_id = user.user_id
        old_version = user.token_version or 0
        email = user.email
        role = user.role

    headers = _auth_headers(app_instance, user_id, email, role, old_version)
    resp = client.put(
        f"/api/users/{user_id}",
        json={
            "name": "Alice Updated",
            "avatar": "https://example.com/avatar.png",
            "role": "student",
            "status": "active",
            "tokenVersion": 999,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    with app_instance.app_context():
        u = UserModel.query.get(user_id)
        assert u.to_dict()["name"] == "Alice Updated"
        assert u.profile_picture == "https://example.com/avatar.png"
        assert (u.token_version or 0) == old_version

    stats = client.get(f"/api/users/{user_id}/stats", headers=headers)
    assert stats.status_code == 200, stats.get_data(as_text=True)


def test_email_change_to_existing_email_rejected(app_instance, init_database):
    """An email already owned by another account cannot be claimed."""
    client = app_instance.test_client()
    with app_instance.app_context():
        alice = UserModel.query.filter_by(email="alice@test.com").first()
        bob = UserModel.query.filter_by(email="bob@test.com").first()
        alice_id = alice.user_id
        alice_email = alice.email
        alice_role = alice.role
        alice_version = alice.token_version or 0
        bob_email = bob.email

    resp = client.put(
        f"/api/users/{alice_id}",
        json={"email": bob_email},
        headers=_auth_headers(app_instance, alice_id, alice_email, alice_role, alice_version),
    )
    assert resp.status_code == 400
    assert resp.get_json().get("code") == "EMAIL_EXISTS"


def test_admin_email_change_still_requires_reverification(
    app_instance, init_database
):
    """Admin edits to another account keep the owner-verification flow."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
        user.email_verified = 1
        user_id = user.user_id
        old_version = user.token_version or 0
        admin = UserModel.query.filter_by(email="carol@test.com").first()
        admin_id = admin.user_id
        admin_email = admin.email
        admin_role = admin.role
        admin_version = admin.token_version or 0

    resp = client.put(
        f"/api/users/{user_id}",
        json={"email": "admin-set@example.com"},
        headers=_auth_headers(
            app_instance, admin_id, admin_email, admin_role, admin_version
        ),
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)

    with app_instance.app_context():
        u = UserModel.query.get(user_id)
        assert u.email == "admin-set@example.com"
        assert u.email_verified == 0
        assert (u.token_version or 0) == old_version + 1
        assert u.email_verify_code


def test_login_tolerates_whitespace_padded_stored_email(app_instance, init_database):
    """Legacy emails with a trailing newline can still authenticate."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
        user.email = "alice@test.com\n"
        user.email_verified = 1
        user.status = "active"
        user.password_hash = generate_password_hash("Strong.Pass123")
        db.session.commit()

    resp = client.post(
        "/api/auth/login",
        json={"email": "alice@test.com", "password": "Strong.Pass123"},
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert resp.get_json().get("user", {}).get("email") == "alice@test.com\n"
