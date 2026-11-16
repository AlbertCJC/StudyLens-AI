"""Learning-material handlers (upload, files, edits, flags)."""

import datetime
import io
import mimetypes
import os
import re
from urllib.parse import urlparse
from urllib.request import urlopen

from flask import jsonify, request, send_file

from sqlalchemy.orm import selectinload

from cloud_storage import upload_file_to_cloud, get_signed_download_url
from config import ALLOWED_MATERIAL_EXTENSIONS, _UPLOADS_DIR
from db import session as db_session
from db.session import _commit_or_warn
from extensions import db
from lib.auth import resolve_material_viewer
from lib.files import _clean_extracted_text, _delete_local_upload, _extract_text_from_file
from lib.material_view_token import (
    VIEW_TOKEN_TTL_SECONDS,
    issue_material_view_token,
)
from lib.rate_limit import _ai_rate_limited
from lib.id import generate_id
from lib.remote_file import validate_remote_file_url
from models import MaterialFlagModel, MaterialModel, StudentSubjectModel, SubjectModel
from services.access_service import material_access_allowed
from services.log_service import log_action
from services.material_service import (
    MATERIAL_FLAG_CATEGORIES,
    _render_ai_resource_text,
    _resolve_material_flags,
)
from services.notification_service import _create_notification


# ---------------------------------------------------------------------------
# Shared material file-access helpers (P2-04)
#
# The download, convert, and view routes previously each inlined their own
# file-fetch and access-check logic. These helpers centralize that logic so a
# security fix applies to all three routes equally.
# ---------------------------------------------------------------------------


def _get_material_or_404(material_id):
    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return None, (jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404)
    return mat, None


def _assert_material_access(mat, current_user):
    if not material_access_allowed(mat, current_user):
        return jsonify({"error": "You do not have access to this material.", "code": "FORBIDDEN"}), 403
    return None


def _normalize_ext(file_type):
    return re.sub(r"[^a-z0-9]", "", (file_type or "").lower().lstrip(".")) or "bin"


def _safe_title(title):
    return re.sub(r"[^A-Za-z0-9 _-]+", "", title or "material").strip()[:80] or "material"


def _fetch_stored_bytes(target_url, ext):
    """Fetch bytes for a cloud-stored material file.

    Cloudinary image-backed PDFs are rewritten to short-lived signed URLs;
    raw resources use the raw download pipeline. The resulting URL is validated
    against the SSRF allowlist before fetching.
    """
    fetch_url = target_url
    if ext in ("pdf", "doc", "docx", "ppt", "pptx") and (
        "/image/upload/" in target_url or "/raw/upload/" in target_url
    ):
        try:
            import cloudinary
            import cloudinary.utils

            cloudinary.config(cloudinary_url=os.getenv("CLOUDINARY_URL", "").strip())
            path = urlparse(target_url).path
            marker = "/raw/upload/" if "/raw/upload/" in path else "/image/upload/"
            rest = path[path.find(marker) + len(marker):]
            parts = [p for p in rest.split("/") if p]
            if parts and re.fullmatch(r"v\d+", parts[0]):
                parts = parts[1:]
            public_id = re.sub(r"\.(pdf|doc|docx|ppt|pptx)$", "", "/".join(parts), flags=re.I)
            if public_id:
                resource_type = "raw" if ext != "pdf" else "image"
                fetch_url = cloudinary.utils.private_download_url(
                    public_id, ext, resource_type=resource_type, type="upload"
                )
        except Exception:
            fetch_url = target_url

    safe_url, reason = validate_remote_file_url(fetch_url)
    if reason:
        raise ValueError(f"Unsafe stored file URL: {reason}")
    with urlopen(safe_url, timeout=30) as response:
        return response.read()


def _serve_local_file(url, ext, title, as_attachment, download_name, cors_headers=False):
    name = os.path.basename(url.replace("\\", "/"))
    real_root = os.path.realpath(_UPLOADS_DIR).rstrip("\\/")
    real_file = os.path.realpath(os.path.join(_UPLOADS_DIR, name))
    if not (real_file == real_root or real_file.startswith(real_root + os.sep)) or not os.path.isfile(real_file):
        return None, (jsonify({"error": "File not found.", "code": "NOT_FOUND"}), 404)
    if not download_name:
        download_name = name
    mimetype = mimetypes.guess_type(download_name)[0] or "application/octet-stream"
    response = send_file(real_file, mimetype=mimetype, as_attachment=as_attachment, download_name=download_name)
    if cors_headers:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response, None


