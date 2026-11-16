"""Authorization and signed-URL tests for material file viewing (P0-01)."""

import os
import uuid

import pytest

from app import db, MaterialModel, UserModel
from config import _UPLOADS_DIR
from conftest import auth_headers_for
from lib.remote_file import validate_remote_file_url
import lib.material_view_token as view_token_module
from services.material_service import reconcile_material_counts


def _auth_headers(app_instance, user_id):
    with app_instance.app_context():
        user = db.session.get(UserModel, user_id)
        return auth_headers_for(user)


def _create_material(app_instance, *, file_url=None, file_type="txt", teacher_id="tea-1"):
    """Creates a course material plus a real local file when needed."""
    material_id = f"mat-test-{uuid.uuid4().hex[:10]}"
    upload_name = None
    if file_url is None:
        upload_name = f"test-view-{uuid.uuid4().hex}.txt"
        with open(os.path.join(_UPLOADS_DIR, upload_name), "wb") as handle:
            handle.write(b"StudyLens material preview")
        file_url = f"/uploads/{upload_name}"
    with app_instance.app_context():
        db.session.add(MaterialModel(
            material_id=material_id,
            subject_id="sub-1",
            teacher_id=teacher_id,
            title="Preview test material",
            description="",
            file_url=file_url,
            file_type=file_type,
            file_size="20",
            uploaded_at="2026-01-01T00:00:00Z",
            material_type="course",
            uploaded_by="Bob Teacher",
            uploader_role="teacher",
        ))
        db.session.commit()
    return material_id, upload_name


def _cleanup_upload(upload_name):
    if not upload_name:
        return
    try:
        os.remove(os.path.join(_UPLOADS_DIR, upload_name))
    except OSError:
        pass


def test_view_requires_auth(app_instance):
    material_id, upload_name = _create_material(app_instance)
    try:
        with app_instance.test_client() as client:
            resp = client.get(f"/api/materials/{material_id}/view")
            assert resp.status_code == 401
    finally:
        _cleanup_upload(upload_name)


def test_view_denies_non_enrolled_student(app_instance, init_database):
    material_id, upload_name = _create_material(app_instance)
    try:
        with app_instance.app_context():
            db.session.add(UserModel(
                user_id="stu-outside", role_id=1, role="student",
                first_name="Eve", last_name="Outside",
                email="eve.outside@test.com", password_hash="hash",
                status="active", token_version=0, created_at="2026-01-01T00:00:00Z",
            ))
            db.session.commit()
        headers = _auth_headers(app_instance, "stu-outside")
        with app_instance.test_client() as client:
            resp = client.get(f"/api/materials/{material_id}/view", headers=headers)
            assert resp.status_code == 403
    finally:
        _cleanup_upload(upload_name)


@pytest.mark.parametrize("user_id", ["tea-1", "adm-1", "stu-1"])
def test_view_allows_owner_teacher_admin_and_enrolled_student(app_instance, init_database, user_id):
    material_id, upload_name = _create_material(app_instance)
    try:
        headers = _auth_headers(app_instance, user_id)
        with app_instance.test_client() as client:
            resp = client.get(f"/api/materials/{material_id}/view", headers=headers)
            assert resp.status_code == 200, resp.get_data(as_text=True)
    finally:
        _cleanup_upload(upload_name)


def test_view_token_requires_auth(app_instance):
    material_id, upload_name = _create_material(app_instance)
    try:
        with app_instance.test_client() as client:
            resp = client.post(f"/api/materials/{material_id}/view-token")
            assert resp.status_code == 401
    finally:
        _cleanup_upload(upload_name)


def test_view_signed_url_works_without_authorization_header(app_instance, init_database):
    material_id, upload_name = _create_material(app_instance)
    try:
        headers = _auth_headers(app_instance, "tea-1")
        with app_instance.test_client() as client:
            issued = client.post(f"/api/materials/{material_id}/view-token", headers=headers)
            assert issued.status_code == 200, issued.get_data(as_text=True)
            body = issued.get_json()
            assert body["token"]
            assert body["expiresInSeconds"] == view_token_module.VIEW_TOKEN_TTL_SECONDS

            resp = client.get(f"/api/materials/{material_id}/view?token={body['token']}")
            assert resp.status_code == 200
    finally:
        _cleanup_upload(upload_name)


def test_view_rejects_tampered_signature(app_instance, init_database):
    material_id, upload_name = _create_material(app_instance)
    try:
        headers = _auth_headers(app_instance, "tea-1")
        with app_instance.test_client() as client:
            issued = client.post(f"/api/materials/{material_id}/view-token", headers=headers)
            token = issued.get_json()["token"]
            resp = client.get(f"/api/materials/{material_id}/view?token={token}tampered")
            assert resp.status_code == 403
    finally:
        _cleanup_upload(upload_name)


def test_view_signed_token_expiry(monkeypatch):
    token = view_token_module.issue_material_view_token("mat-expiry", "tea-1")
    monkeypatch.setattr(view_token_module, "VIEW_TOKEN_TTL_SECONDS", -1)
    assert view_token_module.verify_material_view_token(token, "mat-expiry") is None


def test_view_token_is_scoped_to_one_material():
    token = view_token_module.issue_material_view_token("mat-one", "tea-1")
    assert view_token_module.verify_material_view_token(token, "mat-two") is None


def test_view_rejects_private_network_url(app_instance, init_database):
    material_id, _ = _create_material(
        app_instance, file_url="http://127.0.0.1:9/private.txt"
    )
    headers = _auth_headers(app_instance, "tea-1")
    with app_instance.test_client() as client:
        resp = client.get(f"/api/materials/{material_id}/view", headers=headers)
        assert resp.status_code == 400


def test_view_rejects_non_http_url(app_instance, init_database):
    material_id, _ = _create_material(app_instance, file_url="file:///etc/passwd")
    headers = _auth_headers(app_instance, "tea-1")
    with app_instance.test_client() as client:
        resp = client.get(f"/api/materials/{material_id}/view", headers=headers)
        assert resp.status_code == 400


def test_validate_remote_file_url_rejects_private_addresses():
    for url in (
        "http://localhost/file",
        "http://127.0.0.1/file",
        "http://169.254.169.254/latest/meta-data",
        "ftp://example.com/file",
    ):
        safe, reason = validate_remote_file_url(url)
        assert safe is None
        assert reason


def test_material_count_reconciliation(app_instance, init_database):
    """material_count drift is repaired by the reconciliation function."""
    from models import UserModel, SubjectModel

    with app_instance.app_context():
        # Get an existing subject and bump its material_count to a wrong value
        sub = db.session.get(SubjectModel, "sub-1")
        assert sub is not None
        stored_count = sub.material_count or 0
        actual_count = db.session.query(MaterialModel).filter_by(subject_id="sub-1").count()
        sub.material_count = actual_count + 5  # introduce drift
        db.session.commit()

    # Run reconciliation
    drifts = reconcile_material_counts()
    assert "sub-1" in drifts
    assert drifts["sub-1"] == (stored_count + 5, actual_count)

    # Verify the count was corrected
    with app_instance.app_context():
        sub = db.session.get(SubjectModel, "sub-1")
        assert sub.material_count == actual_count
