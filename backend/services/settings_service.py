"""System settings and audit-archiving business logic."""

import datetime

from db.session import _commit_or_warn
from extensions import db
from lib.constants import DEFAULT_SYSTEM_SETTINGS
from models import ActivityLogArchiveModel, ActivityLogModel, SystemSettingModel

def _load_system_settings():
    settings = dict(DEFAULT_SYSTEM_SETTINGS)
    try:
        for row in SystemSettingModel.query.all():
            settings[row.setting_key] = row.setting_value
    except Exception:
        pass
    return settings


def _save_system_settings(settings):
    for key, value in settings.items():
        if key not in DEFAULT_SYSTEM_SETTINGS:
            continue
        row = db.session.get(SystemSettingModel, key)
        if row:
            row.setting_value = str(value)
        else:
            db.session.add(SystemSettingModel(setting_key=key, setting_value=str(value)))
    _commit_or_warn("system settings")


def _boolify_settings(settings):
    try:
        timeout = int(settings.get("sessionTimeoutMins") or 60)
    except (TypeError, ValueError):
        timeout = 60
    return {
        "require2FA": settings.get("require2FA") == "true",
        "maintenanceMode": settings.get("maintenanceMode") == "true",
        "sessionTimeoutMins": max(5, min(1440, timeout)),
        "autoAuditArchiving": settings.get("autoAuditArchiving") == "true",
    }


def _enforce_archiving(settings):
    """Archives activity logs older than 90 days when auto-audit archiving is on."""
    if settings.get("autoAuditArchiving") != "true":
        return
    try:
        cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S")
        old_logs = ActivityLogModel.query.filter(ActivityLogModel.created_at < cutoff).all()
        for log in old_logs:
            db.session.add(ActivityLogArchiveModel(
                log_id=log.log_id, user_id=log.user_id, user_name=log.user_name,
                user_role=log.user_role, activity=log.activity, details=log.details,
                ip_address=log.ip_address, created_at=log.created_at,
            ))
            db.session.delete(log)
        if old_logs:
            _commit_or_warn("audit archiving")
    except Exception:
        pass