def _serve_remote_file(url, ext, title, as_attachment, download_name, cors_headers=False):
    try:
        file_bytes = _fetch_stored_bytes(url, ext)
    except ValueError:
        return None, (jsonify({"error": "Unsafe file location.", "code": "UNSAFE_FILE_URL"}), 400)
    except Exception:
        return None, (jsonify({"error": "Could not fetch the stored file.", "code": "STORAGE_UNAVAILABLE"}), 502)
    if not download_name:
        download_name = os.path.basename(urlparse(url).path) or f"{title}.{ext}"
    mimetype = mimetypes.guess_type(download_name)[0] or "application/octet-stream"
    response = send_file(io.BytesIO(file_bytes), mimetype=mimetype, as_attachment=as_attachment, download_name=download_name)
    if cors_headers:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response, None


def get_materials():
    current_user = getattr(request, "current_user", None) or {}
    requester_role = current_user.get("role") or ""
    requester_id = current_user.get("id") or ""

    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int)

    # Newest first so a freshly saved resource is on page 1 of the client-side
    # paginated grid. uploaded_at is an ISO-8601 string, so lexical order is
    # chronological. Without this the grid renders primary-key order (oldest
    # first) and new saves appear to "vanish" onto the last page.
    mats = (
        MaterialModel.query.options(selectinload(MaterialModel.subject))
        .order_by(MaterialModel.uploaded_at.desc())
        .all()
    )

    # Privacy Rule: teachers only see materials belonging to the subjects they manage
    # (plus their own personal notes and their own uploads, including unassigned
    # AI-saved materials awaiting a subject). Admins see the full catalog. Students
    # see everything except unassigned teacher drafts.
    if requester_role == "teacher":
        managed_subject_ids = {
            s.subject_id for s in SubjectModel.query.filter_by(teacher_id=requester_id).all()
        }
        mats = [
            m for m in mats
            if m.subject_id in managed_subject_ids or m.teacher_id == requester_id
        ]
    elif requester_role == "student":
        # Students see course materials ONLY for subjects they are enrolled in,
        # plus their own personal items. No enrollment -> empty catalog.
        enrolled_ids = {
            e.subject_id
            for e in StudentSubjectModel.query.filter_by(student_id=requester_id).all()
        } if requester_id else set()
        mats = [
            m for m in mats
            if (m.subject_id and m.subject_id in enrolled_ids)
            or (m.material_type == "personal" and m.teacher_id == requester_id)
        ]

    total = len(mats)
    if limit is None and offset is None:
        # Legacy array response for clients that have not been updated.
        return jsonify([m.to_dict() for m in mats])
    limit = max(1, min(200, limit or 100))
    offset = max(0, offset or 0)
    page = mats[offset:offset + limit]
    return jsonify({
        "items": [m.to_dict() for m in page],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": (offset + len(page)) < total,
    })


def download_material_file(material_id):
    """Download the original uploaded material file (not a generated notes PDF).

    Mirrors the quiz download contract: the server streams the stored file with
    ``as_attachment=True`` so the browser saves the exact PDF/document the user
    previews. Access follows the same visibility rules as GET /api/materials.
    """
    mat, err = _get_material_or_404(material_id)
    if err:
        return err
    current_user = getattr(request, "current_user", None) or {}
    err = _assert_material_access(mat, current_user)
    if err:
        return err

    url = (mat.file_url or "").strip()
    if not url:
        return jsonify({"error": "This material has no downloadable file.", "code": "NOT_FOUND"}), 404

    ext = _normalize_ext(mat.file_type)
    title = _safe_title(mat.title)
    download_name = f"{title}.{ext}"

    if url.startswith("/uploads/"):
        response, err = _serve_local_file(url, ext, title, True, download_name)
        if err:
            return err
        return response

    # Cloud storage key (Cloudinary public_id or Firebase blob name) - generate
    # a short-lived signed URL and stream the file to the client.
    signed_url = get_signed_download_url(url, ext)
    try:
        import urllib.request
        with urllib.request.urlopen(signed_url) as resp:
            file_bytes = resp.read()
    except Exception:
        return jsonify({"error": "Could not fetch the stored file.", "code": "STORAGE_UNAVAILABLE"}), 502

    as_attachment = ext not in ("pdf", "doc", "docx")
    response = send_file(
        io.BytesIO(file_bytes),
        mimetype=mimetypes.guess_type(download_name)[0] or "application/octet-stream",
        as_attachment=as_attachment,
        download_name=download_name,
    )
    return response


