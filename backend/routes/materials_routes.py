"""Learning-material routes."""

from flask import Blueprint

from controllers.materials_controller import (
    convert_material_to_pdf,
    delete_material,
    download_material_file,
    extract_material_text,
    flag_material,
    get_material_flags,
    get_materials,
    issue_material_view_token_for_material,
    resolve_material_flag,
    save_ai_resource_as_material,
    update_material,
    upload_material,
    view_material_file,
)
from lib.auth import require_auth, require_roles

bp = Blueprint("materials", __name__)


@bp.route("/api/materials", methods=["GET"])
@require_auth
def get_materials_route():
    return get_materials()


@bp.route("/api/materials/<material_id>/download", methods=["GET"])
@require_auth
def download_material_file_route(material_id):
    return download_material_file(material_id)


@bp.route("/api/materials/<material_id>/convert-to-pdf", methods=["GET"])
@require_auth
def convert_material_to_pdf_route(material_id):
    return convert_material_to_pdf(material_id)


@bp.route("/api/materials/<material_id>/view-token", methods=["POST"])
@require_auth
def issue_material_view_token_route(material_id):
    return issue_material_view_token_for_material(material_id)


@bp.route("/api/materials/<material_id>/view", methods=["GET"])
def view_material_file_route(material_id):
    # Auth is enforced inside the controller so Office Viewer can present a
    # short-lived signed token instead of a bearer header.
    return view_material_file(material_id)


@bp.route("/api/materials/extract", methods=["POST"])
@require_auth
def extract_material_text_route():
    return extract_material_text()


@bp.route("/api/materials/upload", methods=["POST"])
@require_auth
def upload_material_route():
    return upload_material()


@bp.route("/api/materials/from-ai", methods=["POST"])
@require_auth
def save_ai_resource_as_material_route():
    return save_ai_resource_as_material()


@bp.route("/api/materials/<material_id>", methods=["PUT"])
@require_auth
def update_material_route(material_id):
    return update_material(material_id)


@bp.route("/api/materials/<material_id>", methods=["DELETE"])
@require_auth
def delete_material_route(material_id):
    return delete_material(material_id)


@bp.route("/api/materials/<material_id>/flag", methods=["POST"])
@require_roles("admin")
def flag_material_route(material_id):
    return flag_material(material_id)


@bp.route("/api/material-flags", methods=["GET"])
@require_auth
def get_material_flags_route():
    return get_material_flags()


@bp.route("/api/material-flags/<flag_id>/resolve", methods=["POST"])
@require_roles("admin", "teacher")
def resolve_material_flag_route(flag_id):
    return resolve_material_flag(flag_id)
