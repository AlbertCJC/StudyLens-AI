"""Registration flow for emails that already have an account."""

import pytest
from werkzeug.security import generate_password_hash

from app import db
from models import UserModel


@pytest.fixture(autouse=True)
def _disable_email(monkeypatch):
    monkeypatch.setattr("services.auth_service.send_otp_email", lambda *args, **kwargs: True)


def _authless_register(client, email, password):
    return client.post(
        "/api/auth/register",
        json={
            "name": "Resume Tester",
            "email": email,
            "role": "student",
            "password": password,
        },
    )


def _create_user(app_instance, *, email, password, verified):
    with app_instance.app_context():
        user = UserModel(
            user_id="usr-resume-1",
            role_id=1,
            role="student",
            first_name="Resume",
            last_name="Tester",
            email=email,
            password_hash=generate_password_hash(password),
            status="active",
            token_version=0,
            email_verified=1 if verified else 0,
            created_at="2026-01-01T00:00:00Z",
        )
        db.session.add(user)
        db.session.commit()
        return user.user_id


def test_unverified_existing_account_resumes_verification(app_instance):
    client = app_instance.test_client()
    user_id = _create_user(
        app_instance,
        email="pending@example.com",
        password="Strong.Pass123",
        verified=False,
    )

    resp = _authless_register(client, "pending@example.com", "Strong.Pass123")

    assert resp.status_code == 200, resp.get_data(as_text=True)
    payload = resp.get_json()
    assert payload["requiresEmailVerification"] is True
    assert payload["userId"] == user_id
    with app_instance.app_context():
        user = db.session.get(UserModel, user_id)
        assert user.email_verify_code
        assert user.email_verify_expires_at


def test_unverified_existing_account_with_wrong_password_stays_duplicate(app_instance):
    client = app_instance.test_client()
    _create_user(
        app_instance,
        email="pending2@example.com",
        password="Strong.Pass123",
        verified=False,
    )

    resp = _authless_register(client, "pending2@example.com", "Wrong.Pass123")

    assert resp.status_code == 409
    assert resp.get_json().get("code") == "USER_EXISTS"


def test_verified_existing_account_is_still_a_duplicate(app_instance):
    client = app_instance.test_client()
    _create_user(
        app_instance,
        email="verified@example.com",
        password="Strong.Pass123",
        verified=True,
    )

    resp = _authless_register(client, "verified@example.com", "Strong.Pass123")

    assert resp.status_code == 409
    assert resp.get_json().get("code") == "USER_EXISTS"