def convert_material_to_pdf(material_id):
    """Convert a DOC/DOCX material to a real PDF download.

    Uses LibreOffice headless (soffice) when available so the output preserves
    formatting, tables, and images. Falls back to rendering extracted text via
    reportlab if soffice is missing or conversion fails, so the download never
    hard-fails. Access follows the same rules as GET /api/materials.
    """
    import shutil
    import subprocess
    import tempfile

    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    if not material_access_allowed(mat, current_user):
        return jsonify({"error": "You do not have access to this material.", "code": "FORBIDDEN"}), 403

    ext = _normalize_ext(mat.file_type)
    if ext not in ("doc", "docx"):
        return jsonify({
            "error": "PDF conversion is only available for Word (.doc/.docx) documents.",
            "code": "BAD_REQUEST",
        }), 400

    url = (mat.file_url or "").strip()
    if not url:
        return jsonify({"error": "This material has no downloadable file.", "code": "NOT_FOUND"}), 404

    safe_title = _safe_title(mat.title)

    def _render_text_fallback():
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=letter,
            rightMargin=0.8 * inch,
            leftMargin=0.8 * inch,
            topMargin=0.8 * inch,
            bottomMargin=0.8 * inch,
            title=safe_title,
            author="StudyLens AI",
        )
        styles = getSampleStyleSheet()
        body = styles["BodyText"]
        story = [Paragraph(safe_title, styles["Heading1"]), Spacer(1, 12)]
        text = mat.extracted_text or mat.description or mat.title or ""
        for para in text.split("\n"):
            if para.strip():
                story.append(Paragraph(para, body))
            else:
                story.append(Spacer(1, 6))
        doc.build(story)
        buf.seek(0)
        return buf.read()

    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        for cand in [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]:
            if os.path.isfile(cand):
                soffice = cand
                break

    file_bytes = None
    if url.startswith("/uploads/"):
        name = os.path.basename(url.replace("\\", "/"))
        real_root = os.path.realpath(_UPLOADS_DIR).rstrip("\\/")
        real_file = os.path.realpath(os.path.join(_UPLOADS_DIR, name))
        if (real_file == real_root or real_file.startswith(real_root + os.sep)) and os.path.isfile(real_file):
            with open(real_file, "rb") as f:
                file_bytes = f.read()
    elif not url.startswith("/uploads/"):
        # Cloud storage key (Cloudinary public_id or Firebase blob name) -
        # generate a signed URL and fetch the file.
        signed_url = get_signed_download_url(url, ext)
        try:
            import urllib.request
            with urllib.request.urlopen(signed_url) as resp:
                file_bytes = resp.read()
        except Exception:
            file_bytes = None

    pdf_bytes = None
    if soffice and file_bytes:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                src_path = os.path.join(tmpdir, f"material.{ext}")
                with open(src_path, "wb") as f:
                    f.write(file_bytes)
                subprocess.run(
                    [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmpdir, src_path],
                    check=True,
                    capture_output=True,
                    timeout=180,
                )
                pdf_path = os.path.join(tmpdir, "material.pdf")
                if os.path.isfile(pdf_path):
                    with open(pdf_path, "rb") as f:
                        pdf_bytes = f.read()
        except Exception as e:
            print(f"[Convert] soffice conversion failed: {e}")
            pdf_bytes = None

    if pdf_bytes is None:
        pdf_bytes = _render_text_fallback()

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{safe_title}.pdf",
    )


def issue_material_view_token_for_material(material_id):
    """Issue a short-lived signed URL for inline preview (Office Viewer)."""
    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    if not material_access_allowed(mat, current_user):
        return jsonify({"error": "You do not have access to this material.", "code": "FORBIDDEN"}), 403

    token = issue_material_view_token(material_id, current_user.get("id") or "")
    base_url = request.host_url.rstrip("/")
    return jsonify({
        "url": f"{base_url}/api/materials/{material_id}/view?token={token}",
        "token": token,
        "expiresInSeconds": VIEW_TOKEN_TTL_SECONDS,
    }), 200


