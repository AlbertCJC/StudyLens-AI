"""Report routes."""

from flask import Blueprint

from controllers.reports_controller import (
    create_report,
    delete_report,
    handle_report_detail,
    handle_reports,
)
from lib.auth import require_roles

bp = Blueprint("reports", __name__)


@bp.route("/api/reports", methods=["GET"])
@require_roles("teacher", "admin")
def handle_reports_route():
    return handle_reports()


@bp.route("/api/reports", methods=["POST"])
@require_roles("teacher", "admin")
def create_report_route():
    return create_report()


@bp.route("/api/reports/<report_id>", methods=["GET"])
@require_roles("teacher", "admin")
def handle_report_detail_route(report_id):
    return handle_report_detail(report_id)


@bp.route("/api/reports/<report_id>", methods=["DELETE"])
@require_roles("teacher", "admin")
def delete_report_route(report_id):
    return delete_report(report_id)
