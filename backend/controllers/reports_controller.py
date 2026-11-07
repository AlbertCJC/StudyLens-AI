"""Report listing, generation and deletion handlers."""

import datetime
import json

from flask import jsonify, request

from db.session import _commit_or_warn
from extensions import db
from models import ReportModel
from services.log_service import log_action
from services.report_service import REPORT_TYPES, _build_report_summary


def handle_reports():
    generated_by = request.args.get("generatedBy", "")
    report_type = request.args.get("reportType", "")
    target_id = request.args.get("targetId", "")
    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        limit, offset = 50, 0
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    query = ReportModel.query
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") == "student":
        # Students only ever see the reports they generated for themselves.
        query = query.filter_by(generated_by=current_user.get("id"))
    elif current_user.get("role") == "teacher":
        # Teachers only see reports they generated (no cross-teacher reads).
        query = query.filter_by(generated_by=current_user.get("id"))
    elif generated_by:
        query = query.filter_by(generated_by=generated_by)
    if report_type:
        query = query.filter_by(report_type=report_type)
    if target_id:
        query = query.filter_by(target_id=target_id)
    total = query.count()
    reports = query.order_by(ReportModel.generated_at.desc()).offset(offset).limit(limit).all()
    return jsonify({
        "reports": [r.to_dict() for r in reports],
        "total": total,
        "hasMore": offset + limit < total,
    })


def create_report():
    data = request.json or {}
    report_type = data.get("reportType") or ""
    if report_type not in REPORT_TYPES:
        return jsonify({"error": f"reportType must be one of: {', '.join(REPORT_TYPES)}.", "code": "INVALID_REPORT_TYPE"}), 400
    current_user = getattr(request, "current_user", None) or {}
    is_student = current_user.get("role") == "student"
    if is_student:
        # Students may only generate their own Student Performance report.
        if report_type != "Student Performance":
            return jsonify({"error": "Students can only generate a Student Performance report.", "code": "FORBIDDEN"}), 403
        data["targetId"] = current_user.get("id")
        data["teacherId"] = ""
    elif current_user.get("role") == "teacher":
        # Teachers are always scoped to their own subjects/students; a client
        # may not widen the scope by omitting or substituting teacherId.
        data["teacherId"] = current_user.get("id")
    summary, status = _build_report_summary(
        report_type,
        str(data.get("targetId") or ""),
        str(data.get("teacherId") or ""),
    )
    if status != 200:
        return jsonify(summary), status
    # Token identity wins over any client-supplied attribution
    generated_by = current_user.get("id") or data.get("generatedBy") or "usr-admin-1"
    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    title = str(data.get("title") or f"{report_type} Report")
    report = ReportModel(
        report_id=f"rpt-{timestamp_ms}",
        generated_by=generated_by,
        report_type=report_type,
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        title=title,
        summary_json=json.dumps(summary, ensure_ascii=False),
        target_id=data.get("targetId"),
    )
    db.session.add(report)
    _commit_or_warn("report")
    log_action(generated_by, current_user.get("name") or "", current_user.get("role") or "teacher", "REPORT_GENERATE", f"Generated {report_type}: {title}")
    return jsonify(report.to_dict()), 201


def handle_report_detail(report_id):
    report = db.session.get(ReportModel, report_id)
    if not report:
        return jsonify({"error": "Report not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") in ("student", "teacher") and report.generated_by != current_user.get("id"):
        return jsonify({"error": "You can only view reports you generated.", "code": "FORBIDDEN"}), 403
    return jsonify(report.to_dict()), 200


def delete_report(report_id):
    report = db.session.get(ReportModel, report_id)
    if not report:
        return jsonify({"error": "Report not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") != "admin" and report.generated_by != current_user.get("id"):
        return jsonify({"error": "You can only delete reports you generated.", "code": "FORBIDDEN"}), 403
    db.session.delete(report)
    _commit_or_warn("report deletion")
    return jsonify({"success": True}), 200
