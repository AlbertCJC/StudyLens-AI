"""JWT request decorators and live-token validation."""

from functools import wraps

import jwt
from flask import jsonify, request

from config import SECRET_KEY
from extensions import db
from models import UserModel

def _authenticated_user_from_bearer():
    """Validates the bearer token against the LIVE database row.

    Rejects tokens whose user was deleted, deactivated, demoted, or had their
    token_version bumped (password change/reset, suspension, role change) so those
    changes take effect immediately instead of on the next token refresh. The role
    on a valid request always comes from the DB row, never the client.
    """
    token = _extract_bearer_token()
    if not token:
        return None
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user = db.session.get(UserModel, data.get("user_id"))
        if not user or user.status != "active":
            return None
        if str(user.role) != str(data.get("role")):
            return None
        if int(user.token_version or 0) != int(data.get("token_version") or 0):
            return None
        return user
    except Exception:
        return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _authenticated_user_from_bearer() if _extract_bearer_token() else None
        request.current_user = user.to_dict() if user else None
        return f(*args, **kwargs)
    return decorated


def _extract_bearer_token():
    """Returns the bearer token from the request header, or None."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    return None


def require_auth(f):
    """Strict JWT gate: rejects requests without a valid bearer token (401)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _extract_bearer_token():
            return jsonify({"error": "Authentication required. Please log in.", "code": "AUTH_REQUIRED"}), 401
        user = _authenticated_user_from_bearer()
        if not user:
            return jsonify({"error": "Invalid or expired session. Please log in again.", "code": "INVALID_TOKEN"}), 401
        request.current_user = user.to_dict()
        return f(*args, **kwargs)
    return decorated


def require_roles(*roles):
    """Strict RBAC gate: requires a valid token whose role is in ``roles`` (else 403)."""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            current_user = getattr(request, "current_user", None) or {}
            if current_user.get("role") not in roles:
                return jsonify({"error": "You do not have permission to perform this action.", "code": "FORBIDDEN"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
