"""Uploaded-file access requires authentication (P1-10)."""

import os

from app import generate_token
from config import _UPLOADS_DIR
from models import UserModel


def _auth_headers(app_instance, user):
    """Generate auth headers inside an app context (generate_token now records the session)."""
    with app_instance.app_context():
        token, _jti = generate_token({
            "id": user.user_id,
            "email": user.email,
            "role": user.role,
            "tokenVersion": user.token_version or 0,
        })
    return {"Authorization": f"Bearer {token}"}


def test_uploads_route_requires_auth(app_instance):
    """Unauthenticated requests to /uploads/<path> are rejected (401)."""
    client = app_instance.test_client()
    resp = client.get("/uploads/nonexistent.txt")
    assert resp.status_code == 401


def test_uploads_route_authenticated_returns_404_when_missing(app_instance, init_database):
    """An authenticated request still gets 404 for a missing file (auth passed)."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
    resp = client.get("/uploads/nonexistent.txt", headers=_auth_headers(app_instance, user))
    assert resp.status_code == 404


def test_uploads_route_authenticated_serves_file(app_instance, init_database):
    """An authenticated request can read an existing local-upload fallback file."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
    name = "auth_test_file.txt"
    path = os.path.join(_UPLOADS_DIR, name)
    with open(path, "wb") as f:
        f.write(b"secret upload content")
    try:
        resp = client.get(f"/uploads/{name}", headers=_auth_headers(app_instance, user))
        assert resp.status_code == 200, resp.get_data(as_text=True)
        assert resp.data == b"secret upload content"
    finally:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


def test_uploads_route_traversal_blocked_when_authenticated(app_instance, init_database):
    """Path traversal is rejected even with a valid session."""
    client = app_instance.test_client()
    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
    resp = client.get(
        "/uploads/../../../etc/passwd", headers=_auth_headers(app_instance, user)
    )
    assert resp.status_code == 404
