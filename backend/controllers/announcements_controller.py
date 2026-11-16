"""Announcement feed and authoring handlers."""

import datetime

from flask import jsonify, request

from sqlalchemy.orm import selectinload

from db.session import _commit_or_warn
from extensions import db
from lib.id import generate_id
from models import AnnouncementModel, NotificationModel, StudentSubjectModel, SubjectModel
from services.log_service import log_action


def list_announcements():
    current_user = getattr(request, "current_user", None) or {}
    requester_id = current_user.get("id") or ""
    requester_role = current_user.get("role") or ""
    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int)
    anns = (
        AnnouncementModel.query.options(selectinload(AnnouncementModel.subject))
        .order_by(AnnouncementModel.created_at.desc())
        .all()
    )
    # Strict visibility policy: fresh accounts see nothing until data exists for
    # them. Students receive ONLY subject-scoped announcements for subjects they
    # are enrolled in; teachers see ONLY their own posts; admins see everything.
    if requester_role == "student":
        enrolled = {
            e.subject_id
            for e in StudentSubjectModel.query.filter_by(student_id=requester_id).all()
        } if requester_id else set()
        anns = [
            a for a in anns
            if a.target_audience in ("all", "students")
            and (
                # subject-scoped posts from classes the student is enrolled in
                (a.subject_id and a.subject_id in enrolled)
                # or platform-wide notices authored by administrators
                or (a.teacher_id or "").startswith("usr-admin")
            )
        ]
    elif requester_role == "teacher":
        # Teachers see their own posts plus platform-wide notices authored by admins.
        anns = [
            a for a in anns
            if requester_id and (
                a.teacher_id == requester_id
                or (a.teacher_id or "").startswith("usr-admin")
            )
        ]
    elif requester_role == "admin":
        # Admins see ONLY system announcements they authored. Teacher posts are
        # not surfaced in the admin announcements feed - teacher activity is
        # tracked separately via the audit activity logs.
        anns = [
            a for a in anns
            if (a.teacher_id or "").startswith("usr-admin")
        ]
    total = len(anns)
    if limit is None and offset is None:
        return jsonify([a.to_dict() for a in anns])
    limit = max(1, min(200, limit or 100))
    offset = max(0, offset or 0)
    page = anns[offset:offset + limit]
    return jsonify({
        "items": [a.to_dict() for a in page],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": (offset + len(page)) < total,
    })


def post_announcement():
    data = request.json or {}
    if not data.get("title"):
        return jsonify({"error": "Announcement title is required.", "code": "EMPTY_TITLE"}), 400
    current_user = getattr(request, "current_user", None) or {}
    author_id = current_user.get("id") or data.get("teacherId") or data.get("createdById") or "usr-admin-1"
    author_name = current_user.get("name") or data.get("authorName") or "Faculty"
    author_role = current_user.get("role") or "teacher"
    subject_id = data.get("subjectId")
    target_audience = data.get("targetAudience") or "all"
    if author_role == "teacher":
        # Teacher notices are always delivered to the students enrolled in the
        # selected subject: a subject is mandatory and any client-supplied
        # audience hint (e.g. "teachers") is ignored.
        if not subject_id:
            return jsonify({
                "error": "Select a subject so enrolled students receive this announcement.",
                "code": "SUBJECT_REQUIRED",
            }), 400
        # A teacher may only post to a subject they actually teach, preventing
        # cross-class spam/phishing in another instructor's classroom.
        subject = db.session.get(SubjectModel, subject_id)
        if not subject or subject.teacher_id != author_id:
            return jsonify({"error": "You can only post announcements to subjects you teach.", "code": "FORBIDDEN"}), 403
        target_audience = "students"
    elif author_role == "admin":
        # Admins may post system-wide announcements without tying to a subject.
        target_audience = "all"
        subject_id = None
    # Server-stamp all timestamps: client-provided values (e.g. optimistic
    # placeholders like "Just now") are never persisted.
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_ann = AnnouncementModel(
        announcement_id=generate_id("ann"),
        teacher_id=author_id,
        subject_id=subject_id,
        title=data["title"],
        message=data.get("content") or data.get("message") or "",
        created_at=server_now,
        updated_at=server_now,
        posted_at=server_now,
        author_name=author_name,
        target_audience=target_audience,
        priority=data.get("priority") or "medium"
    )
    db.session.add(new_ann)
    _commit_or_warn("announcement")
    # Announcements surface in each recipient's bell directly from the
    # announcements feed (announcement items), so no duplicate per-user
    # notification row is created here (that previously caused the same
    # announcement to appear twice in the bell).
    log_action(author_id, author_name, author_role,
               "ANNOUNCEMENT_POSTED", f"Posted announcement '{data['title']}'")
    return jsonify(new_ann.to_dict()), 201


def update_announcement(announcement_id):
    """Edit an existing announcement (author, or an admin for system notices).

    Editable: title, message/content, priority. Administrators may also retarget
    system-wide announcements. The subject of a course announcement cannot be
    changed: it defines who received the notice, so edits never silently
    re-target a different class.
    """
    ann = db.session.get(AnnouncementModel, announcement_id)
    if not ann:
        return jsonify({"error": "Announcement not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    is_admin = role == "admin"
    is_author = bool(ann.teacher_id) and ann.teacher_id == current_user.get("id")
    is_admin_system = is_admin and not ann.subject_id
    if not (is_author or is_admin_system):
        return jsonify({"error": "You can only edit announcements you posted.", "code": "FORBIDDEN"}), 403

    data = request.json or {}
    changed = False
    if "title" in data and str(data["title"]).strip():
        ann.title = str(data["title"]).strip()
        changed = True
    new_message = data.get("message", data.get("content"))
    if new_message is not None:
        ann.message = str(new_message)
        changed = True
    if data.get("priority") in ("high", "medium", "low"):
        ann.priority = data["priority"]
        changed = True
    if is_admin_system and data.get("targetAudience") in ("all", "students", "teachers"):
        ann.target_audience = data["targetAudience"]
        changed = True
    if not changed:
        return jsonify({"error": "Nothing to update.", "code": "NO_CHANGES"}), 400

    ann.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    _commit_or_warn("announcement update")
    log_action(current_user.get("id") or "unknown", current_user.get("name") or "Unknown",
               role, "ANNOUNCEMENT_UPDATED", f"Edited announcement '{ann.title}'")
    return jsonify(ann.to_dict()), 200


def delete_announcement(announcement_id):
    ann = db.session.get(AnnouncementModel, announcement_id)
    if not ann:
        return jsonify({"error": "Announcement not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    is_author = bool(ann.teacher_id) and ann.teacher_id == current_user.get("id")
    is_admin_system = role == "admin" and not ann.subject_id
    if not (is_author or is_admin_system):
        return jsonify({"error": "You can only delete announcements you posted.", "code": "FORBIDDEN"}), 403
    db.session.delete(ann)
    # Cascade-delete any notifications tied to this announcement so the bell
    # does not keep surfacing a removed announcement. target is set to
    # "announcement:<id>" whenever an announcement is fan-out to users.
    NotificationModel.query.filter(
        NotificationModel.target == f"announcement:{announcement_id}"
    ).delete(synchronize_session=False)
    _commit_or_warn("announcement deletion")
    log_action(current_user.get("id") or "unknown", current_user.get("name") or "Unknown",
               current_user.get("role") or "user", "ANNOUNCEMENT_DELETED",
               f"Deleted announcement '{ann.title}'")
    return jsonify({"success": True}), 200
