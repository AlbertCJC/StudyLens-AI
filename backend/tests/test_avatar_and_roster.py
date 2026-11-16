"""Avatar upload and subject-roster avatar propagation."""

import io
from datetime import datetime, timezone

from app import UserModel, db
from tests.conftest import auth_headers_for


def test_avatar_upload_returns_renderable_url(
    client, init_database, app_instance, monkeypatch
):
    expected_url = "https://res.cloudinary.com/demo/image/upload/v1/studylens_avatars/avatar.png"
    monkeypatch.setattr(
        "controllers.users_controller.upload_avatar_to_cloud",
        lambda *args, **kwargs: expected_url,
    )

    with app_instance.app_context():
        student = db.session.get(UserModel, "stu-1")
        headers = auth_headers_for(student)
        user_id = student.user_id

    response = client.post(
        f"/api/users/{user_id}/avatar",
        data={"file": (io.BytesIO(b"fake-image-bytes"), "avatar.png")},
        content_type="multipart/form-data",
        headers=headers,
    )

    assert response.status_code == 200, response.get_data(as_text=True)
    assert response.get_json()["avatar"] == expected_url

    with app_instance.app_context():
        assert db.session.get(UserModel, user_id).profile_picture == expected_url


def test_roster_assign_and_remove_keep_avatar_fields(
    client, init_database, app_instance
):
    with app_instance.app_context():
        admin = db.session.get(UserModel, "adm-1")
        headers = auth_headers_for(admin)
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        student_one = db.session.get(UserModel, "stu-1")
        student_one.profile_picture = "https://example.com/alice.png"

        student_two = UserModel(
            user_id="stu-2",
            role_id=1,
            role="student",
            first_name="Dana",
            last_name="Student",
            email="dana@test.com",
            password_hash="hash",
            status="active",
            token_version=0,
            created_at=now,
            profile_picture="https://example.com/dana.png",
        )
        db.session.add(student_two)
        db.session.commit()

    assigned = client.post(
        "/api/subjects/sub-2/students",
        json={"studentIds": ["stu-2"]},
        headers=headers,
    )
    assert assigned.status_code == 201, assigned.get_data(as_text=True)
    assigned_students = {s["id"]: s for s in assigned.get_json()["students"]}
    assert assigned_students["stu-2"]["avatar"] == "https://example.com/dana.png"
    assert assigned_students["stu-1"]["avatar"] == "https://example.com/alice.png"

    removed = client.delete(
        "/api/subjects/sub-2/students",
        json={"studentIds": ["stu-2"]},
        headers=headers,
    )
    assert removed.status_code == 200, removed.get_data(as_text=True)
    remaining_students = {s["id"]: s for s in removed.get_json()["students"]}
    assert "stu-2" not in remaining_students
    assert remaining_students["stu-1"]["avatar"] == "https://example.com/alice.png"
