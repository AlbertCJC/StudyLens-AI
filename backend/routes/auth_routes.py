"""Authentication routes."""

from flask import Blueprint

from controllers.auth_controller import (
    auth_change_password,
    auth_login,
    auth_logout,
    auth_logout_all,
    auth_refresh,
    auth_register,
    auth_request_reset_otp,
    auth_reset_password,
    auth_verify_reset_otp,
    resend_email_code,
    resend_two_factor_code,
    verify_email,
    verify_two_factor,
)
from lib.auth import require_auth

bp = Blueprint("auth", __name__)


@bp.route("/api/auth/login", methods=["POST"])
def auth_login_route():
    return auth_login()


@bp.route("/api/auth/verify-2fa", methods=["POST"])
def verify_two_factor_route():
    return verify_two_factor()


@bp.route("/api/auth/register", methods=["POST"])
def auth_register_route():
    return auth_register()


@bp.route("/api/auth/verify-email", methods=["POST"])
def verify_email_route():
    return verify_email()


@bp.route("/api/auth/resend-email-code", methods=["POST"])
def resend_email_code_route():
    return resend_email_code()


@bp.route("/api/auth/resend-2fa", methods=["POST"])
def resend_two_factor_code_route():
    return resend_two_factor_code()


@bp.route("/api/auth/change-password", methods=["POST"])
@require_auth
def auth_change_password_route():
    return auth_change_password()


@bp.route("/api/auth/reset-otp", methods=["POST"])
def auth_request_reset_otp_route():
    return auth_request_reset_otp()


@bp.route("/api/auth/verify-reset-otp", methods=["POST"])
def auth_verify_reset_otp_route():
    return auth_verify_reset_otp()


@bp.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password_route():
    return auth_reset_password()


@bp.route("/api/auth/logout", methods=["POST"])
@require_auth
def auth_logout_route():
    return auth_logout()


@bp.route("/api/auth/logout-all", methods=["POST"])
@require_auth
def auth_logout_all_route():
    return auth_logout_all()


@bp.route("/api/auth/refresh", methods=["POST"])
def auth_refresh_route():
    return auth_refresh()
