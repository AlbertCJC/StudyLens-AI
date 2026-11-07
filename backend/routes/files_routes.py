"""Upload-serving routes."""

from flask import Blueprint

from controllers.files_controller import serve_uploaded_file

bp = Blueprint("files", __name__)


@bp.route("/uploads/<path:req_filename>")
def serve_uploaded_file_route(req_filename):
    return serve_uploaded_file(req_filename)
