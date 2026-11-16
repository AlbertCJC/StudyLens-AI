"""Short-lived signed tokens for inline material previews.

Microsoft Office Viewer fetches the file server-side and cannot send an
Authorization header. Rather than leaving the view endpoint anonymous, callers
exchange their bearer session for a short-lived HMAC-signed token scoped to one
material. The view endpoint accepts either the bearer token or this signature.
"""

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from config import SECRET_KEY

VIEW_TOKEN_SALT = "material-view"
VIEW_TOKEN_TTL_SECONDS = 90


def _serializer():
    return URLSafeTimedSerializer(SECRET_KEY, salt=VIEW_TOKEN_SALT)


def issue_material_view_token(material_id, viewer_id):
    """Returns a signed, time-limited token for one material and viewer."""
    payload = {
        "material_id": str(material_id),
        "viewer_id": str(viewer_id),
        "purpose": "material-view",
    }
    return _serializer().dumps(payload)


def verify_material_view_token(token, material_id):
    """Returns the token payload when valid for ``material_id``, else ``None``."""
    if not token:
        return None
    try:
        payload = _serializer().loads(token, max_age=VIEW_TOKEN_TTL_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(payload, dict):
        return None
    if payload.get("purpose") != "material-view":
        return None
    if str(payload.get("material_id")) != str(material_id):
        return None
    if not payload.get("viewer_id"):
        return None
    return payload
