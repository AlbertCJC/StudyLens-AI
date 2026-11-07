"""Subject routes."""

from flask import Blueprint

from controllers.subjects_controller import (
    assign_subject_students,
    create_subject,
    delete_subject,
    get_subject,
    get_subject_grades,
    get_subject_students,
    get_subjects,
    unassign_subject_students,
    update_subject,
)
from lib.auth import require_auth, require_roles

bp = Blueprint("subjects", __name__)


@bp.route("/api/subjects", methods=["GET"])
@require_auth
def get_subjects_route():
    return get_subjects()


@bp.route("/api/subjects", methods=["POST"])
@require_roles("admin")
def create_subject_route():
    return create_subject()


@bp.route("/api/subjects/<subject_id>", methods=["PUT"])
@require_roles("admin")
def update_subject_route(subject_id):
    return update_subject(subject_id)


@bp.route("/api/subjects/<subject_id>", methods=["DELETE"])
@require_roles("admin")
def delete_subject_route(subject_id):
    return delete_subject(subject_id)


@bp.route("/api/subjects/<subject_id>", methods=["GET"])
@require_auth
def get_subject_route(subject_id):
    return get_subject(subject_id)


@bp.route("/api/subjects/<subject_id>/students", methods=["GET"])
@require_auth
def get_subject_students_route(subject_id):
    return get_subject_students(subject_id)


@bp.route("/api/subjects/<subject_id>/students", methods=["POST"])
@require_roles("admin")
def assign_subject_students_route(subject_id):
    return assign_subject_students(subject_id)


@bp.route("/api/subjects/<subject_id>/students", methods=["DELETE"])
@require_roles("admin")
def unassign_subject_students_route(subject_id):
    return unassign_subject_students(subject_id)


@bp.route("/api/subjects/<subject_id>/grades", methods=["GET"])
@require_auth
def get_subject_grades_route(subject_id):
    return get_subject_grades(subject_id)