def view_material_file(material_id):
    """Serve the material file inline for authenticated preview and Office Viewer.

    Unlike /download (as_attachment=True), this serves the file inline
    (as_attachment=False) with CORS headers so Microsoft Office Viewer can
    fetch it server-side and embed it in an <iframe>.

    Access requires either a bearer session (normal browser preview) or a
    short-lived signed view token issued by POST /api/materials/<id>/view-token.
    The token exists because Office Viewer cannot send an Authorization header.
    """
    current_user, auth_error = resolve_material_viewer(material_id)
    if auth_error:
        return auth_error

    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    if not material_access_allowed(mat, current_user):
        return jsonify({"error": "You do not have access to this material.", "code": "FORBIDDEN"}), 403

    url = (mat.file_url or "").strip()
    if not url:
        return jsonify({"error": "This material has no viewable file.", "code": "NOT_FOUND"}), 404

    ext = _normalize_ext(mat.file_type)
    title = _safe_title(mat.title)
    mimetype = mimetypes.guess_type(f"{title}.{ext}")[0] or "application/octet-stream"

    if url.startswith("/uploads/"):
        response, err = _serve_local_file(url, ext, title, False, None, cors_headers=True)
        if err:
            return err
        return response

    if not url.startswith("/uploads/"):
        # Cloud storage key - generate signed URL and stream inline
        try:
            signed_url = get_signed_download_url(url, ext)
        except ValueError:
            return jsonify({"error": "Unsupported file location.", "code": "BAD_REQUEST"}), 400
        try:
            import urllib.request
            with urllib.request.urlopen(signed_url) as resp:
                file_bytes = resp.read()
        except Exception:
            return jsonify({"error": "Could not fetch the stored file.", "code": "STORAGE_UNAVAILABLE"}), 502

        response = send_file(
            io.BytesIO(file_bytes),
            mimetype=mimetypes.guess_type(f"{title}.{ext}")[0] or "application/octet-stream",
            as_attachment=False,
        )
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response


def extract_material_text():
    """Parses an attached file and returns its extracted text WITHOUT persisting
    anything. Used by the AI Study Assistant so attachments are generation-only
    inputs and never leak into anyone's Learning Materials library."""
    file = request.files.get("file")
    text_input = (request.form.get("textInput") or "").strip()
    if not file and not text_input:
        return jsonify({"error": "No file or text provided.", "code": "EMPTY_INPUT"}), 400
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    extracted = ""
    if file:
        filename = file.filename or "note.txt"
        ext = os.path.splitext(filename)[1].replace(".", "").lower() or "txt"
        if ext == "doc":
            ext = "docx"
        try:
            extracted = _extract_text_from_file(file.read(), ext)
        except Exception:
            extracted = ""
    if not extracted and text_input:
        extracted = _clean_extracted_text(text_input)
    return jsonify({"text": extracted or "", "fileName": (file.filename if file else None)}), 200


