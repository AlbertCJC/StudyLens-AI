"""JWT request decorators and live-token validation.

Sessions are validated either from a bearer ``Authorization`` header (mobile
clients) or from the HttpOnly session cookie (web clients). State-changing
requests authenticated through the cookie additionally require a valid CSRF
token (``X-CSRF-Token`` header) so cross-site request forgery cannot drive the
cookie session.
"""

import datetime
from functools import wraps

import jwt
from flask import jsonify, request

from config import (
    AUTH_COOKIE_NAME,
    MOBILE_CLIENT_HEADER,
    MOBILE_CLIENT_VALUE,
    SECRET_KEY,
)
from extensions import db
from lib.material_view_token import verify_material_view_token
from models import UserModel
from models.auth_session import AuthSessionModel

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_bearer_token():
    """Returns the bearer token from the request header, or None."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return None


def _extract_cookie_token():
    """Returns the HttpOnly session cookie value, or None."""
    return request.cookies.get(AUTH_COOKIE_NAME)


def _extract_session_token():
    """Bearer token first, else the HttpOnly session cookie, else None."""
    token = _extract_bearer_token()
    if token:
        return token
    return _extract_cookie_token()


def _is_cookie_authenticated():
    """True when the session token came from the cookie (not a bearer header)."""
    return bool(_extract_cookie_token()) and not _extract_bearer_token()


def _authenticated_user_from_session():
    """Validates the live token (bearer or cookie) against the DB row.

    Rejects tokens whose user was deleted, deactivated, demoted, or had their
    token_version bumped, and rejects any token whose ``jti`` is revoked or not
    recorded in ``auth_sessions`` (server-side revocation).
    """
    token = _extract_session_token()
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
        jti = data.get("jti")
        if not jti:
            return None
        session = db.session.get(AuthSessionModel, jti)
        if not session or session.revoked_at is not None:
            return None
        try:
            session.last_seen_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
            db.session.flush()
        except Exception:
            db.session.rollback()
        return user
    except Exception:
        return None


def _csrf_valid():
    """CSRF check: unsafe cookie-authenticated requests require an X-CSRF-Token header.

    CORS (restricted origins + credentials) already prevents cross-origin header
    forgery, so the header alone is sufficient protection. The double-submit
    cookie is still set for same-origin compatibility. The frontend reads the
    token from the login response body (not document.cookie, which cannot read
    cross-origin cookies).
    """
    header = request.headers.get("X-CSRF-Token")
    return bool(header)


def token_required(f):
    """Annotates ``request.current_user`` when a valid session exists."""
    @wraps(f)
    def decorated(*args, **kwargs):
        request.current_user = None
        if _extract_session_token():
            request.current_user = _authenticated_user_from_session()
            if request.current_user:
                request.current_user = request.current_user.to_dict()
        return f(*args, **kwargs)
    return decorated


def require_auth(f):
    """Strict session gate: rejects requests without a valid session (401).

    Cookie-authenticated unsafe requests additionally require a valid CSRF
    token (403). Bearer-authenticated mobile requests are CSRF-exempt.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _extract_session_token():
            return jsonify({
                "error": "Authentication required. Please log in.",
                "code": "AUTH_REQUIRED",
            }), 401
        user = _authenticated_user_from_session()
        if not user:
            return jsonify({
                "error": "Invalid or expired session. Please log in again.",
                "code": "INVALID_TOKEN",
            }), 401
        request.current_user = user.to_dict()
        if (
            request.method in UNSAFE_METHODS
            and _is_cookie_authenticated()
            and not _csrf_valid()
        ):
            return jsonify({
                "error": "CSRF token missing or invalid.",
                "code": "CSRF_INVALID",
            }), 403
        return f(*args, **kwargs)
    return decorated


def resolve_material_viewer(material_id):
    """Resolves the viewer for an inline material fetch.

    Accepts a normal bearer session, the HttpOnly cookie session, or a short-lived
    signed view token (Office Viewer, which cannot send an Authorization header).
    Returns ``(current_user, None)`` on success or ``(None, (response, status))``.
    """
    if _extract_session_token():
        user = _authenticated_user_from_session()
        if not user:
            return None, (jsonify({
                "error": "Invalid or expired session. Please log in again.",
                "code": "INVALID_TOKEN",
            }), 401)
        return user.to_dict(), None

    view_token = request.args.get("token") or request.args.get("view_token")
    if not view_token:
        return None, (jsonify({
            "error": "Authentication required. Please log in.", "code": "AUTH_REQUIRED",
        }), 401)
    payload = verify_material_view_token(view_token, material_id)
    if not payload:
        return None, (jsonify({
            "error": "Invalid or expired view token.", "code": "INVALID_VIEW_TOKEN",
        }), 403)

    user = db.session.get(UserModel, payload.get("viewer_id"))
    if not user or user.status != "active":
        return None, (jsonify({
            "error": "Invalid or expired session. Please log in again.", "code": "INVALID_TOKEN",
        }), 401)
    return user.to_dict(), None


def require_roles(*roles):
    """Strict RBAC gate: requires a valid session whose role is in ``roles``."""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            current_user = getattr(request, "current_user", None) or {}
            if current_user.get("role") not in roles:
                return jsonify({
                    "error": "You do not have permission to perform this action.",
                    "code": "FORBIDDEN",
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def is_mobile_client():
    """True when the caller identifies as a mobile app (receives token body)."""
    return request.headers.get(MOBILE_CLIENT_HEADER) == MOBILE_CLIENT_VALUE
