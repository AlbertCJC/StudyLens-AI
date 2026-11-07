"""Per-user notification creation and fan-out."""

import datetime

from extensions import db
from models import NotificationModel, StudentSubjectModel, UserModel


def _create_notification(user_id, title, message, target=None):
    """Insert a per-user notification row. Called when a platform event (e.g. a
    new quiz) should surface in a user's bell. `target` is an optional route
    hint (e.g. "quiz:<id>") so taps can deep-link to the designated page."""
    if not user_id:
        return
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    notif = NotificationModel(
        notification_id=f"notif-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}-{user_id[-8:]}",
        user_id=user_id,
        title=title,
        message=message,
        created_at=server_now,
        target=target,
    )
    db.session.add(notif)


def _fan_out_quiz_notification(quiz):
    """Notify the students enrolled in a course quiz's subject when a teacher
    publishes/assigns it, so the notice surfaces in each recipient's bell and
    deep-links to the quiz when tapped."""
    if not quiz or not quiz.subject_id or quiz.subject_id in ("", "personal"):
        return
    if quiz.quiz_type != "teacher":
        return
    enrolled_ids = {
        en.student_id for en in StudentSubjectModel.query.filter_by(subject_id=quiz.subject_id).all()
    }
    publisher_id = quiz.teacher_id
    publisher_name = quiz.created_by_name or "A teacher"
    subject_label = quiz.subject_name or "your subject"
    for student_id in enrolled_ids:
        if student_id and student_id != publisher_id:
            _create_notification(
                student_id,
                f"{publisher_name} uploaded a quiz on {subject_label}",
                quiz.title or "A new quiz is available.",
                target=f"quiz:{quiz.quiz_id}",
            )


def _notification_recipients(target_audience):
    """Users to fan a notice out to based on its target audience."""
    if target_audience == "teachers":
        return UserModel.query.filter_by(role="teacher").all()
    if target_audience == "students":
        return UserModel.query.filter_by(role="student").all()
    return UserModel.query.all()