def upload_material():
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") == "admin":
        return jsonify({"error": "Administrators have read-only access to materials and cannot upload them.", "code": "FORBIDDEN"}), 403

    # Identity is always taken from the verified session, never from client-sent
    # form fields. A caller cannot forge attributes (uploaderRole/uploaderId/
    # uploadedBy) or credit course materials to another teacher.
    uploader_id = current_user.get("id") or ""
    uploader_role = current_user.get("role") or "student"
    uploaded_by = current_user.get("name") or "User"

    file = request.files.get("file")
    filename = file.filename if file else "note.txt"
    file_bytes = file.read() if file else None

    title = request.form.get("title") or os.path.splitext(filename)[0]
    description = request.form.get("description", "Uploaded lecture notes")
    subject_id = request.form.get("subjectId", "") or None
    material_type = request.form.get("materialType", "course")
    text_input = request.form.get("textInput", "").strip()

    if file_bytes is None and not text_input:
        return jsonify({"error": "No file or text content provided"}), 400

    sub = db.session.get(SubjectModel, subject_id) if subject_id else None

    # Ownership rule: a teacher may only upload course material to a subject they
    # are assigned to manage. Admins may upload anywhere. Personal notes bypass subjects.
    # A blank subject_id means a subjectless draft awaiting assignment (AI saves).
    if uploader_role == "teacher" and subject_id is not None:
        if not sub:
            return jsonify({"error": "Selected subject was not found.", "code": "NOT_FOUND"}), 404
        if sub.teacher_id != uploader_id:
            return jsonify({"error": "You can only upload materials to a subject assigned to you.", "code": "FORBIDDEN"}), 403

    if subject_id in ("", "personal"):
        subject_id = None

    cloud_url = None
    file_html_ext = os.path.splitext(filename)[1].replace(".", "").lower() or "txt"

    file_ext = file_html_ext
    if file_ext == "doc":
        file_ext = "docx"

    # Extension allowlist: html/htm/svg/js and friends are rejected outright so
    # active content can never be stored into (and later served from) uploads.
    # The stored name is still randomized server-side in cloud_storage.
    if file_bytes and file_ext not in ALLOWED_MATERIAL_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_MATERIAL_EXTENSIONS))
        return jsonify({
            "error": f"Unsupported file type. Allowed types: {allowed}.",
            "code": "BAD_REQUEST",
        }), 400

    if file_bytes:
        cloud_url = upload_file_to_cloud(file_bytes, filename)

    file_size = f"{len(file_bytes)//1024} KB" if file_bytes else "—"

    extracted_text = _extract_text_from_file(file_bytes, file_ext) if file_bytes else ""
    if not extracted_text:
        extracted_text = _clean_extracted_text(text_input)
    if not extracted_text:
        extracted_text = _clean_extracted_text(f"{title}. {description}")

    new_mat = MaterialModel(
        material_id=generate_id("mat"),
        subject_id=subject_id,
        teacher_id=uploader_id,
        title=title,
        description=description,
        file_url=cloud_url,
        file_type=file_ext,
        file_size=file_size,
        extracted_text=extracted_text,
        uploaded_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        material_type=material_type,
        uploaded_by=uploaded_by,
        uploader_role=uploader_role
    )

    db.session.add(new_mat)
    if sub: sub.material_count += 1
    _commit_or_warn("material upload")

    log_action(uploader_id, uploaded_by, uploader_role, "MATERIAL_UPLOAD", f"Uploaded '{title}' ({file_ext}) to Cloud Storage")
    return jsonify(new_mat.to_dict()), 201


def save_ai_resource_as_material():
    """Saves an AI-generated study resource (summary/reviewer/flashcards) into the
    learning materials library without a file upload. Quizzes are intentionally
    excluded — generated quizzes live in Assessment Management, never as materials.

    Teachers save without a subject (assigned later from the materials page, which keeps
    the subject list under their control); students always save as a personal study
    resource; admins may save to any subject.
    """
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to materials and cannot save new resources.", "code": "FORBIDDEN"}), 403
    user_id = current_user.get("id", "") or "usr-teacher-1"

    data = request.json or {}
    title = (data.get("title") or "").strip()
    resource_type = data.get("resourceType") or data.get("mode") or ""
    payload = data.get("data") or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Resource data must be an object.", "code": "BAD_REQUEST"}), 400
    if not title:
        return jsonify({"error": "A title is required.", "code": "BAD_REQUEST"}), 400
    if resource_type not in ("summary", "reviewer", "flashcards"):
        return jsonify({"error": "Unsupported resource type. Quizzes are managed in Assessment Management, not as learning materials.", "code": "BAD_REQUEST"}), 400

    subject_id = data.get("subjectId") or ""
    material_type = "course"
    if role == "student":
        subject_id = None
        material_type = "personal"
    elif subject_id:
        sub = db.session.get(SubjectModel, subject_id)
        if not sub or (role == "teacher" and sub.teacher_id != user_id):
            return jsonify({"error": "You can only save materials to a subject assigned to you.", "code": "FORBIDDEN"}), 403
    else:
        subject_id = None

    extracted_text = _render_ai_resource_text(resource_type, payload) or title
    new_mat = MaterialModel(
        material_id=generate_id("mat"),
        subject_id=subject_id,
        teacher_id=user_id,
        title=title,
        description=data.get("description") or f"AI-generated {resource_type} saved from the AI Study Assistant.",
        file_url=None,
        file_type=f"ai-{resource_type}",
        file_size="—",
        extracted_text=extracted_text,
        uploaded_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        material_type=material_type,
        uploaded_by=current_user.get("name") or data.get("uploadedBy") or "User",
        uploader_role=role or "teacher",
    )
    db.session.add(new_mat)
    if subject_id:
        sub = db.session.get(SubjectModel, subject_id)
        if sub:
            sub.material_count += 1
    if not _commit_or_warn("AI resource material save"):
        return jsonify({"error": "Could not save the material. The database write failed. Please try again.", "code": "SAVE_FAILED", "reason": db_session._LAST_COMMIT_ERROR}), 500

    log_action(user_id, new_mat.uploaded_by, new_mat.uploader_role, "MATERIAL_AI_SAVE", f"Saved AI {resource_type} '{title}' as a learning material")
    return jsonify(new_mat.to_dict()), 201


