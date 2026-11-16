"""Teacher/student data-access rules."""

from models import StudentSubjectModel, SubjectModel


def material_access_allowed(material, current_user):
    """Single authorization rule for reading a material and its stored file.

    - admins: any material
    - teachers: materials in a subject they manage, or materials they uploaded
    - students: materials in an enrolled subject, or their own personal items
    - anyone else: denied
    """
    current_user = current_user or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""

    if role == "admin":
        return True

    if role == "teacher":
        if not user_id:
            return False
        managed_subject_ids = {
            s.subject_id for s in SubjectModel.query.filter_by(teacher_id=user_id).all()
        }
        return material.subject_id in managed_subject_ids or material.teacher_id == user_id

    if role == "student":
        if not user_id:
            return False
        enrolled_ids = {
            e.subject_id
            for e in StudentSubjectModel.query.filter_by(student_id=user_id).all()
        }
        return bool(
            (material.subject_id and material.subject_id in enrolled_ids)
            or (material.material_type == "personal" and material.teacher_id == user_id)
        )

    return False


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
