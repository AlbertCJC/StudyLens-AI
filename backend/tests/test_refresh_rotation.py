"""Refresh-token rotation (P1-01)."""

import datetime

from app import generate_token
from services.auth_service import (
    REFRESH_TOKEN_DAYS,
    generate_refresh_token,
    refresh_access_token,
    revoke_all_sessions,
    revoke_all_refresh_tokens,
)


def _utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def test_refresh_rotates_and_invalidates_old_token(app_instance, init_database):
    """Refreshing issues a new access+refresh pair and revokes the old refresh jti."""
    from models import RefreshTokenModel
    from models import UserModel

    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
        user_id = user.user_id

    refresh_token, refresh_jti = generate_refresh_token({
        "id": user_id, "email": "alice@test.com", "role": "admin",
        "tokenVersion": 0,
    })

    result = refresh_access_token(refresh_token)
    assert result is not None
    access_token, _access_jti, new_refresh_token, new_refresh_jti = result
    assert new_refresh_token != refresh_token
    assert new_refresh_jti != refresh_jti

    # Old refresh jti must now be revoked.
    with app_instance.app_context():
        row = RefreshTokenModel.query.get(refresh_jti)
        assert row is not None
        assert row.revoked_at is not None
    # Old refresh token is rejected.
    assert refresh_access_token(refresh_token) is None


def test_refresh_reuse_revokes_family(app_instance, init_database):
    """Reusing a revoked refresh token revokes all sessions and refresh tokens."""
    from models import RefreshTokenModel
    from models import AuthSessionModel
    from models import UserModel

    with app_instance.app_context():
        user = UserModel.query.filter_by(email="alice@test.com").first()
        user_id = user.user_id
        # Create an access session for the user.
        token, jti = generate_token({
            "id": user_id, "email": "alice@test.com", "role": "admin",
            "tokenVersion": 0,
        })
        session_row = AuthSessionModel.query.get(jti)
        assert session_row is not None

    refresh_token, refresh_jti = generate_refresh_token({
        "id": user_id, "email": "alice@test.com", "role": "admin",
        "tokenVersion": 0,
    })

    # Rotate once (valid).
    refresh_access_token(refresh_token)
    # Reuse the ORIGINAL (now revoked) refresh token -> family revocation.
    assert refresh_access_token(refresh_token) is None

    with app_instance.app_context():
        refresh_row = RefreshTokenModel.query.get(refresh_jti)
        assert refresh_row.revoked_at is not None
        access_row = AuthSessionModel.query.get(jti)
        assert access_row.revoked_at is not None


def test_refresh_rejects_unknown_jti(app_instance):
    """A refresh token with an unknown jti is rejected."""
    from services.auth_service import refresh_access_token
    assert refresh_access_token("made-up.jti.token") is None


def test_refresh_token_days_constant():
    assert REFRESH_TOKEN_DAYS == 30