def update_material(material_id):
    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to materials and cannot edit them.", "code": "FORBIDDEN"}), 403

    # Ownership rule: teachers may only edit materials in subjects they manage
    # (or their own uploads, e.g. an unassigned AI-saved material awaiting a subject).
    if role == "teacher" and mat.teacher_id != user_id:
        if mat.subject_id:
            subject = db.session.get(SubjectModel, mat.subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only edit materials from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    # Students may only edit materials they uploaded themselves. The rule keys
    # off the uploader's own id (usable even for legacy rows with a NULL
    # uploader_role), so a student can never edit another student's or a
    # teacher's material.
    if role == "student" and mat.teacher_id != user_id:
        return jsonify({"error": "You can only edit materials you uploaded.", "code": "FORBIDDEN"}), 403

    data = request.json or {}

    new_title = (data.get("title") or "").strip()
    if new_title:
        mat.title = new_title
    if data.get("description") is not None:
        mat.description = data.get("description")

    text_input = (data.get("textInput") or "").strip()
    if text_input:
        mat.extracted_text = _clean_extracted_text(text_input)

    # Subject assignment: teachers may set/reassign the subject of materials they own
    # to any of their assigned subjects (e.g. after an unassigned AI save).
    if data.get("subjectId") is not None:
        if role == "teacher":
            if mat.teacher_id != user_id:
                return jsonify({"error": "You can only assign a subject to materials you uploaded.", "code": "FORBIDDEN"}), 403
            new_sub = db.session.get(SubjectModel, data["subjectId"])
            if not new_sub or new_sub.teacher_id != user_id:
                return jsonify({"error": "You can only assign materials to a subject assigned to you.", "code": "FORBIDDEN"}), 403
            if mat.subject_id:
                old_sub = db.session.get(SubjectModel, mat.subject_id)
                if old_sub and old_sub.material_count and old_sub.material_count > 0:
                    old_sub.material_count -= 1
            new_sub.material_count = (new_sub.material_count or 0) + 1
            mat.subject_id = data["subjectId"]
        elif role == "admin":
            new_sub = db.session.get(SubjectModel, data["subjectId"])
            if not new_sub:
                return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404
            mat.subject_id = data["subjectId"]
        else:
            return jsonify({"error": "Only teachers can assign a subject to a material.", "code": "FORBIDDEN"}), 403

    _commit_or_warn("material update")
    # A material edit (replacing the file, fixing the content, or reassigning the
    # subject) counts as addressing any pending content-review flag on it.
    if role in ("teacher", "admin"):
        pending = MaterialFlagModel.query.filter_by(material_id=mat.material_id, status="pending").count()
        if pending:
            _resolve_material_flags(mat.material_id, user_id, None, actor_role=role)
    log_action(user_id or mat.teacher_id, mat.uploaded_by, mat.uploader_role, "MATERIAL_UPDATE", f"Updated '{mat.title}'")
    return jsonify(mat.to_dict()), 200


def delete_material(material_id):
    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to materials and cannot delete them.", "code": "FORBIDDEN"}), 403

    # Ownership rule: teachers may delete their own uploads (including unassigned
    # materials awaiting a subject), or materials in subjects they are assigned
    # to manage.
    #
    # The subject check must NOT be conditional on mat.subject_id: a subjectless
    # row (an AI-generated mirror, or an unassigned upload) has no subject to
    # validate, so a teacher who is not the uploader used to fall through the
    # `if mat.subject_id:` body with no denial and delete someone else's
    # resource. Only a row the teacher actually owns may be subjectless.
    if role == "teacher" and mat.teacher_id != user_id:
        subject = db.session.get(SubjectModel, mat.subject_id) if mat.subject_id else None
        if not subject or subject.teacher_id != user_id:
            return jsonify({"error": "You can only delete materials from a subject assigned to you.", "code": "FORBIDDEN"}), 403

    # Students may only delete materials they uploaded themselves. The rule keys
    # off the uploader's own id (usable even for legacy rows with a NULL
    # uploader_role), so a student can never touch another student's or a
    # teacher's material.
    if role == "student" and mat.teacher_id != user_id:
        return jsonify({"error": "You can only delete materials you uploaded.", "code": "FORBIDDEN"}), 403

    subject = db.session.get(SubjectModel, mat.subject_id) if mat.subject_id else None
    if subject and subject.material_count and subject.material_count > 0:
        subject.material_count -= 1
    _delete_local_upload(mat.file_url)
    # Resolve pending content-review flags BEFORE deleting so the flag history is
    # preserved (the FK is ON DELETE SET NULL and records survive as an audit trail).
    _resolve_material_flags(mat.material_id, user_id, None, actor_role=role)
    db.session.delete(mat)
    _commit_or_warn("material deletion")
    log_action(mat.teacher_id, mat.uploaded_by, mat.uploader_role, "MATERIAL_DELETE", f"Deleted '{mat.title}'")
    return jsonify({"success": True}), 200


def flag_material(material_id):
    """Admin raises a content-review flag on a material; the owning teacher is
    notified via the notification bell with a deep-link to the material."""
    mat = db.session.get(MaterialModel, material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    category = data.get("category") or "Other"
    if category not in MATERIAL_FLAG_CATEGORIES:
        category = "Other"
    note = (data.get("note") or "").strip()

    current_user = getattr(request, "current_user", None) or {}
    admin_id = current_user.get("id") or ""
    admin_name = current_user.get("name") or "An administrator"

    flag = MaterialFlagModel(
        flag_id=generate_id("flag"),
        material_id=material_id,
        flagged_by=admin_id or "usr-admin-1",
        category=category,
        note=note or None,
        status="pending",
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    )
    db.session.add(flag)
    _commit_or_warn("material flag")

    sub = db.session.get(SubjectModel, mat.subject_id) if mat.subject_id else None
    subject_label = f"{sub.subject_code} - {sub.subject_name}" if sub else "your subject"
    _create_notification(
        mat.teacher_id,
        f"{admin_name} flagged your material '{mat.title}'",
        f"Reason: {category}." + (f" {note}" if note else "") + f" Please review it in {subject_label}.",
        target=f"material:{material_id}",
    )
    log_action(admin_id, admin_name, "admin", "MATERIAL_FLAG",
               f"Flagged '{mat.title}' in {subject_label} ({category})"
               + (f": {note}" if note else ""))
    return jsonify(flag.to_dict()), 201


def get_material_flags():
    """Admins see every flag in the system; teachers see only flags raised on
    their own uploads (flag visibility is never granted to students)."""
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""

    flags = MaterialFlagModel.query.order_by(MaterialFlagModel.created_at.desc()).all()
    if role == "teacher":
        own_material_ids = {
            m.material_id for m in MaterialModel.query.filter_by(teacher_id=user_id).all()
        }
        flags = [f for f in flags if f.material_id in own_material_ids]
    elif role != "admin":
        flags = []

    return jsonify([f.to_dict() for f in flags])


def resolve_material_flag(flag_id):
    """Teacher (or admin) marks a flag resolved, optionally with a short note.
    The admin who raised the flag is notified of the resolution."""
    flag = db.session.get(MaterialFlagModel, flag_id)
    if not flag:
        return jsonify({"error": "Flag not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""

    mat = db.session.get(MaterialModel, flag.material_id) if flag.material_id else None
    if role == "teacher":
        if not mat:
            return jsonify({"error": "The material for this flag no longer exists. Please contact the administrator.", "code": "FORBIDDEN"}), 403
        if mat.teacher_id != user_id:
            if not mat.subject_id:
                return jsonify({"error": "You can only resolve flags on materials you manage.", "code": "FORBIDDEN"}), 403
            sub = db.session.get(SubjectModel, mat.subject_id)
            if not sub or sub.teacher_id != user_id:
                return jsonify({"error": "You can only resolve flags on materials you manage.", "code": "FORBIDDEN"}), 403

    if flag.status == "resolved":
        return jsonify(flag.to_dict()), 200

    data = request.json or {}
    resolution_note = (data.get("resolutionNote") or "").strip()

    if not resolution_note and flag.status != "resolved":
        resolution_note = None

    _resolve_material_flags(flag.material_id, user_id, resolution_note or None, actor_role=role)
    return jsonify(flag.to_dict()), 200
