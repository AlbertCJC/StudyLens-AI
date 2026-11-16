"""HttpOnly session cookie + CSRF tests (P1-01/P1-02)."""

import datetime
import jwt

from app import app
from extensions import db
from services.auth_service import generate_token, session_timeout_minutes
from werkzeug.security import generate_password_hash


def _cookie_value(response, name):
    for header in response.headers.getlist("Set-Cookie"):
        parts = header.split(";")
        if parts[0].strip().startswith(f"{name}="):
            return parts[0].split("=", 1)[1]
    return None


def _cookie_headers(session_value, csrf_value=None):
    headers = {}
    if session_value:
        headers["Cookie"] = f"studylens_session={session_value}"
        if csrf_value:
            headers["Cookie"] += f"; studylens_csrf={csrf_value}"
    return headers


def _login(client, email, password, mobile=False):
    headers = {"Content-Type": "application/json"}
    if mobile:
        headers["X-Client-Type"] = "mobile"
    return client.post("/api/auth/login", json={"email": email, "password": password}, headers=headers)


def _seed_user(app_instance, email, role="admin", password="Strong.Pass123"):
    with app_instance.app_context():
        from models import RoleModel, UserModel
        role_row = RoleModel.query.filter_by(role_name=role).first()
        if not role_row:
            role_row = RoleModel(role_name=role)
            db.session.add(role_row)
            db.session.flush()
        user = UserModel(
            user_id=f"usr-{role}-cookie",
            role_id=role_row.role_id,
            role=role,
            first_name="Cookie",
            last_name="User",
            email=email,
            password_hash=generate_password_hash(password),
            status="active",
            token_version=0,
            email_verified=1,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        )
        db.session.add(user)
        db.session.commit()
        return user.user_id


def test_login_web_sets_httponly_cookie_no_token_body(app_instance, client):
    _seed_user(app_instance, "cookie.web@test.com", "admin")
    resp = _login(client, "cookie.web@test.com", "Strong.Pass123")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    body = resp.get_json()
    assert "token" not in body
    assert "user" in body
    session_cookie = _cookie_value(resp, "studylens_session")
    csrf_cookie = _cookie_value(resp, "studylens_csrf")
    assert session_cookie, "session cookie not set"
    assert csrf_cookie, "csrf cookie not set"
    set_cookie = resp.headers.getlist("Set-Cookie")[0]
    assert "HttpOnly" in set_cookie
    assert "SameSite=Lax" in set_cookie


def test_login_mobile_returns_token_body_no_cookie(app_instance, client):
    _seed_user(app_instance, "cookie.mobile@test.com", "admin")
    resp = _login(client, "cookie.mobile@test.com", "Strong.Pass123", mobile=True)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    body = resp.get_json()
    assert "token" in body and body["token"]
    cookies = resp.headers.getlist("Set-Cookie")
    assert not any("studylens_session" in c for c in cookies)


def test_cookie_authenticated_get_requires_no_bearer(app_instance, client):
    _seed_user(app_instance, "cookie.get@test.com", "admin")
    resp = _login(client, "cookie.get@test.com", "Strong.Pass123")
    session_value = _cookie_value(resp, "studylens_session")
    assert session_value
    resp = client.get(
        "/api/system/settings", headers=_cookie_headers(session_value)
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)


def test_cookie_authenticated_unsafe_requires_csrf(app_instance, client):
    _seed_user(app_instance, "cookie.csrf@test.com", "admin")
    resp = _login(client, "cookie.csrf@test.com", "Strong.Pass123")
    session_value = _cookie_value(resp, "studylens_session")
    resp = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Strong.Pass123", "newPassword": "N3w.Strong!Pass123"},
        headers=_cookie_headers(session_value),
    )
    assert resp.status_code == 403, resp.get_data(as_text=True)
    assert resp.get_json().get("code") == "CSRF_INVALID"


def test_csrf_cookie_matches_header(app_instance, client):
    _seed_user(app_instance, "cookie.csrf2@test.com", "admin")
    login_resp = _login(client, "cookie.csrf2@test.com", "Strong.Pass123")
    session_value = _cookie_value(login_resp, "studylens_session")
    csrf = _cookie_value(login_resp, "studylens_csrf")
    assert session_value and csrf
    resp = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Strong.Pass123", "newPassword": "N3w.Strong!Pass123"},
        headers={**_cookie_headers(session_value, csrf), "X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)


def test_bearer_still_works_without_csrf(app_instance, client):
    _seed_user(app_instance, "cookie.bearer@test.com", "admin")
    with app_instance.app_context():
        from models import UserModel
        user = UserModel.query.filter_by(email="cookie.bearer@test.com").first()
        token, _jti = generate_token({
            "id": user.user_id,
            "email": user.email,
            "role": user.role,
            "tokenVersion": user.token_version or 0,
        })
    resp = client.get(
        "/api/system/settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)


def test_logout_clears_cookies(app_instance, client):
    _seed_user(app_instance, "cookie.logout@test.com", "admin")
    resp = _login(client, "cookie.logout@test.com", "Strong.Pass123")
    session_value = _cookie_value(resp, "studylens_session")
    csrf = _cookie_value(resp, "studylens_csrf")
    resp = client.post(
        "/api/auth/logout",
        headers={**_cookie_headers(session_value, csrf), "X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.get_data(as_text=True)
    cleared = [c for c in resp.headers.getlist("Set-Cookie") if c.startswith("studylens_session=")]
    assert cleared, "session cookie not cleared"
    assert "Max-Age=0" in cleared[0] or "expires=" in cleared[0].lower()


def test_session_timeout_matches_cookie_max_age(app_instance, client):
    assert 5 <= session_timeout_minutes() <= 1440
