"""Handlers for system metadata, settings and backup."""

import datetime

from flask import jsonify, request

from extensions import db
from lib.constants import DEFAULT_SYSTEM_SETTINGS
from models import (
    AIGeneratedContentModel,
    ActivityLogArchiveModel,
    ActivityLogModel,
    AnnouncementModel,
    MaterialModel,
    QuizAttemptModel,
    QuizModel,
    QuizQuestionModel,
    ReportModel,
    RoleModel,
    StudentProgressModel,
    StudentSubjectModel,
    SubjectModel,
    SystemSettingModel,
    UserModel,
)
from services.log_service import log_action
from services.settings_service import (
    _boolify_settings,
    _enforce_archiving,
    _load_system_settings,
    _save_system_settings,
)


def health():
    """Liveness probe with the active database backend (no credentials).

    Also verifies the database is reachable (readiness): returns 503 when a
    simple query fails so orchestrators can stop routing traffic to an instance
    whose database is down.
    """
    from config import DB_TARGET
    from sqlalchemy import text

    target = (DB_TARGET or "").lower()
    if target.startswith("mysql"):
        backend = "mysql"
    elif target.startswith("sqlite"):
        backend = "sqlite"
    else:
        backend = target.split(":", 1)[0] or "unknown"

    database_ready = False
    try:
        db.session.execute(text("SELECT 1"))
        database_ready = True
    except Exception:
        database_ready = False

    if not database_ready:
        return jsonify({
            "status": "fail",
            "databaseBackend": backend,
            "databaseReady": False,
        }), 503
    return jsonify({
        "status": "ok",
        "databaseBackend": backend,
        "databaseReady": True,
    })


def get_system_info():
    return jsonify({
        "platformName": "StudyLens AI: An Adaptive Learning and Automated Assessment Generation Platform",
        "institution": "University of Cebu – Main Campus, College of Computer Studies (UC CCS)",
        "degree": "Bachelor of Science in Information Technology (BSIT)",
        "capstoneTeam": {
            "projectManager": "John Wendyl S. Sanchez",
            "programmer": "Vin Henry S. Ardiente",
            "designer": "Precious Marie B. Salve",
            "qaTester": "Jeric Nino G. Solitana",
            "adviser": "Christian C. Barral, MIT",
            "dean": "Neil A. Basabe, DIT"
        },
        "version": "2.0.0 (Groq GPT-OSS-120B Edition)",
        "techStack": {
            "webFrontend": "React + Vite + Tailwind CSS",
            "mobileApp": "React-Native",
            "backend": "Python - Flask",
            "database": "MySQL (14 Mapped ERD Tables)",
            "authentication": "JSON Web Token (JWT) & Role-Based Access Control",
            "cloudStorage": "Cloudinary / Firebase Storage",
            "aiIntegration": "Groq Inference API (GPT-OSS-120B LLM)"
        },
        "sdgs": [
            "SDG 4: Quality Education",
            "SDG 9: Industry, Innovation, and Infrastructure"
        ]
    })


def get_system_settings():
    return jsonify(_boolify_settings(_load_system_settings()))


def save_system_settings():
    data = request.json or {}
    settings = _load_system_settings()
    for key in DEFAULT_SYSTEM_SETTINGS:
        if key in data:
            val = data[key]
            if isinstance(val, bool):
                settings[key] = "true" if val else "false"
            else:
                settings[key] = str(val)
    # Clamp session timeout to a sane range so a bad write can't break logins
    try:
        timeout = int(settings.get("sessionTimeoutMins") or 60)
    except (TypeError, ValueError):
        timeout = 60
    settings["sessionTimeoutMins"] = str(max(5, min(1440, timeout)))
    _save_system_settings(settings)
    _enforce_archiving(settings)

    current_user = getattr(request, "current_user", None) or {}
    changed_keys = [key for key in DEFAULT_SYSTEM_SETTINGS if key in data]
    log_action(
        current_user.get("id") or "sys-admin",
        current_user.get("name") or "System Administrator",
        current_user.get("role") or "system",
        "SETTINGS_UPDATED",
        f"System settings updated: {', '.join(changed_keys) or 'none'}",
    )
    return jsonify(_boolify_settings(settings))


def system_backup():
    """Dumps all application tables into a single JSON payload for backup."""
    def rows(model):
        return [
            r.to_dict() if hasattr(r, "to_dict") else {c.name: getattr(r, c.name) for c in model.__table__.columns}
            for r in model.query.all()
        ]
    payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "users": rows(UserModel),
        "roles": rows(RoleModel),
        "subjects": rows(SubjectModel),
        "materials": rows(MaterialModel),
        "quizzes": rows(QuizModel),
        "quizQuestions": rows(QuizQuestionModel),
        "quizAttempts": rows(QuizAttemptModel),
        "studentProgress": rows(StudentProgressModel),
        "studentSubjects": rows(StudentSubjectModel),
        "announcements": rows(AnnouncementModel),
        "reports": rows(ReportModel),
        "aiGeneratedContent": rows(AIGeneratedContentModel),
        "activityLogs": rows(ActivityLogModel),
        "systemSettings": rows(SystemSettingModel),
        "auditArchive": rows(ActivityLogArchiveModel),
    }
    return jsonify(payload), 200
