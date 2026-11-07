"""Handlers for serving user-uploaded files safely."""

import mimetypes
import os

from flask import jsonify, send_file

from config import _UPLOADS_DIR


def serve_uploaded_file(req_filename):
    """Serves a file from the local uploads fallback directory.

    The client-supplied path is never used directly: we take only its basename,
    resolve it inside _UPLOADS_DIR, and verify the result stays within the
    uploads root (blocks traversal). Active content (html/htm/svg/xml/js) is
    forced to download rather than render in the app origin, and every response is
    marked nosniff with an opaque CSP so a previously-uploaded file can't XSS the
    dashboard even if it were somehow stored.
    """
    name = os.path.basename(req_filename.replace("\\", "/"))
    if name in ("", ".", ".."):
        return jsonify({"error": "File not found.", "code": "NOT_FOUND"}), 404

    try:
        real_root = os.path.realpath(_UPLOADS_DIR).rstrip("\\/")
        real_file = os.path.realpath(os.path.join(_UPLOADS_DIR, name))
    except (ValueError, OSError):
        return jsonify({"error": "File not found.", "code": "NOT_FOUND"}), 404
    if not (real_file == real_root or real_file.startswith(real_root + os.sep)):
        return jsonify({"error": "File not found.", "code": "NOT_FOUND"}), 404
    if not os.path.isfile(real_file):
        return jsonify({"error": "File not found.", "code": "NOT_FOUND"}), 404

    ext = os.path.splitext(name)[1].lower()
    # Extensions that a browser would otherwise render as active content must
    # download as attachments instead of executing in the StudyLens origin.
    force_download = ext in (".html", ".htm", ".svg", ".xml", ".js", ".mjs", ".json")
    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"

    response = send_file(
        real_file,
        mimetype=mime,
        as_attachment=force_download,
        download_name=name,
        conditional=True,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response.headers["Cache-Control"] = "private, max-age=3600"
    return response
