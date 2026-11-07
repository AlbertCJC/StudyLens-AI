"""Teacher/student data-access rules."""

from models import StudentSubjectModel, SubjectModel

def _teacher_covers_student(teacher_id, student_id):
    """True when the teacher manages at least one subject the student is enrolled in.

    This is the single arbiter for teacher<->student data access: a teacher may
    see a student's progress/recommendations/reports only through a subject they
    actually teach (no cross-class or arbitrary-ID reads).
    """
    if not teacher_id or not student_id:
        return False
    managed = {s.subject_id for s in SubjectModel.query.filter_by(teacher_id=teacher_id).all()}
    if not managed:
        return False
    return StudentSubjectModel.query.filter(
        StudentSubjectModel.subject_id.in_(managed),
        StudentSubjectModel.student_id == student_id,
    ).first() is not None


def _can_view_student_data(current_user, student_id):
    """RBAC guard for student-owned data endpoints.

    - admins: anyone
    - students: themselves only
    - teachers: students enrolled in a subject they manage
    - anyone else: denied
    """
    role = current_user.get("role")
    user_id = current_user.get("id")
    if role == "admin":
        return True
    if role == "student":
        return user_id == student_id
    if role == "teacher":
        return _teacher_covers_student(user_id, student_id)
    return False
