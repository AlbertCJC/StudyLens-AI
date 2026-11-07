"""Notification list and read-state handlers."""

import datetime

from flask import jsonify, request

from db.session import _commit_or_warn
from models import NotificationModel


def get_notifications():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    notifs = NotificationModel.query.filter_by(user_id=user_id).order_by(NotificationModel.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifs])


def mark_notification_read(notification_id):
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    notif = NotificationModel.query.filter_by(notification_id=notification_id, user_id=user_id).first()
    if not notif:
        return jsonify({"error": "Notification not found.", "code": "NOT_FOUND"}), 404
    if not notif.read_at:
        notif.read_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        _commit_or_warn("notification read")
    return jsonify(notif.to_dict()), 200


def mark_all_notifications_read():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    notifs = NotificationModel.query.filter_by(user_id=user_id).all()
    changed = False
    for n in notifs:
        if not n.read_at:
            n.read_at = now
            changed = True
    if changed:
        _commit_or_warn("notifications read-all")
    return jsonify({"success": True}), 200
