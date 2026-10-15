import os
import io
import json
import jwt
import secrets
import datetime
import mimetypes
import threading
import time
from functools import wraps
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Import Groq AI (GPT-OSS-120B) & Cloud Storage Services
from groq_service import (
    call_groq_ai,
    generate_quiz_with_groq,
    generate_flashcards_with_groq,
    generate_summary_with_groq,
    generate_reviewer_with_groq,
    explain_answer_with_groq,
    generate_hint_with_groq,
    generate_recommendations_with_groq,
    generate_title_with_groq,
    describe_image_with_groq,
    IMAGE_EXTENSIONS,
    reset_generation_source,
    generation_used_fallback,
    GroqAPIError
)
from cloud_storage import upload_file_to_cloud
from email_service import is_email_enabled, send_otp_email

# Load environment variables (path-independent: resolves .env from this file's folder
# regardless of which directory the Flask process is launched from).
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_UPLOADS_DIR = os.path.join(_BACKEND_DIR, "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)

app = Flask(__name__)

# Uploaded files are served through a hardened application route (serve_uploaded_file)
# instead of a public static mount: paths are resolved strictly inside the uploads
# root, and responses carry explicit Content-Type / nosniff / CSP-sandbox headers.
# The /uploads/<file> URL scheme is unchanged so existing frontend and mobile
# consumers keep working, but raw static directory serving is gone.

# Hardened CORS: only known frontend origins may call the API. The Vite dev server
# runs on localhost:3000 by default; add LAN/host origin(s) via ALLOWED_ORIGINS.
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8081,http://127.0.0.1:8081",
    ).split(",")
    if o.strip()
]
CORS(app, origins=_ALLOWED_ORIGINS)


@app.route("/uploads/<path:req_filename>")
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

# Configuration & Secrets
# The JWT secret MUST come from the environment. There is deliberately no
# hardcoded fallback: a known default lets anyone forge admin tokens. If it is
# missing we refuse to boot so a misconfiguration is loud, not exploitable.
SECRET_KEY = os.getenv("JWT_SECRET", "").strip()
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET is not set. Generate one with `python -c \"import secrets; print(secrets.token_hex(32))\"` and add it to backend/.env.")
_PLACEHOLDER_SECRETS = {
    "changeme", "change-me", "your-secret-key", "secret", "default",
    "generate_a_unique_random_secret_here", "replace-me", "example",
}
if (
    SECRET_KEY.lower() in _PLACEHOLDER_SECRETS
    or SECRET_KEY.lower().startswith(("generate_", "your_", "replace", "xxx", "example"))
    or SECRET_KEY.startswith("<")
):
    raise RuntimeError("JWT_SECRET is set to a known placeholder value. Generate a real one with `python -c \"import secrets; print(secrets.token_hex(32))\"`.")
PORT = int(os.getenv("FLASK_PORT", 5000))

# Global upload size cap. Materials and AI attachments are rejected above the cap
# with a clean JSON error instead of a bare 413 page (avatar uploads enforce their
# own tighter 5 MB ceiling in-route). Overridable via MAX_UPLOAD_MB.
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# File types accepted for course-material uploads. html/htm/svg/js are excluded so
# active content can never be stored in the uploads area (stored-XSS / file-write
# hardening). Mirrors cloud_storage.SAFE_LOCAL_EXTENSIONS as the pre-storage gate.
ALLOWED_MATERIAL_EXTENSIONS = {
    "pdf", "doc", "docx", "pptx", "txt", "md", "csv", "json", "rtf", "log",
    "jpg", "jpeg", "png", "gif", "webp", "bmp",
}

# Hard cap on the pages/memory parsed from any single uploaded PDF, so a giant
# "zip-bomb style" document can't exhaust memory during text extraction.
MAX_EXTRACT_PAGES = 300


@app.errorhandler(413)
def _handle_413(_err):
    return jsonify({
        "error": f"Upload is too large. The maximum allowed size is {MAX_UPLOAD_MB} MB.",
        "code": "FILE_TOO_LARGE",
    }), 413

# Database configuration: MySQL 8+ with automatic SQLite fallback
mysql_url = os.getenv("MYSQL_DATABASE_URL")
if not mysql_url and os.getenv("MYSQL_HOST"):
    db_user = os.getenv("MYSQL_USER", "root")
    db_pass = os.getenv("MYSQL_PASSWORD", "")
    db_host = os.getenv("MYSQL_HOST", "localhost")
    db_name = os.getenv("MYSQL_DB", "studylens_db")
    mysql_url = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}/{db_name}"

db_target = "sqlite:///studylens.db"
if mysql_url:
    try:
        from sqlalchemy import create_engine
        probe_url = mysql_url if "?" in mysql_url else mysql_url + "?connect_timeout=5"
        probe = create_engine(probe_url)
        with probe.connect():
            pass
        probe.dispose()
        db_target = mysql_url
        safe_label = (mysql_url.split("//")[1].split("@")[-1]).split("?")[0]
        print(f"[Database] Connected to MySQL ({safe_label})")
    except Exception as db_err:
        short_err = str(db_err).splitlines()[0][:160] if str(db_err) else "unknown error"
        print(f"[Database] MySQL not connected ({short_err}).")
        print("[Database] Continuing with SQLite — StudyLens runs fully on SQLite.")
        print("[Database] To enable MySQL, check MYSQL_DATABASE_URL / MYSQL_PASSWORD in .env and restart.")
        db_target = "sqlite:///studylens.db"

app.config["SQLALCHEMY_DATABASE_URI"] = db_target

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

if db_target.startswith("mysql"):
    # MySQL drops idle pooled connections (default wait_timeout). pool_pre_ping
    # validates the connection before use, and pool_recycle replaces stale ones,
    # so transient "MySQL server has gone away" errors self-heal on the next call.
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 1500,
    }

db = SQLAlchemy(app)

# ----------------------------------------------------
# DATABASE ORM MODELS (14 Tables mapped to Manuscript ERD)
# ----------------------------------------------------

class RoleModel(db.Model):
    __tablename__ = "roles"
    role_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_name = db.Column(db.String(30), nullable=False, unique=True)

class UserModel(db.Model):
    __tablename__ = "users"
    user_id = db.Column(db.String(64), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.role_id"), nullable=False, default=1)
    first_name = db.Column(db.String(100), nullable=False)
    middle_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    profile_picture = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(32), nullable=False)
    department = db.Column(db.String(128), nullable=True)
    student_id = db.Column(db.String(64), nullable=True)
    status = db.Column(db.String(30), default="active")
    created_at = db.Column(db.String(64), nullable=False)
    last_login = db.Column(db.String(64), nullable=True)
    updated_at = db.Column(db.String(64), nullable=True)
    two_factor_code = db.Column(db.String(16), nullable=True)
    two_factor_expires_at = db.Column(db.String(64), nullable=True)
    failed_login_attempts = db.Column(db.Integer, nullable=True)
    two_factor_attempts = db.Column(db.Integer, nullable=True)
    locked_until = db.Column(db.String(64), nullable=True)
    lockout_count = db.Column(db.Integer, nullable=True)
    reset_otp = db.Column(db.String(16), nullable=True)
    reset_otp_expires_at = db.Column(db.String(64), nullable=True)
    reset_otp_attempts = db.Column(db.Integer, nullable=True)
    email_verified = db.Column(db.Integer, nullable=True)
    email_verify_code = db.Column(db.String(16), nullable=True)
    email_verify_expires_at = db.Column(db.String(64), nullable=True)
    email_verify_attempts = db.Column(db.Integer, nullable=True)
    token_version = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return {
            "id": self.user_id,
            "name": full_name,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "email": self.email,
            "role": self.role,
            "roleId": self.role_id,
            "avatar": self.profile_picture,
            "department": self.department,
            "studentId": self.student_id,
            "status": self.status,
            "createdAt": self.created_at,
            "lastLogin": self.last_login,
            "tokenVersion": self.token_version or 0,
        }

class SubjectModel(db.Model):
    __tablename__ = "subjects"
    subject_id = db.Column(db.String(64), primary_key=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    subject_code = db.Column(db.String(20), nullable=False)
    subject_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    semester = db.Column(db.String(20), default="1st Semester")
    course = db.Column(db.String(100), default="BSIT")
    school_year = db.Column(db.String(20), default="2026-2027")
    teacher_name = db.Column(db.String(128), nullable=False, default="Christian C. Barral, MIT")
    student_count = db.Column(db.Integer, default=51)
    material_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        roster_count = None
        try:
            roster_count = StudentSubjectModel.query.filter_by(subject_id=self.subject_id).count()
        except Exception:
            roster_count = None
        return {
            "id": self.subject_id,
            "code": self.subject_code,
            "name": self.subject_name,
            "description": self.description,
            "teacherId": self.teacher_id,
            "teacherName": self.teacher_name,
            "semester": self.semester,
            "course": self.course,
            "schoolYear": self.school_year,
            "studentCount": roster_count if roster_count is not None else self.student_count,
            "materialCount": self.material_count,
            "createdAt": self.created_at
        }

class StudentSubjectModel(db.Model):
    __tablename__ = "student_subjects"
    student_subject_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="CASCADE"), nullable=False)
    date_enrolled = db.Column(db.String(64), nullable=False)

class MaterialModel(db.Model):
    __tablename__ = "learning_materials"
    material_id = db.Column(db.String(64), primary_key=True)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="SET NULL"), nullable=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_url = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(30), nullable=False)
    file_size = db.Column(db.String(32), nullable=True)
    extracted_text = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.String(64), nullable=False)
    material_type = db.Column(db.String(50), default="course")
    uploaded_by = db.Column(db.String(128), nullable=False, default="Faculty")
    uploader_role = db.Column(db.String(32), nullable=False, default="teacher")

    def to_dict(self):
        sub = db.session.get(SubjectModel, self.subject_id) if self.subject_id else None
        if sub:
            subject_name = f"{sub.subject_code} - {sub.subject_name}"
        elif self.subject_id in ("", None):
            subject_name = ""
        else:
            subject_name = self.title
        return {
            "id": self.material_id,
            "title": self.title,
            "description": self.description,
            "subjectId": self.subject_id,
            "subjectName": subject_name,
            "fileType": self.file_type,
            "fileUrl": self.file_url,
            "fileSize": self.file_size,
            "extractedText": self.extracted_text,
            "uploadedBy": self.uploaded_by,
            "uploaderRole": self.uploader_role,
            "uploaderId": self.teacher_id,
            "materialType": self.material_type,
            "createdAt": self.uploaded_at
        }

class MaterialFlagModel(db.Model):
    """A content-review flag an administrator raises on a teacher's uploaded
    material (e.g. wrong file, wrong subject). Resolved flags are kept as an
    audit trail; resolution notes are teacher-provided."""

    __tablename__ = "material_flags"
    flag_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), db.ForeignKey("learning_materials.material_id", ondelete="SET NULL"), nullable=True)
    flagged_by = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    category = db.Column(db.String(50), nullable=False, default="Other")
    note = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.String(64), nullable=False)
    resolved_at = db.Column(db.String(64), nullable=True)
    resolved_by = db.Column(db.String(64), nullable=True)
    resolution_note = db.Column(db.Text, nullable=True)

    def to_dict(self):
        def name_for(user_id):
            if not user_id:
                return None
            try:
                u = db.session.get(UserModel, user_id)
                if not u:
                    return None
                return f"{u.first_name} {u.last_name}".strip() or u.email
            except Exception:
                return None
        mat = None
        sub = None
        try:
            mat = db.session.get(MaterialModel, self.material_id)
            sub = db.session.get(SubjectModel, mat.subject_id) if mat and mat.subject_id else None
        except Exception:
            pass
        return {
            "id": self.flag_id,
            "materialId": self.material_id,
            "materialTitle": mat.title if mat else "(deleted material)",
            "subjectId": sub.subject_id if sub else (mat.subject_id if mat else None),
            "subjectName": f"{sub.subject_code} - {sub.subject_name}" if sub else None,
            "flaggedById": self.flagged_by,
            "flaggedByName": name_for(self.flagged_by),
            "category": self.category,
            "note": self.note,
            "status": self.status,
            "createdAt": self.created_at,
            "resolvedAt": self.resolved_at,
            "resolvedById": self.resolved_by,
            "resolvedByName": name_for(self.resolved_by),
            "resolutionNote": self.resolution_note,
        }

class AIGeneratedContentModel(db.Model):
    __tablename__ = "ai_generated_content"
    content_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), db.ForeignKey("learning_materials.material_id", ondelete="SET NULL"), nullable=True)
    generated_by = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(32), nullable=False)
    generated_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)

def _canonical_question_type(q):
    """Returns a canonical question type ("multiple_choice" | "true_false" | "identification")
    for a question dict, honoring type aliases from any producer and falling back to shape
    inference (True/False option pair, then option count)."""
    t = str(q.get("type") or "").strip().lower().replace("-", "_").replace(" ", "_")
    if t in ("mc", "multiplechoice", "multiple_choice"):
        return "multiple_choice"
    if t in ("tf", "truefalse", "true_false"):
        return "true_false"
    if t in ("identify", "identifications", "shortanswer", "short_answer", "identification"):
        return "identification"
    options = q.get("options")
    if isinstance(options, list):
        normalized = {str(o).strip().lower() for o in options}
        if len(options) == 2 and normalized == {"true", "false"}:
            return "true_false"
        if len(options) >= 2:
            return "multiple_choice"
    return "identification"

class QuizModel(db.Model):
    __tablename__ = "quizzes"
    quiz_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), db.ForeignKey("learning_materials.material_id", ondelete="SET NULL"), nullable=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default="active")
    instructions = db.Column(db.Text, nullable=True)
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    created_by_name = db.Column(db.String(128), nullable=False, default="Christian C. Barral, MIT")
    quiz_type = db.Column(db.String(32), default="teacher")
    questions_json = db.Column(db.Text, nullable=False)
    is_published = db.Column(db.Boolean, default=True)
    time_limit_minutes = db.Column(db.Integer, default=15)
    pass_percentage = db.Column(db.Integer, default=70)
    difficulty = db.Column(db.String(32), default="medium")
    attempts_allowed = db.Column(db.Integer, default=0)
    reveal_answers = db.Column(db.Boolean, default=True)
    deadline = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        qs = _quiz_questions_for(self.quiz_id)
        if qs is None:
            try: qs = json.loads(self.questions_json)
            except Exception: qs = []
        else:
            qs = _merge_questions_json(qs, self.questions_json)
        for q in qs:
            if isinstance(q, dict):
                q["type"] = _canonical_question_type(q)
        return {
            "id": self.quiz_id,
            "title": self.title,
            "description": self.description,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "materialId": self.material_id,
            "createdById": self.teacher_id,
            "createdByName": self.created_by_name,
            "quizType": self.quiz_type,
            "questions": qs,
            "isPublished": self.is_published,
            "timeLimitMinutes": self.time_limit_minutes,
            "passPercentage": self.pass_percentage,
            "difficulty": self.difficulty,
            "attemptsAllowed": self.attempts_allowed or 0,
            "revealAnswers": True if self.reveal_answers is None else bool(self.reveal_answers),
            "deadline": self.deadline,
            "createdAt": self.created_at
        }

class QuizQuestionModel(db.Model):
    __tablename__ = "quiz_questions"
    question_id = db.Column(db.String(64), primary_key=True)
    quiz_id = db.Column(db.String(64), db.ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), nullable=False)
    question = db.Column(db.Text, nullable=False)
    choice_a = db.Column(db.String(255), nullable=True)
    choice_b = db.Column(db.String(255), nullable=True)
    choice_c = db.Column(db.String(255), nullable=True)
    choice_d = db.Column(db.String(255), nullable=True)
    correct_answer = db.Column(db.String(1), nullable=True)
    points = db.Column(db.Integer, default=1)
    options_json = db.Column(db.Text, nullable=True)
    topic_tag = db.Column(db.String(128), nullable=True)
    blooms_level = db.Column(db.String(32), nullable=True)
    difficulty = db.Column(db.String(32), nullable=True)
    explanation = db.Column(db.Text, nullable=True)
    question_order = db.Column(db.Integer, default=0)

    def to_dict(self):
        try: options = json.loads(self.options_json) if self.options_json else []
        except Exception: options = []
        return {
            "id": self.question_id,
            "question": self.question,
            "options": options,
            "correctAnswer": self.correct_answer or (0 if options else ""),
            "topicTag": self.topic_tag or "General Concepts",
            "bloomsLevel": self.blooms_level or "Understanding",
            "difficulty": self.difficulty or "medium",
            "explanation": self.explanation or "",
        }

class QuizAttemptModel(db.Model):
    __tablename__ = "quiz_attempts"
    attempt_id = db.Column(db.String(64), primary_key=True)
    quiz_id = db.Column(db.String(64), db.ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    attempt_status = db.Column(db.String(30), default="Completed")
    score = db.Column(db.Float, nullable=False)
    time_taken = db.Column(db.Integer, default=300)
    submitted_at = db.Column(db.String(64), nullable=False)
    quiz_title = db.Column(db.String(256), nullable=False)
    student_name = db.Column(db.String(128), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    max_score = db.Column(db.Integer, nullable=False)
    percentage = db.Column(db.Float, nullable=False)
    passed = db.Column(db.Boolean, nullable=False)
    answers_json = db.Column(db.Text, nullable=False)
    weak_topics_json = db.Column(db.Text, nullable=True)
    strong_topics_json = db.Column(db.Text, nullable=True)

    def to_dict(self):
        try: ans = json.loads(self.answers_json)
        except Exception: ans = []
        try: wt = json.loads(self.weak_topics_json) if self.weak_topics_json else []
        except Exception: wt = []
        try: st = json.loads(self.strong_topics_json) if self.strong_topics_json else []
        except Exception: st = []
        return {
            "id": self.attempt_id,
            "quizId": self.quiz_id,
            "quizTitle": self.quiz_title,
            "studentId": self.student_id,
            "studentName": self.student_name,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "score": self.score,
            "maxScore": self.max_score,
            "totalPoints": self.max_score,
            "percentage": self.percentage,
            "passed": self.passed,
            "timeTaken": self.time_taken,
            "answers": ans,
            "submittedAt": self.submitted_at,
            "feedback": ans,
            "weakTopics": wt,
            "strongTopics": st,
            "completedAt": self.submitted_at
        }

class StudentProgressModel(db.Model):
    __tablename__ = "student_progress"
    progress_id = db.Column(db.String(64), primary_key=True)
    student_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="CASCADE"), nullable=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    average_score = db.Column(db.Float, default=0.0)
    learning_level = db.Column(db.String(32), default="Intermediate")
    updated_at = db.Column(db.String(64), nullable=False)
    last_activity = db.Column(db.String(64), nullable=False)

class NotificationModel(db.Model):
    __tablename__ = "notifications"
    notification_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    read_at = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)
    target = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            "id": self.notification_id,
            "userId": self.user_id,
            "title": self.title,
            "message": self.message,
            "isRead": bool(self.read_at),
            "createdAt": self.created_at,
            "target": self.target or None
        }

class AnnouncementModel(db.Model):
    __tablename__ = "announcements"
    announcement_id = db.Column(db.String(64), primary_key=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="CASCADE"), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)
    updated_at = db.Column(db.String(64), nullable=True)
    posted_at = db.Column(db.String(64), nullable=True)
    author_name = db.Column(db.String(128), nullable=False, default="Faculty")
    target_audience = db.Column(db.String(32), default="all")
    priority = db.Column(db.String(32), default="medium")

    def to_dict(self):
        subject_name = ""
        if self.subject_id:
            sub = db.session.get(SubjectModel, self.subject_id)
            if sub:
                subject_name = f"{sub.subject_code} - {sub.subject_name}"
        return {
            "id": self.announcement_id,
            "teacherId": self.teacher_id,
            "title": self.title,
            "content": self.message,
            "authorName": self.author_name,
            "targetAudience": self.target_audience,
            "priority": self.priority,
            "subjectId": self.subject_id,
            "subjectName": subject_name,
            "createdAt": self.created_at
        }

class ReportModel(db.Model):
    __tablename__ = "reports"
    report_id = db.Column(db.String(64), primary_key=True)
    generated_by = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    report_type = db.Column(db.String(100), nullable=False)
    generated_at = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    summary_json = db.Column(db.Text, nullable=True)
    target_id = db.Column(db.String(64), nullable=True)

    def to_dict(self):
        try: summary = json.loads(self.summary_json) if self.summary_json else None
        except Exception: summary = None
        return {
            "id": self.report_id,
            "generatedBy": self.generated_by,
            "reportType": self.report_type,
            "generatedAt": self.generated_at,
            "title": self.title,
            "summary": summary,
            "targetId": self.target_id
        }

class ActivityLogModel(db.Model):
    __tablename__ = "activity_logs"
    log_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    activity = db.Column(db.String(255), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)
    device = db.Column(db.String(100), nullable=True)
    browser = db.Column(db.String(100), nullable=True)
    user_name = db.Column(db.String(128), nullable=False, default="User")
    user_role = db.Column(db.String(32), nullable=False, default="student")
    details = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.log_id,
            "userId": self.user_id,
            "userName": self.user_name,
            "userRole": self.user_role,
            "action": self.activity,
            "details": self.details or self.activity,
            "ipAddress": self.ip_address,
            "device": self.device,
            "browser": self.browser,
            "timestamp": self.created_at
        }

# System settings (persisted in the system_settings table)
DEFAULT_SYSTEM_SETTINGS = {
    "require2FA": "false",
    "maintenanceMode": "false",
    "sessionTimeoutMins": "60",
    "autoAuditArchiving": "true",
}

class SystemSettingModel(db.Model):
    __tablename__ = "system_settings"
    setting_key = db.Column(db.String(64), primary_key=True)
    setting_value = db.Column(db.Text, nullable=False)

class ActivityLogArchiveModel(db.Model):
    __tablename__ = "audit_archive"
    archive_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    log_id = db.Column(db.String(64))
    user_id = db.Column(db.String(64))
    user_name = db.Column(db.String(128))
    user_role = db.Column(db.String(32))
    activity = db.Column(db.String(255))
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.String(64))

def _load_system_settings():
    settings = dict(DEFAULT_SYSTEM_SETTINGS)
    try:
        for row in SystemSettingModel.query.all():
            settings[row.setting_key] = row.setting_value
    except Exception:
        pass
    return settings

def _save_system_settings(settings):
    for key, value in settings.items():
        if key not in DEFAULT_SYSTEM_SETTINGS:
            continue
        row = db.session.get(SystemSettingModel, key)
        if row:
            row.setting_value = str(value)
        else:
            db.session.add(SystemSettingModel(setting_key=key, setting_value=str(value)))
    _commit_or_warn("system settings")

def _boolify_settings(settings):
    try:
        timeout = int(settings.get("sessionTimeoutMins") or 60)
    except (TypeError, ValueError):
        timeout = 60
    return {
        "require2FA": settings.get("require2FA") == "true",
        "maintenanceMode": settings.get("maintenanceMode") == "true",
        "sessionTimeoutMins": max(5, min(1440, timeout)),
        "autoAuditArchiving": settings.get("autoAuditArchiving") == "true",
    }

def _ensure_users_2fa_columns():
    """Adds the two-factor columns to the users table when missing (SQLite/MySQL)."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("users")]
        if "two_factor_code" not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN two_factor_code VARCHAR(16) NULL"))
        if "two_factor_expires_at" not in cols:
            db.session.execute(text("ALTER TABLE users ADD COLUMN two_factor_expires_at VARCHAR(64) NULL"))
        db.session.commit()
    except Exception as e:
        print("[Database] 2FA column migration skipped:", e)


# --- AUTH SECURITY HELPERS ---
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_BASE_MINUTES = 1
LOCKOUT_MAX_MINUTES = 60
TWO_FACTOR_MAX_ATTEMPTS = 5
RESET_OTP_MAX_ATTEMPTS = 5
RESET_OTP_EXPIRY_MINUTES = 10
EMAIL_VERIFY_EXPIRY_MINUTES = 10
EMAIL_VERIFY_MAX_ATTEMPTS = 5
OTP_DEV_REVEAL = os.getenv("OTP_DEV_REVEAL", "").strip().lower() in ("1", "true", "yes", "on")

# Rate limiting (in-memory sliding window). Tuned so legitimate demo flows never
# trip it while capping abuse of auth endpoints and Groq AI generation costs.
MAX_AI_CALLS_PER_MINUTE = 15
_RATE_WINDOW_SECONDS = 60.0
_RATE_HITS = {}
_RATE_LOCK = threading.Lock()


def _utcnow_naive():
    """Naive UTC timestamp so string round-trips stay timezone-consistent."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _utcnow_iso_z():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso(value):
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _generate_otp():
    return f"{secrets.randbelow(1000000):06d}"


def _lock_minutes_remaining(user):
    """Remaining lockout minutes for a locked account, or 0 when not locked.

    Returns a float so the account unlocks the instant locked_until passes;
    callers round up only for a user-facing message.
    """
    locked = _parse_iso(user.locked_until)
    if not locked:
        return 0
    return max(0.0, (locked - _utcnow_naive()).total_seconds() / 60)


def _is_account_locked(user):
    return _lock_minutes_remaining(user) > 0


def _escalated_lockout_minutes(lock_count):
    """Escalating lockout: 1, 2, 4, 8, ... minutes, capped at LOCKOUT_MAX_MINUTES."""
    minutes = LOCKOUT_BASE_MINUTES * (2 ** max(0, (lock_count or 0) - 1))
    return min(minutes, LOCKOUT_MAX_MINUTES)


def _clear_login_failures(user):
    user.failed_login_attempts = None
    user.two_factor_attempts = None
    user.locked_until = None
    user.lockout_count = None


def _rate_limit_exceeded(key, limit):
    """True when ``key`` has already used its ``limit`` calls in the window."""
    now = time.monotonic()
    with _RATE_LOCK:
        # Opportunistic housekeeping: once the table grows, drop buckets that have
        # gone stale so a long-running server doesn't accumulate unbounded memory.
        if len(_RATE_HITS) > 2048:
            for stale_key in [
                k for k, v in _RATE_HITS.items()
                if not v or now - v[-1] > _RATE_WINDOW_SECONDS * 2
            ]:
                _RATE_HITS.pop(stale_key, None)
        hits = _RATE_HITS.setdefault(key, [])
        while hits and now - hits[0] > _RATE_WINDOW_SECONDS:
            hits.pop(0)
        if len(hits) >= limit:
            return True
        hits.append(now)
        return False


def _ai_rate_limited():
    """Returns a 429 JSON response if the caller is hammering AI generation."""
    user_id = (getattr(request, "current_user", None) or {}).get("id") or request.remote_addr or "anon"
    if _rate_limit_exceeded(f"ai:{user_id}", MAX_AI_CALLS_PER_MINUTE):
        return jsonify({
            "error": f"Too many AI requests. Please wait a moment and try again (limit: {MAX_AI_CALLS_PER_MINUTE} per minute).",
            "code": "RATE_LIMITED",
        }), 429
    return None


# Fixed bcrypt hash burned on the account-not-found branch of login so a missing
# account takes about the same time as a real password check. Without it, the
# not-found path returns instantly and the timing difference lets an attacker
# enumerate which emails are registered (email-enumeration timing oracle).
_DUMMY_PASSWORD_HASH = generate_password_hash("studylens-timing-equalizer")


def _validate_password_strength(password):
    """Returns an error message string if the password is weak, else None.

    Requires: 8+ characters, at least one uppercase, one lowercase, one digit,
    and one special character.
    """
    if not isinstance(password, str) or len(password) < 8:
        return "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number."
    if not any(not c.isalnum() for c in password):
        return "Password must contain at least one special character."
    return None


def _apply_lockout(user):
    """Locks the account with an escalating duration and refreshes its counter."""
    lock_count = (user.lockout_count or 0) + 1
    user.lockout_count = lock_count
    minutes = _escalated_lockout_minutes(lock_count)
    user.locked_until = (_utcnow_naive() + datetime.timedelta(minutes=minutes)).isoformat()
    return minutes


def _register_login_failure(user):
    """Increments the failure counter and locks the account once it hits the cap.

    While the account is already locked, failed attempts are ignored so the
    lockout timer is not extended by repeated guessing.
    """
    if _is_account_locked(user):
        return
    attempts = (user.failed_login_attempts or 0) + 1
    user.failed_login_attempts = attempts
    user.two_factor_attempts = None
    if attempts >= MAX_LOGIN_ATTEMPTS:
        _apply_lockout(user)
    db.session.commit()


def _ensure_auth_security_columns():
    """Adds the login-lockout and password-reset OTP columns when missing (SQLite/MySQL)."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("users")]
        additions = {
            "failed_login_attempts": "ALTER TABLE users ADD COLUMN failed_login_attempts INT NULL",
            "two_factor_attempts": "ALTER TABLE users ADD COLUMN two_factor_attempts INT NULL",
            "locked_until": "ALTER TABLE users ADD COLUMN locked_until VARCHAR(64) NULL",
            "lockout_count": "ALTER TABLE users ADD COLUMN lockout_count INT NULL",
            "reset_otp": "ALTER TABLE users ADD COLUMN reset_otp VARCHAR(16) NULL",
            "reset_otp_expires_at": "ALTER TABLE users ADD COLUMN reset_otp_expires_at VARCHAR(64) NULL",
            "reset_otp_attempts": "ALTER TABLE users ADD COLUMN reset_otp_attempts INT NULL",
            "email_verified": "ALTER TABLE users ADD COLUMN email_verified INT NULL",
            "email_verify_code": "ALTER TABLE users ADD COLUMN email_verify_code VARCHAR(16) NULL",
            "email_verify_expires_at": "ALTER TABLE users ADD COLUMN email_verify_expires_at VARCHAR(64) NULL",
            "email_verify_attempts": "ALTER TABLE users ADD COLUMN email_verify_attempts INT NULL",
            "token_version": "ALTER TABLE users ADD COLUMN token_version INT NULL",
        }
        for name, statement in additions.items():
            if name not in cols:
                db.session.execute(text(statement))
        db.session.commit()
    except Exception as e:
        print("[Database] auth security column migration skipped:", e)


def _issue_email_verify_code(user):
    """Issues (or refreshes) a 6-digit email-verification code for an account."""
    code = _generate_otp()
    user.email_verify_code = code
    user.email_verify_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=EMAIL_VERIFY_EXPIRY_MINUTES)).isoformat()
    user.email_verify_attempts = 0
    db.session.commit()
    if is_email_enabled():
        send_otp_email(user.email, "verify", code, EMAIL_VERIFY_EXPIRY_MINUTES)
    elif OTP_DEV_REVEAL:
        print(f"[Auth] Email verification OTP for {user.email}: {code}")
    return code


def _user_is_email_verified(user):
    return bool(user.email_verified)


def _email_verify_payload(user):
    """Response body for an unverified account awaiting an email code."""
    payload = {
        "requiresEmailVerification": True,
        "userId": user.user_id,
        "email": user.email,
        "expiresInMinutes": EMAIL_VERIFY_EXPIRY_MINUTES,
    }
    if OTP_DEV_REVEAL and user.email_verify_code:
        payload["devCode"] = user.email_verify_code
    return payload


def _clear_email_verify_state(user):
    user.email_verified = 1
    user.email_verify_code = None
    user.email_verify_expires_at = None
    user.email_verify_attempts = None


def _ensure_quiz_deadline_column():
    """Adds the deadline column to the quizzes table when missing (SQLite/MySQL)."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("quizzes")]
        if "deadline" not in cols:
            db.session.execute(text("ALTER TABLE quizzes ADD COLUMN deadline VARCHAR(64) NULL"))
        db.session.commit()
    except Exception as e:
        print("[Database] quiz deadline column migration skipped:", e)


def _ensure_notification_target_column():
    """Adds the target column to the notifications table when missing (SQLite/MySQL)
    so notifications can carry a deep-link route hint (e.g. quiz:<id>)."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("notifications")]
        if "target" not in cols:
            db.session.execute(text("ALTER TABLE notifications ADD COLUMN target VARCHAR(255) NULL"))
        db.session.commit()
    except Exception as e:
        print("[Database] notifications target column migration skipped:", e)


def _normalize_avatar_placeholders():
    """Heals legacy corrupted avatar values (the string 'None', etc.) to real NULLs."""
    try:
        from sqlalchemy import text
        db.session.execute(
            text("UPDATE users SET profile_picture = NULL "
                 "WHERE profile_picture IN ('None', 'none', 'null', 'undefined', '')")
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print("[Database] avatar normalization skipped:", e)


_SMOKE_ANNOUNCEMENT_TITLES = (
    "EditMe Ann", "EditMe v2", "admin override", "hijack", "AdminGuardAnn",
)


def _purge_test_announcements():
    """Removes leftover automated-test announcements (smoke titles and posts by
    temporary test accounts) so they never surface for real users."""
    try:
        leftovers = AnnouncementModel.query.filter(
            db.or_(
                AnnouncementModel.title.in_(_SMOKE_ANNOUNCEMENT_TITLES),
                AnnouncementModel.teacher_id.like("usr-teacher-t2-%"),
            )
        ).all()
        if leftovers:
            for ann in leftovers:
                db.session.delete(ann)
            db.session.commit()
            print(f"[Database] purged {len(leftovers)} leftover test announcement(s)")
    except Exception as e:
        db.session.rollback()
        print("[Database] test announcement purge skipped:", e)


# Demo credentials for the UC CCS capstone seeded accounts. These match the
# passwords the web frontend ships for its demo (switch-role) logins. Password
# authentication is now mandatory for every account (no passwordless logins), so
# seeded accounts must carry real hashes to keep the demo usable.
DEMO_TEACHER_PASSWORD = "TeacherTest123!"
DEMO_ADMIN_PASSWORD = "Admin!123"


def _ensure_demo_passwords():
    """Backfills password hashes onto the seeded demo accounts (idempotent).

    Mirrors a passwordless/weak seed into password-protected demo accounts so
    the mandatory-password login policy does not lock the built-in demo users out.
    The hashes are recomputed on every boot so existing databases heal in place.

    The built-in admin hash is force-updated on every boot so a changed
    DEMO_ADMIN_PASSWORD is honored even on an already-provisioned database.
    """
    demo_accounts = {
        "usr-teacher-1": DEMO_TEACHER_PASSWORD,
        "usr-admin-1": DEMO_ADMIN_PASSWORD,
    }
    forced = {"usr-admin-1"}
    for user_id, plain in demo_accounts.items():
        try:
            user = db.session.get(UserModel, user_id)
            if user and (user_id in forced or not user.password_hash):
                user.password_hash = generate_password_hash(plain)
        except Exception as e:
            print(f"[Database] demo password backfill skipped for {user_id}: {e}")
    try:
        db.session.commit()
    except Exception as e:
        print("[Database] demo password backfill commit skipped:", e)


def _ensure_demo_email_verified():
    """Marks the built-in seed demo accounts as email-verified (idempotent).

    These accounts are provisioned by the institution rather than self-registered,
    so they skip the registration email check. Without this, the documented demo
    logins would be blocked by the verify-email gate.
    """
    demo_ids = ["usr-teacher-1", "usr-admin-1"]
    changed = False
    for user_id in demo_ids:
        try:
            user = db.session.get(UserModel, user_id)
            if user and not user.email_verified:
                user.email_verified = 1
                user.email_verify_code = None
                user.email_verify_expires_at = None
                user.email_verify_attempts = None
                changed = True
        except Exception as e:
            print(f"[Database] demo email-verified backfill skipped for {user_id}: {e}")
    try:
        if changed:
            db.session.commit()
    except Exception as e:
        print("[Database] demo email-verified backfill commit skipped:", e)

# ----------------------------------------------------
# JWT AUTHENTICATION DECORATORS
# ----------------------------------------------------

def generate_token(user_data):
    settings = _load_system_settings()
    try:
        timeout_mins = max(5, min(1440, int(settings.get("sessionTimeoutMins") or 60)))
    except Exception:
        timeout_mins = 60
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "token_version": user_data.get("tokenVersion") or 0,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=timeout_mins)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def _authenticated_user_from_bearer():
    """Validates the bearer token against the LIVE database row.

    Rejects tokens whose user was deleted, deactivated, demoted, or had their
    token_version bumped (password change/reset, suspension, role change) so those
    changes take effect immediately instead of on the next token refresh. The role
    on a valid request always comes from the DB row, never the client.
    """
    token = _extract_bearer_token()
    if not token:
        return None
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user = db.session.get(UserModel, data.get("user_id"))
        if not user or user.status != "active":
            return None
        if str(user.role) != str(data.get("role")):
            return None
        if int(user.token_version or 0) != int(data.get("token_version") or 0):
            return None
        return user
    except Exception:
        return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _authenticated_user_from_bearer() if _extract_bearer_token() else None
        request.current_user = user.to_dict() if user else None
        return f(*args, **kwargs)
    return decorated

def _extract_bearer_token():
    """Returns the bearer token from the request header, or None."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    return None

def require_auth(f):
    """Strict JWT gate: rejects requests without a valid bearer token (401)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _extract_bearer_token():
            return jsonify({"error": "Authentication required. Please log in.", "code": "AUTH_REQUIRED"}), 401
        user = _authenticated_user_from_bearer()
        if not user:
            return jsonify({"error": "Invalid or expired session. Please log in again.", "code": "INVALID_TOKEN"}), 401
        request.current_user = user.to_dict()
        return f(*args, **kwargs)
    return decorated

def require_roles(*roles):
    """Strict RBAC gate: requires a valid token whose role is in ``roles`` (else 403)."""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            current_user = getattr(request, "current_user", None) or {}
            if current_user.get("role") not in roles:
                return jsonify({"error": "You do not have permission to perform this action.", "code": "FORBIDDEN"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def log_action(user_id, user_name, user_role, action, details):
    try:
        log_item = ActivityLogModel(
            log_id=f"log-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            activity=action,
            details=details,
            ip_address=request.remote_addr or "127.0.0.1",
            device=request.user_agent.platform or "Web Browser",
            browser=request.user_agent.browser or "Chrome/Edge",
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        )
        db.session.add(log_item)
        db.session.commit()
    except Exception as e:
        print("Failed to record audit log:", e)
        try:
            db.session.rollback()
        except Exception:
            pass

@app.errorhandler(GroqAPIError)
def handle_groq_error(err):
    """Safe, structured error contract for Groq failures. Never leaks the API key."""
    status_map = {
        "INVALID_API_KEY": 503,
        "RATE_LIMITED": 429,
        "TIMEOUT": 504,
        "API_UNAVAILABLE": 502,
        "AI_SERVICE_DOWN": 502,
        "MODEL_NOT_FOUND": 502,
        "API_ERROR": 502,
    }
    status = status_map.get(err.code, 502)
    return jsonify({"error": err.message, "code": err.code}), status

_LAST_COMMIT_ERROR = ""

def _commit_or_warn(description, restage=None):
    """Best-effort persistence: content is still returned if the DB write fails.

    Retries once with a fresh session so transient MySQL connection drops
    ("server has gone away") recover automatically instead of surfacing a
    misleading SAVE_FAILED to the user. On retry, `restage()` (if provided)
    re-adds the pending objects to the fresh session; without it the commit is
    attempted exactly once so a failure is reported truthfully instead of
    silently "succeeding" while persisting nothing.
    """
    global _LAST_COMMIT_ERROR
    for attempt in (1, 2):
        try:
            db.session.commit()
            _LAST_COMMIT_ERROR = ""
            return True
        except Exception as e:
            short = str(e).splitlines()[0][:180] if str(e) else e.__class__.__name__
            _LAST_COMMIT_ERROR = short
            print(f"[Database] Could not persist {description} (attempt {attempt}): {e}")
            try:
                db.session.rollback()
            except Exception:
                pass
            try:
                db.session.remove()
            except Exception:
                pass
            if attempt == 1 and restage:
                try:
                    restage()
                except Exception as re:
                    _LAST_COMMIT_ERROR = f"restage failed: {re}"
                    print(f"[Database] Could not restage {description} for retry: {re}")
                    return False
                continue
            return False
    return False

def _json_loads(text):
    if not text:
        return []
    try:
        return json.loads(text)
    except Exception:
        return []

def _quiz_questions_for(quiz_id):
    """Returns the questions list for a quiz from the quiz_questions table, or None if none stored."""
    rows = QuizQuestionModel.query.filter_by(quiz_id=quiz_id).order_by(QuizQuestionModel.question_order).all()
    if not rows:
        return None
    return [row.to_dict() for row in rows]

def _collision_safe_question_id(raw_id, quiz_id, idx):
    """Returns a unique global question id: keeps the requested id when free, otherwise falls back to q-<quiz_id>-<idx>."""
    candidate = str(raw_id).strip() if raw_id else ""
    if candidate and db.session.get(QuizQuestionModel, candidate) is None:
        return candidate
    return f"q-{quiz_id}-{idx}"

def _replace_quiz_questions(quiz_id, questions):
    """Rebuilds the quiz_questions rows for a quiz from a question list (idempotent, transactional)."""
    QuizQuestionModel.query.filter_by(quiz_id=quiz_id).delete(synchronize_session=False)
    for idx, q in enumerate(questions or []):
        if not isinstance(q, dict):
            continue
        options = q.get("options") or []
        letter = None
        if isinstance(q.get("correctAnswer"), int) and 0 <= q["correctAnswer"] < len(options):
            letter = "ABCD"[q["correctAnswer"]] if len(options) <= 4 else str(q["correctAnswer"])
        elif isinstance(q.get("correctAnswer"), str) and q["correctAnswer"] in "ABCD":
            letter = q["correctAnswer"]
        # Multi-answer questions store no single letter (column is CHAR(1));
        # grading reads the authoritative list from questions_json.
        row = QuizQuestionModel(
            question_id=_collision_safe_question_id(q.get("id") or "", quiz_id, idx),
            quiz_id=quiz_id,
            question=q.get("question", ""),
            choice_a=options[0] if len(options) > 0 else None,
            choice_b=options[1] if len(options) > 1 else None,
            choice_c=options[2] if len(options) > 2 else None,
            choice_d=options[3] if len(options) > 3 else None,
            correct_answer=letter,
            points=1,
            options_json=json.dumps(options) if options else None,
            topic_tag=q.get("topicTag") or q.get("topic"),
            blooms_level=q.get("bloomsLevel"),
            difficulty=q.get("difficulty"),
            explanation=q.get("explanation"),
            question_order=idx,
        )
        db.session.add(row)

# Cap AI generation counts so single requests stay within the model's output-token budget.
# Large counts are batch-chunked across multiple AI calls (see groq_service.MAX_PER_CHUNK).
MAX_AI_QUESTIONS = 100
MAX_AI_FLASHCARDS = 100

def _clamp_count(raw, fallback=5, minimum=1, maximum=20):
    """Safely parses a count value from request data and clamps it to [minimum, maximum]."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = fallback
    if value < minimum:
        value = minimum
    if value > maximum:
        value = maximum
    return value

def _clamp_attempts(raw, fallback=0):
    """Safely parses a max-attempts value; 0 means unlimited, capped at 99."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = fallback
    return max(0, min(99, value))

def _reveal_answers(raw, fallback=True):
    """Safely parses the reveal-answers flag; default True (answers visible)."""
    if raw is None:
        return fallback
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ("1", "true", "yes", "on")

def _clean_extracted_text(text):
    """Normalizes and trims extracted document text for AI consumption."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    text = "\n".join(lines)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text[:12000].strip()

def _delete_local_upload(file_url):
    """Best-effort removal of a locally stored upload when its record is deleted.

    Only ever touches files under the uploads root; the URL's basename is reused
    exactly as the file was stored (randomized server-side). Failures are logged
    but never allowed to break the delete request.
    """
    if not file_url or not str(file_url).startswith("/uploads/"):
        return
    name = os.path.basename(str(file_url).replace("\\", "/"))
    if name in ("", ".", ".."):
        return
    full = os.path.join(_UPLOADS_DIR, name)
    try:
        if os.path.realpath(full).startswith(os.path.realpath(_UPLOADS_DIR).rstrip("\\/") + os.sep) and os.path.isfile(full):
            os.remove(full)
    except Exception as e:
        print(f"[Storage] Could not remove local file {full}: {e}")


def _extract_text_from_file(file_bytes, ext):
    """Extracts readable text from an uploaded document (best-effort)."""
    ext = (ext or "").lower()
    try:
        if ext == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = []
            for page in reader.pages[:MAX_EXTRACT_PAGES]:
                try:
                    pages.append(page.extract_text() or "")
                except Exception:
                    continue
            return _clean_extracted_text("\n".join(pages))
        if ext in ("docx", "doc"):
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            return _clean_extracted_text("\n".join(p.text for p in doc.paragraphs))
        if ext == "pptx":
            from pptx import Presentation
            prs = Presentation(io.BytesIO(file_bytes))
            lines = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text") and getattr(shape, "text", "").strip():
                        lines.append(shape.text)
            return _clean_extracted_text("\n".join(lines))
        if ext in ("txt", "md", "csv", "json", "rtf", "log", "html", "htm"):
            for enc in ("utf-8-sig", "utf-8", "latin-1"):
                try:
                    return _clean_extracted_text(file_bytes.decode(enc))
                except (UnicodeDecodeError, ValueError):
                    continue
            return _clean_extracted_text(file_bytes.decode("utf-8", errors="ignore"))
        if f".{ext}" in IMAGE_EXTENSIONS:
            import base64
            mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "bmp": "image/bmp"}
            mime = mime_map.get(ext, f"image/{ext}")
            image_b64 = base64.b64encode(file_bytes).decode("ascii")
            vision_text = describe_image_with_groq(image_b64, mime)
            if vision_text:
                return _clean_extracted_text(vision_text)
            print(f"[Upload] Vision extraction returned no text for .{ext}; using fallback.")
    except Exception as e:
        print(f"[Upload] Text extraction failed for extension .{ext}: {e}")
    return ""

def _save_ai_generated_content(generated_by, material_id, title, content_type, result):
    """Stores explain/recommendation outputs in the ai_generated_content table (best-effort)."""
    entry = AIGeneratedContentModel(
        content_id=f"ai-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        material_id=material_id,
        generated_by=generated_by,
        title=title,
        content_type=content_type,
        generated_text=json.dumps(result),
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(entry)
    _commit_or_warn(f"AI {content_type} content")

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


def _build_student_learning_profile(student_id, subject_id=None):
    """Aggregates quiz attempt analytics + progress into a profile for the AI advisor."""
    profile = {
        "studentId": student_id,
        "subjectId": subject_id,
        "subjectName": "General",
        "averageScore": 0.0,
        "completionPercentage": 0.0,
        "learningLevel": "Beginner",
        "attemptCount": 0,
        "weakTopics": [],
        "strongTopics": [],
        "lastActivity": ""
    }
    try:
        attempts_q = QuizAttemptModel.query.filter_by(student_id=student_id)
        if subject_id:
            attempts_q = attempts_q.filter_by(subject_id=subject_id)
        attempts = attempts_q.all()
        if attempts:
            scores = [a.percentage for a in attempts]
            profile["averageScore"] = round(sum(scores) / len(scores), 1)
            profile["attemptCount"] = len(attempts)
            profile["lastActivity"] = attempts[0].submitted_at
            weak_counts = {}
            strong_counts = {}
            for a in attempts:
                for t in _json_loads(a.weak_topics_json):
                    weak_counts[t] = weak_counts.get(t, 0) + 1
                for t in _json_loads(a.strong_topics_json):
                    strong_counts[t] = strong_counts.get(t, 0) + 1
            profile["weakTopics"] = sorted(weak_counts, key=weak_counts.get, reverse=True)[:5]
            profile["strongTopics"] = sorted(strong_counts, key=strong_counts.get, reverse=True)[:5]
            prog_res = StudentProgressModel.query.filter_by(student_id=student_id)
            if subject_id:
                prog_res = prog_res.filter_by(subject_id=subject_id)
            prog = prog_res.first()
            if prog:
                profile["completionPercentage"] = prog.completion_percentage or 0.0
                profile["learningLevel"] = prog.learning_level or "Intermediate"
    except Exception as e:
        print("[Database] Could not build learning profile:", e)
    return profile

# ----------------------------------------------------
# REST API ENDPOINTS
# ----------------------------------------------------

@app.route("/api/system/info", methods=["GET"])
def get_system_info():
    return jsonify({
        "platformName": "StudyLens AI: An Adaptive Learning and Automated Assessment Generation Platform",
        "institution": "University of Cebu – Main Campus, College of Computer Studies (UC CCS)",
        "degree": "Bachelor of Science in Information Technology (BSIT)",
        "capstoneTeam": {
            "projectManager": "John Wendyl S. Sanchez",
            "programmer": "Vin Henry S. Ardiente",
            "designer": "Precious Marie B. Salve",
            "qaTester": "Jeric Nino G. Solitana",
            "adviser": "Christian C. Barral, MIT",
            "dean": "Neil A. Basabe, DIT"
        },
        "version": "2.0.0 (Groq GPT-OSS-120B Edition)",
        "techStack": {
            "webFrontend": "React + Vite + Tailwind CSS",
            "mobileApp": "React-Native",
            "backend": "Python - Flask",
            "database": "MySQL (14 Mapped ERD Tables)",
            "authentication": "JSON Web Token (JWT) & Role-Based Access Control",
            "cloudStorage": "Cloudinary / Firebase Storage",
            "aiIntegration": "Groq Inference API (GPT-OSS-120B LLM)"
        },
        "sdgs": [
            "SDG 4: Quality Education",
            "SDG 9: Industry, Innovation, and Infrastructure"
        ]
    })

@app.route("/api/system/settings", methods=["GET"])
@require_auth
def get_system_settings():
    return jsonify(_boolify_settings(_load_system_settings()))

@app.route("/api/system/settings", methods=["POST", "PUT"])
@require_roles("admin")
def save_system_settings():
    data = request.json or {}
    settings = _load_system_settings()
    for key in DEFAULT_SYSTEM_SETTINGS:
        if key in data:
            val = data[key]
            if isinstance(val, bool):
                settings[key] = "true" if val else "false"
            else:
                settings[key] = str(val)
    # Clamp session timeout to a sane range so a bad write can't break logins
    try:
        timeout = int(settings.get("sessionTimeoutMins") or 60)
    except (TypeError, ValueError):
        timeout = 60
    settings["sessionTimeoutMins"] = str(max(5, min(1440, timeout)))
    _save_system_settings(settings)
    _enforce_archiving(settings)
    return jsonify(_boolify_settings(settings))

@app.route("/api/system/backup", methods=["GET"])
@require_roles("admin")
def system_backup():
    """Dumps all application tables into a single JSON payload for backup."""
    def rows(model):
        return [r.to_dict() if hasattr(r, "to_dict") else {c.name: getattr(r, c.name) for c in model.__table__.columns} for r in model.query.all()]
    payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "users": rows(UserModel),
        "roles": rows(RoleModel),
        "subjects": rows(SubjectModel),
        "materials": rows(MaterialModel),
        "quizzes": rows(QuizModel),
        "quizQuestions": rows(QuizQuestionModel),
        "quizAttempts": rows(QuizAttemptModel),
        "studentProgress": rows(StudentProgressModel),
        "studentSubjects": rows(StudentSubjectModel),
        "announcements": rows(AnnouncementModel),
        "reports": rows(ReportModel),
        "aiGeneratedContent": rows(AIGeneratedContentModel),
        "activityLogs": rows(ActivityLogModel),
        "systemSettings": rows(SystemSettingModel),
        "auditArchive": rows(ActivityLogArchiveModel),
    }
    return jsonify(payload), 200

def _enforce_archiving(settings):
    """Archives activity logs older than 90 days when auto-audit archiving is on."""
    if settings.get("autoAuditArchiving") != "true":
        return
    try:
        cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S")
        old_logs = ActivityLogModel.query.filter(ActivityLogModel.created_at < cutoff).all()
        for log in old_logs:
            db.session.add(ActivityLogArchiveModel(
                log_id=log.log_id, user_id=log.user_id, user_name=log.user_name,
                user_role=log.user_role, activity=log.activity, details=log.details,
                ip_address=log.ip_address, created_at=log.created_at,
            ))
            db.session.delete(log)
        if old_logs:
            _commit_or_warn("audit archiving")
    except Exception:
        pass

@app.before_request
def enforce_maintenance_mode():
    """Global gate: when maintenance mode is on, only admins may use the API."""
    path = request.path
    if not path.startswith("/api/"):
        return
    if path in ("/api/auth/login", "/api/auth/register", "/api/auth/verify-2fa", "/api/auth/resend-2fa"):
        return
    settings = _load_system_settings()
    if settings.get("maintenanceMode") != "true":
        return
    token = _extract_bearer_token()
    if not token:
        return jsonify({"error": "System is under maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}), 503
    user = _authenticated_user_from_bearer()
    if not user or user.role != "admin":
        return jsonify({"error": "System is under maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}), 503

# --------------------------------------------------
# AUTH ROUTES
# --------------------------------------------------
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.json or {}
    email = data.get("email")

    # Per-IP throttle on top of the per-account lockout, so password guessing
    # across many accounts (or from a botnet) can't spin the CPU or hammer hashes.
    if _rate_limit_exceeded(f"login-ip:{request.remote_addr}", 60):
        return jsonify({
            "error": "Too many login attempts from this location. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429

    email_str = email.strip() if isinstance(email, str) else (email.get("email", "").strip() if isinstance(email, dict) else "")

    # Accounts are provisioned by administrators or self-registration; they are
    # NEVER minted on the fly from client-supplied identity (name/role/id). Login
    # must match an account that already exists in the user directory.
    user = UserModel.query.filter(db.func.lower(UserModel.email) == email_str.lower()).first() if email_str else None

    if not user:
        # Burn the same time a real password verification costs, then reply with
        # the identical generic wording used for a wrong password so attackers
        # cannot tell which emails exist in the user directory (enumeration).
        check_password_hash(_DUMMY_PASSWORD_HASH, data.get("password") if isinstance(data.get("password"), str) else "")
        return jsonify({"error": "Invalid email or password. Please try again.", "code": "INVALID_CREDENTIALS"}), 401

    # Accounts throttled at the lockout cap cannot keep guessing.
    lock_minutes = _lock_minutes_remaining(user)
    if lock_minutes:
        show_minutes = int(lock_minutes) + (1 if lock_minutes > int(lock_minutes) else 0)
        log_action(user.user_id, user.to_dict()["name"], user.role, "LOGIN_LOCKED", f"Login blocked for {user.email} (locked for about {show_minutes} minute(s))")
        return jsonify({
            "error": f"Account temporarily locked due to too many failed login attempts. Try again in about {show_minutes} minute(s).",
            "code": "ACCOUNT_LOCKED",
        }), 429

    # Password authentication is required for EVERY account. Legacy accounts
    # without a password hash cannot authenticate until an admin sets one
    # (passwordless logins were a full account-takeover vector).
    password = data.get("password")
    if not isinstance(password, str) or not password:
        return jsonify({"error": "Invalid email or password. Please try again.", "code": "INVALID_CREDENTIALS"}), 401
    if not check_password_hash(user.password_hash or "", password):
        _register_login_failure(user)
        locked = _is_account_locked(user)
        log_action(user.user_id, user.to_dict()["name"], user.role, "ACCOUNT_LOCKED" if locked else "LOGIN_FAILED", f"Failed login attempt for {user.email} (incorrect password)")
        if locked:
            show_minutes = max(1, int(_lock_minutes_remaining(user)) + 1)
            return jsonify({
                "error": f"Account temporarily locked due to too many failed login attempts. Try again in about {show_minutes} minute(s).",
                "code": "ACCOUNT_LOCKED",
            }), 429
        return jsonify({"error": "Invalid email or password. Please try again.", "code": "INVALID_CREDENTIALS"}), 401

    # Cleared by a successful password check; a fresh 2FA ping also resets the
    # attempts meter so a legitimately signed-in user isn't double-counted.
    _clear_login_failures(user)

    # Deactivated/suspended accounts cannot sign in. Checked after the correct
    # password so the reason isn't leaked to unauthenticated guessers.
    if (user.status or "active") != "active":
        log_action(user.user_id, user.to_dict()["name"], user.role, "LOGIN_DISABLED", f"Login blocked for {user.email} (status: {user.status})")
        return jsonify({
            "error": "This account cannot sign in. Please contact an administrator.",
            "code": "ACCOUNT_DISABLED",
        }), 403

    # Email must be verified before the account can sign in. Unverified accounts
    # get a fresh code and are routed to the verify-email screen (no token yet).
    if not _user_is_email_verified(user):
        _issue_email_verify_code(user)
        log_action(user.user_id, user.to_dict()["name"], user.role, "EMAIL_VERIFY_REQUIRED", f"Login blocked for unverified email {user.email}; verification code issued")
        return jsonify(_email_verify_payload(user)), 200

    # Two-factor authentication enforcement for staff/admin logins
    settings = _load_system_settings()
    if settings.get("require2FA") == "true" and user.role in ("teacher", "admin"):
        code = _generate_otp()
        user.two_factor_code = code
        user.two_factor_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=5)).isoformat()
        db.session.commit()
        if is_email_enabled():
            send_otp_email(user.email, "2fa", code, 5)
        elif OTP_DEV_REVEAL:
            print(f"[Auth] 2FA OTP for {user.email}: {code}")
        log_action(user.user_id, user.to_dict()["name"], user.role, "TWO_FACTOR_REQUIRED", f"2FA code issued for {user.email}")
        payload = {
            "twoFactorRequired": True,
            "userId": user.user_id,
            "email": user.email,
            "expiresInMinutes": 5,
        }
        if OTP_DEV_REVEAL:
            payload["devCode"] = code
        return jsonify(payload), 200

    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) logged in with JWT token")

    return jsonify({"token": token, "user": user_dict})

@app.route("/api/auth/verify-2fa", methods=["POST"])
def verify_two_factor():
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    code = str(data.get("code") or "").strip()
    user = db.session.get(UserModel, user_id) if user_id else None
    if not user:
        return jsonify({"error": "Session expired. Please sign in again.", "code": "NOT_FOUND"}), 401
    if (user.status or "active") != "active":
        return jsonify({"error": "This account cannot sign in. Please contact an administrator.", "code": "ACCOUNT_DISABLED"}), 403
    if _is_account_locked(user):
        show_minutes = max(1, int(_lock_minutes_remaining(user)) + 1)
        return jsonify({
            "error": f"Account temporarily locked due to too many failed attempts. Try again in about {show_minutes} minute(s).",
            "code": "ACCOUNT_LOCKED",
        }), 429
    if not user.two_factor_code or not secrets.compare_digest(user.two_factor_code, code):
        user.two_factor_attempts = (user.two_factor_attempts or 0) + 1
        if (user.two_factor_attempts or 0) >= TWO_FACTOR_MAX_ATTEMPTS:
            _apply_lockout(user)
        db.session.commit()
        return jsonify({"error": "Invalid verification code. Please try again.", "code": "INVALID_2FA"}), 401
    expires = _parse_iso(user.two_factor_expires_at)
    if expires and _utcnow_naive() > expires:
        return jsonify({"error": "Verification code has expired. Please sign in again.", "code": "EXPIRED_2FA"}), 401
    _clear_login_failures(user)
    user.two_factor_code = None
    user.two_factor_expires_at = None
    user.last_login = _utcnow_iso_z()
    db.session.commit()
    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) completed 2FA login")
    return jsonify({"token": token, "user": user_dict})

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.json or {}
    if _rate_limit_exceeded(f"register-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many sign-up attempts from this location. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()

    # Self-registration is open to student and teacher roles. Administrator
    # accounts cannot be claimed through the public endpoint — they are
    # provisioned by an existing admin.
    requested_role = data.get("role")
    if requested_role == "admin":
        return jsonify({
            "error": "Administrator accounts cannot be self-registered. Please contact an administrator.",
            "code": "ADMIN_REGISTRATION_DISABLED",
        }), 403
    role = "teacher" if requested_role == "teacher" else "student"

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required."}), 400

    existing = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if existing:
        return jsonify({
            "error": f"Account with email {email} is already registered.",
            "code": "USER_EXISTS"
        }), 409

    names = name.split(" ", 1)
    new_user = UserModel(
        user_id=f"usr-{role}-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        first_name=names[0] if names else "Registered",
        last_name=names[1] if len(names) > 1 else "User",
        email=email,
        role=role,
        department=data.get("department") or "College of Computer Studies",
        student_id=data.get("studentId") or (f"2024-STU-{int(datetime.datetime.now(datetime.timezone.utc).timestamp()) % 8999 + 1000}" if role == "student" else None),
        status="active",
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    password = data.get("password")
    strength_error = _validate_password_strength(password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "PASSWORD_REQUIRED"}), 400
    new_user.password_hash = generate_password_hash(password)
    new_user.email_verified = 0
    db.session.add(new_user)
    db.session.commit()

    _issue_email_verify_code(new_user)
    log_action(new_user.user_id, new_user.to_dict()["name"], new_user.role, "USER_REGISTER", f"Registered new {role} account: {email} (awaiting email verification)")
    return jsonify(_email_verify_payload(new_user)), 201

@app.route("/api/auth/verify-email", methods=["POST"])
def verify_email():
    """Confirms a registration by verifying the emailed 6-digit code; on success returns a full login token."""
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    code = str(data.get("code") or "").strip()
    user = db.session.get(UserModel, user_id) if user_id else None

    if not user:
        return jsonify({"error": "Account not found. Please register again.", "code": "NOT_FOUND"}), 404
    if (user.status or "active") != "active":
        return jsonify({"error": "This account cannot sign in. Please contact an administrator.", "code": "ACCOUNT_DISABLED"}), 403
    if _user_is_email_verified(user):
        # Already verified: never mint a token without credentials. The client
        # should sign in with the password instead of re-verifying an active account.
        return jsonify({
            "error": "This account is already verified. Please sign in with your password.",
            "code": "ALREADY_VERIFIED",
        }), 409
    if not user.email_verify_code or not user.email_verify_expires_at:
        # No pending code; reissue one.
        _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user)), 200

    expires = _parse_iso(user.email_verify_expires_at)
    if expires and _utcnow_naive() > expires:
        _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user)), 200
    if (user.email_verify_attempts or 0) >= EMAIL_VERIFY_MAX_ATTEMPTS:
        _issue_email_verify_code(user)
        return jsonify(_email_verify_payload(user)), 200
    if not code or not user.email_verify_code or not secrets.compare_digest(user.email_verify_code, code):
        user.email_verify_attempts = (user.email_verify_attempts or 0) + 1
        db.session.commit()
        return jsonify({"error": "Incorrect verification code. Please try again.", "code": "INVALID_EMAIL_CODE"}), 401

    _clear_email_verify_state(user)
    user.last_login = _utcnow_iso_z()
    db.session.commit()
    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "EMAIL_VERIFIED", f"Email address verified for {user.email}")
    return jsonify({"token": token, "user": user_dict}), 200

@app.route("/api/auth/resend-email-code", methods=["POST"])
def resend_email_code():
    """Re-issues a 6-digit email-verification code for an unverified account."""
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    user = db.session.get(UserModel, user_id) if user_id else None
    if not user:
        return jsonify({"error": "Account not found. Please register again.", "code": "NOT_FOUND"}), 404
    if _user_is_email_verified(user):
        return jsonify(_email_verify_payload(user)), 200
    _issue_email_verify_code(user)
    return jsonify(_email_verify_payload(user)), 200

@app.route("/api/auth/resend-2fa", methods=["POST"])
def resend_two_factor_code():
    """Re-issues a 6-digit two-factor code for a pending staff/admin sign-in."""
    data = request.json or {}
    if _rate_limit_exceeded(f"verify-ip:{request.remote_addr}", 30):
        return jsonify({
            "error": "Too many verification attempts. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    user_id = data.get("userId") or ""
    user = db.session.get(UserModel, user_id) if user_id else None
    if not user:
        return jsonify({"error": "Session expired. Please sign in again.", "code": "NOT_FOUND"}), 404
    if (user.status or "active") != "active":
        return jsonify({"error": "This account cannot sign in. Please contact an administrator.", "code": "ACCOUNT_DISABLED"}), 403
    if _is_account_locked(user):
        show_minutes = max(1, int(_lock_minutes_remaining(user)) + 1)
        return jsonify({
            "error": f"Account temporarily locked due to too many failed attempts. Try again in about {show_minutes} minute(s).",
            "code": "ACCOUNT_LOCKED",
        }), 429
    settings = _load_system_settings()
    if settings.get("require2FA") != "true" or user.role not in ("teacher", "admin"):
        return jsonify({
            "error": "Two-factor authentication is not required for this account. Please sign in again.",
            "code": "2FA_NOT_REQUIRED",
        }), 400
    if not user.two_factor_code:
        return jsonify({
            "error": "No pending verification. Please sign in again.",
            "code": "NO_PENDING_2FA",
        }), 400
    code = _generate_otp()
    user.two_factor_code = code
    user.two_factor_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=5)).isoformat()
    user.two_factor_attempts = None
    db.session.commit()
    if is_email_enabled():
        send_otp_email(user.email, "2fa", code, 5)
    elif OTP_DEV_REVEAL:
        print(f"[Auth] 2FA OTP for {user.email}: {code}")
    payload = {"message": f"A new verification code was sent to {user.email}.", "expiresInMinutes": 5}
    if OTP_DEV_REVEAL:
        payload["devCode"] = code
    return jsonify(payload), 200

@app.route("/api/auth/change-password", methods=["POST"])
@require_auth
def auth_change_password():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    user = db.session.get(UserModel, current_user.get("id"))
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    new_password = data.get("newPassword")
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "WEAK_PASSWORD"}), 400

    if user.password_hash:
        current_password = data.get("currentPassword")
        if not isinstance(current_password, str) or not check_password_hash(user.password_hash, current_password):
            _register_login_failure(user)
            return jsonify({"error": "Current password is incorrect.", "code": "INVALID_CURRENT_PASSWORD"}), 401

    _clear_login_failures(user)
    user.password_hash = generate_password_hash(new_password)
    # Invalidate every other session this user holds (password knowledge changed).
    user.token_version = (user.token_version or 0) + 1
    if not _commit_or_warn("password change"):
        return jsonify({"error": "Could not update the password. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    # The current session is refreshed with a fresh token (the bumped token_version
    # has just invalidated the old one), so the user stays signed in.
    user_dict = user.to_dict()
    fresh_token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "PASSWORD_CHANGED", f"User changed their own password")
    return jsonify({"success": True, "message": "Password updated successfully.", "token": fresh_token, "user": user_dict}), 200

@app.route("/api/auth/reset-otp", methods=["POST"])
def auth_request_reset_otp():
    """Initiates the forgot-password flow: issues a 6-digit OTP for a student account."""
    data = request.json or {}
    if _rate_limit_exceeded(f"reset-otp-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many reset requests. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400

    user = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if not user:
        # Generic reply so attackers can't enumerate which emails are registered.
        return jsonify({
            "success": True,
            "message": "If an account exists for that email, a password reset code has been issued.",
            "expiresInMinutes": RESET_OTP_EXPIRY_MINUTES,
        }), 200
    if user.role in ("teacher", "admin"):
        return jsonify({
            "error": "Staff passwords cannot be reset through the self-service flow. Please contact an administrator.",
            "code": "STAFF_RESET_FORBIDDEN",
        }), 403

    # A temporary login lockout is intentionally overridable here: the reset code
    # goes to the owner's verified email, so this is the recovery path if the
    # owner is locked out by failed guesses (the code itself gates the change).
    # Issuing a new code is always allowed: it supersedes any prior code and
    # resets its attempts, so mistaken users aren't stuck behind a burned code.
    code = _generate_otp()
    user.reset_otp = code
    user.reset_otp_expires_at = (_utcnow_naive() + datetime.timedelta(minutes=RESET_OTP_EXPIRY_MINUTES)).isoformat()
    user.reset_otp_attempts = 0
    db.session.commit()
    if is_email_enabled():
        send_otp_email(user.email, "reset", code, RESET_OTP_EXPIRY_MINUTES)
    elif OTP_DEV_REVEAL:
        print(f"[Auth] Password reset OTP for {user.email}: {code}")
    log_action(user.user_id, user.to_dict()["name"], user.role, "RESET_OTP_REQUESTED", f"Password reset code issued for {user.email}")

    payload = {
        "success": True,
        "message": f"A 6-digit verification code was sent to {user.email}. It expires in {RESET_OTP_EXPIRY_MINUTES} minutes.",
        "expiresInMinutes": RESET_OTP_EXPIRY_MINUTES,
    }
    if OTP_DEV_REVEAL:
        payload["devCode"] = code
    return jsonify(payload), 200

@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    """Verifies the emailed OTP and applies a new password for a student account."""
    data = request.json or {}
    if _rate_limit_exceeded(f"reset-pw-ip:{request.remote_addr}", 10):
        return jsonify({
            "error": "Too many reset requests. Please try again in a minute.",
            "code": "RATE_LIMITED",
        }), 429
    email = (data.get("email") or "").strip().lower()
    otp = str(data.get("otp") or data.get("code") or "").strip()
    new_password = data.get("newPassword")
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "WEAK_PASSWORD"}), 400

    user = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if not user:
        # Generic reply so attackers can't use this step to enumerate registered emails.
        return jsonify({
            "error": "No matching reset request was found for that email. Please request a new code and try again.",
            "code": "NOT_FOUND",
        }), 404
    if user.role in ("teacher", "admin"):
        return jsonify({
            "error": "Staff passwords cannot be reset through the self-service flow. Please contact an administrator.",
            "code": "STAFF_RESET_FORBIDDEN",
        }), 403

    # Temporary login lockouts don't block the OTP-gated reset (email-verified).
    expires = _parse_iso(user.reset_otp_expires_at)
    if not user.reset_otp or not expires or _utcnow_naive() > expires:
        user.reset_otp = None
        user.reset_otp_expires_at = None
        user.reset_otp_attempts = None
        db.session.commit()
        return jsonify({"error": "This code has expired. Request a new one.", "code": "RESET_OTP_EXPIRED"}), 401
    if (user.reset_otp_attempts or 0) >= RESET_OTP_MAX_ATTEMPTS:
        return jsonify({"error": "Too many incorrect reset codes. Request a new code.", "code": "RESET_OTP_LOCKED"}), 429
    if not otp or not user.reset_otp or not secrets.compare_digest(user.reset_otp, otp):
        user.reset_otp_attempts = (user.reset_otp_attempts or 0) + 1
        db.session.commit()
        return jsonify({"error": "Incorrect verification code. Please try again.", "code": "INVALID_OTP"}), 401

    _clear_login_failures(user)
    user.password_hash = generate_password_hash(new_password)
    user.reset_otp = None
    user.reset_otp_expires_at = None
    user.reset_otp_attempts = None
    # Invalidate any sessions minted before the reset.
    user.token_version = (user.token_version or 0) + 1
    if not _commit_or_warn("password reset"):
        return jsonify({"error": "Could not update the password. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(user.user_id, user.to_dict()["name"], user.role, "PASSWORD_RESET", f"Password reset via forgot-password flow for {email}")
    return jsonify({"success": True, "message": "Password reset successfully. You can now sign in with your new password."}), 200

# --------------------------------------------------
# USER ROUTES
# --------------------------------------------------
@app.route("/api/users", methods=["GET"])
@app.route("/api/users/", methods=["GET"])
@require_auth
def get_users():
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""
    users = UserModel.query.all()
    if role == "teacher":
        # Teachers may only enumerate students enrolled in subjects they manage.
        managed = [s.subject_id for s in SubjectModel.query.filter_by(teacher_id=user_id).all()]
        enrolled_ids = {
            e.student_id
            for e in StudentSubjectModel.query.filter(StudentSubjectModel.subject_id.in_(managed)).all()
        } if managed else set()
        users = [u for u in users if u.user_id in enrolled_ids]
    elif role != "admin":
        return jsonify({"error": "You do not have permission to view the user directory.", "code": "FORBIDDEN"}), 403
    return jsonify([u.to_dict() for u in users])

@app.route("/api/users", methods=["POST"])
@require_roles("admin")
def create_user():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    role = data.get("role") or "student"
    department = data.get("department") or "College of Computer Studies"
    status = data.get("status") or "active"

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400
    if not name:
        return jsonify({"error": "User name is required.", "code": "BAD_REQUEST"}), 400

    existing = UserModel.query.filter(db.func.lower(UserModel.email) == email).first()
    if existing:
        return jsonify({"error": f"Account with email {email} already exists.", "code": "DUPLICATE"}), 409

    names = name.split(" ", 1)
    new_user = UserModel(
        user_id=f"usr-{role}-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        first_name=names[0],
        last_name=names[1] if len(names) > 1 else "",
        email=email,
        role=role,
        department=department,
        student_id=f"2024-STU-{int(datetime.datetime.now(datetime.timezone.utc).timestamp()) % 8999 + 1000}" if role == "student" else None,
        status=status,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    password = data.get("password")
    strength_error = _validate_password_strength(password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "PASSWORD_REQUIRED"}), 400
    new_user.password_hash = generate_password_hash(password)
    db.session.add(new_user)
    if not _commit_or_warn("new user"):
        return jsonify({"error": "Could not save the user. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(new_user.user_id, new_user.to_dict()["name"], role, "USER_CREATED", f"Administrator created {role} account {email}")
    return jsonify(new_user.to_dict()), 201

@app.route("/api/users/<user_id>", methods=["PUT"])
@require_auth
def update_user(user_id):
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    is_admin = current_user.get("role") == "admin"
    is_self = current_user.get("id") == user_id
    if not (is_admin or is_self):
        return jsonify({"error": "You do not have permission to edit this account.", "code": "FORBIDDEN"}), 403

    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    old_name = ""
    name_changed = False
    if data.get("name"):
        old_name = user.to_dict()["name"]
        names = str(data["name"]).split(" ", 1)
        user.first_name = names[0]
        user.last_name = names[1] if len(names) > 1 else ""
        if old_name != user.to_dict()["name"]:
            name_changed = True
    role_changed = False
    if is_admin and data.get("role"):
        role_changed = user.role != data["role"]
        user.role = data["role"]
    if data.get("department"):
        user.department = data["department"]
    if "avatar" in data:
        # Removal sends null/""; also guard against literal junk strings
        # ("None"/"null"/"undefined") that must never be stored as a URL.
        raw_avatar = data["avatar"]
        avatar_val = str(raw_avatar).strip() if raw_avatar else ""
        user.profile_picture = avatar_val if avatar_val.lower() not in ("", "none", "null", "undefined") else None
    status_changed = False
    if is_admin and data.get("status"):
        status_changed = user.status != data["status"]
        user.status = data["status"]
    password = data.get("password")
    if isinstance(password, str) and password:
        strength_error = _validate_password_strength(password)
        if strength_error:
            return jsonify({"error": strength_error, "code": "WEAK_PASSWORD"}), 400
        if not is_admin:
            current_password = data.get("currentPassword") or ""
            if not check_password_hash(user.password_hash or "", current_password):
                return jsonify({"error": "Your current password is incorrect.", "code": "INVALID_CREDENTIALS"}), 403
        user.password_hash = generate_password_hash(password)
        log_action(user.user_id, user.to_dict()["name"], user.role, "PASSWORD_RESET", f"Password updated for {user.email}")

    # Role changes, suspensions, and password resets invalidate that user's
    # existing sessions so privileges are adjusted immediately.
    auth_attr_changed = role_changed or status_changed or (isinstance(password, str) and password)
    if auth_attr_changed:
        user.token_version = (user.token_version or 0) + 1

    if not _commit_or_warn("user update"):
        return jsonify({"error": "Could not update the user. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500

    # Propagate a name change to the snapshot fields that duplicate the user's
    # display name, so historical content reflects the updated identity. The
    # audit trail (activity_logs.user_name) is intentionally left immutable.
    if name_changed and old_name:
        new_name = user.to_dict()["name"]
        # Primary path: rows keyed by the user's id (announcements, subjects,
        # materials and quizzes the user authored).
        AnnouncementModel.query.filter_by(teacher_id=user.user_id).update(
            {AnnouncementModel.author_name: new_name}, synchronize_session=False
        )
        SubjectModel.query.filter_by(teacher_id=user.user_id).update(
            {SubjectModel.teacher_name: new_name}, synchronize_session=False
        )
        MaterialModel.query.filter_by(teacher_id=user.user_id).update(
            {MaterialModel.uploaded_by: new_name}, synchronize_session=False
        )
        QuizModel.query.filter_by(teacher_id=user.user_id).update(
            {QuizModel.created_by_name: new_name}, synchronize_session=False
        )
        # Fallback: any content still carrying the old display name gets patched
        # too, covering rows whose author id differs or where a snapshot was
        # stored without an exact id match (e.g. student-authored notes).
        AnnouncementModel.query.filter(
            AnnouncementModel.author_name == old_name
        ).update({AnnouncementModel.author_name: new_name}, synchronize_session=False)
        SubjectModel.query.filter(
            SubjectModel.teacher_name == old_name
        ).update({SubjectModel.teacher_name: new_name}, synchronize_session=False)
        MaterialModel.query.filter(
            MaterialModel.uploaded_by == old_name
        ).update({MaterialModel.uploaded_by: new_name}, synchronize_session=False)
        QuizModel.query.filter(
            QuizModel.created_by_name == old_name
        ).update({QuizModel.created_by_name: new_name}, synchronize_session=False)
        if not _commit_or_warn("name propagation"):
            print(f"[Name Propagation] FAILED for user {user.user_id}: old='{old_name}' new='{new_name}'")

    if status_changed:
        log_action(current_user.get("id") or "usr-admin-1", current_user.get("name") or "System", "admin",
                   "USER_STATUS_CHANGED", f"Status of {user.email} changed to {user.status}")
    log_action(user.user_id, user.to_dict()["name"], user.role, "USER_UPDATED", f"Profile of {user.email} updated")
    return jsonify(user.to_dict()), 200

@app.route("/api/users/<user_id>/avatar", methods=["POST"])
@require_auth
def upload_user_avatar(user_id):
    current_user = getattr(request, "current_user", None) or {}
    is_admin = current_user.get("role") == "admin"
    is_self = current_user.get("id") == user_id
    if not (is_admin or is_self):
        return jsonify({"error": "You do not have permission to update this avatar.", "code": "FORBIDDEN"}), 403

    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No image file provided.", "code": "BAD_REQUEST"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    if ext not in allowed:
        return jsonify({"error": "Please upload a PNG, JPG, GIF, or WEBP image.", "code": "BAD_REQUEST"}), 400

    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "Image must be 5 MB or smaller.", "code": "BAD_REQUEST"}), 400

    safe_ext = ext if ext in allowed else ".png"
    filename = f"avatar_{user_id}_{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}{safe_ext}"
    avatar_url = upload_file_to_cloud(file_bytes, filename, content_type=file.mimetype or "image/png")
    user.profile_picture = avatar_url

    if not _commit_or_warn("avatar update"):
        return jsonify({"error": "Could not save the avatar. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(user.user_id, user.to_dict()["name"], user.role, "USER_UPDATED", f"Profile picture updated for {user.email}")
    return jsonify(user.to_dict()), 200

@app.route("/api/users/<user_id>", methods=["DELETE"])
@require_roles("admin")
def delete_user(user_id):
    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404
    if user.role == "admin":
        return jsonify({"error": "Administrator accounts cannot be deleted.", "code": "FORBIDDEN"}), 403
    email = user.email
    db.session.delete(user)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        db.session.remove()
        err_lower = str(e).lower()
        if any(k in err_lower for k in ("integrityerror", "foreign key constraint", "cannot delete or update a parent row")):
            return jsonify({"error": "This user still has linked records (subjects, materials, quizzes, reports) and cannot be deleted. Remove those first.", "code": "HAS_DEPENDENTS"}), 409
        return jsonify({"error": "Could not delete the user. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action("usr-admin-1", "System", "admin", "USER_DELETED", f"Deleted account {email}")
    return jsonify({"success": True}), 200

# --------------------------------------------------
# SUBJECT ROUTES
# --------------------------------------------------
@app.route("/api/subjects", methods=["GET"])
@require_auth
def get_subjects():
    current_user = getattr(request, "current_user", None) or {}
    requester_role = current_user.get("role") or ""
    requester_id = current_user.get("id") or ""

    subs = SubjectModel.query.all()

    # Privacy Rule: teachers only see the subjects they are assigned to manage.
    if requester_role == "teacher":
        subs = [s for s in subs if s.teacher_id == requester_id]

    # Privacy Rule: students only see the subjects they are enrolled in.
    if requester_role == "student" and requester_id:
        enrolled_ids = {
            en.subject_id for en in StudentSubjectModel.query.filter_by(student_id=requester_id).all()
        }
        subs = [s for s in subs if s.subject_id in enrolled_ids]

    # Live material counts: the denormalized material_count column drifts over
    # time (AI mirrors, deletes), so always compute the real number here.
    counts = dict(
        db.session.query(MaterialModel.subject_id, func.count(MaterialModel.material_id))
        .filter(MaterialModel.subject_id.isnot(None))
        .group_by(MaterialModel.subject_id)
        .all()
    )
    payload = []
    for s in subs:
        d = s.to_dict()
        if s.subject_id in counts:
            d["materialCount"] = counts[s.subject_id]
        payload.append(d)

    return jsonify(payload)

@app.route("/api/subjects", methods=["POST"])
@require_roles("admin")
def create_subject():
    data = request.json or {}
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    teacher_id = (data.get("teacherId") or "").strip()

    if not code or not name:
        return jsonify({"error": "Subject code and name are required.", "code": "BAD_REQUEST"}), 400
    if not teacher_id:
        return jsonify({"error": "Please assign a teacher to manage this subject.", "code": "BAD_REQUEST"}), 400

    teacher = db.session.get(UserModel, teacher_id)
    if not teacher:
        return jsonify({"error": "Assigned teacher account was not found.", "code": "BAD_REQUEST"}), 400
    if teacher.role != "teacher":
        return jsonify({"error": "Only a teacher account can be assigned to manage a subject.", "code": "BAD_REQUEST"}), 400

    if SubjectModel.query.filter_by(subject_code=code).first():
        return jsonify({"error": f"A subject with code '{code}' already exists.", "code": "DUPLICATE"}), 409

    new_sub = SubjectModel(
        subject_id=f"sub-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        teacher_id=teacher.user_id,
        subject_code=code,
        subject_name=name,
        description=(data.get("description") or "").strip() or None,
        semester=data.get("semester") or "1st Semester",
        course=data.get("course") or "BSIT",
        school_year=data.get("schoolYear") or "2026-2027",
        teacher_name=teacher.to_dict()["name"],
        student_count=0,
        material_count=0,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(new_sub)
    _commit_or_warn("subject creation")
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_CREATE", f"Created subject '{code} - {name}' and assigned {teacher.to_dict()['name']}")
    return jsonify(new_sub.to_dict()), 201

@app.route("/api/subjects/<subject_id>", methods=["PUT"])
@require_roles("admin")
def update_subject(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    new_code = (data.get("code") or sub.subject_code).strip()
    if data.get("code") and new_code != sub.subject_code and SubjectModel.query.filter_by(subject_code=new_code).first():
        return jsonify({"error": f"A subject with code '{new_code}' already exists.", "code": "DUPLICATE"}), 409

    sub.subject_code = new_code
    sub.subject_name = (data.get("name") or sub.subject_name).strip()
    sub.description = data.get("description") if data.get("description") is not None else sub.description
    sub.semester = data.get("semester") or sub.semester
    sub.course = data.get("course") or sub.course
    sub.school_year = data.get("schoolYear") or sub.school_year

    new_teacher_id = (data.get("teacherId") or "").strip()
    if new_teacher_id and new_teacher_id != sub.teacher_id:
        teacher = db.session.get(UserModel, new_teacher_id)
        if not teacher or teacher.role != "teacher":
            return jsonify({"error": "Only a teacher account can be assigned to manage a subject.", "code": "BAD_REQUEST"}), 400
        sub.teacher_id = teacher.user_id
        sub.teacher_name = teacher.to_dict()["name"]

    _commit_or_warn("subject update")
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_UPDATE", f"Updated subject '{sub.subject_code} - {sub.subject_name}'")
    return jsonify(sub.to_dict()), 200

@app.route("/api/subjects/<subject_id>", methods=["DELETE"])
@require_roles("admin")
def delete_subject(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    code_name = f"{sub.subject_code} - {sub.subject_name}"
    try:
        AnnouncementModel.query.filter_by(subject_id=subject_id).delete()
        StudentSubjectModel.query.filter_by(subject_id=subject_id).delete()
        db.session.delete(sub)
        _commit_or_warn("subject deletion")
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not delete this subject because it still has linked records.", "code": "CONFLICT"}), 409

    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_DELETE", f"Deleted subject '{code_name}'")
    return jsonify({"success": True}), 200

@app.route("/api/subjects/<subject_id>", methods=["GET"])
@require_auth
def get_subject(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Access rule: admins, the teacher assigned to manage this subject, or an
    # enrolled student may open the subject workspace.
    is_assigned_teacher = role == "teacher" and user_id == sub.teacher_id
    is_enrolled_student = role == "student" and StudentSubjectModel.query.filter_by(
        subject_id=subject_id, student_id=user_id
    ).first() is not None
    if role != "admin" and not is_assigned_teacher and not is_enrolled_student:
        return jsonify({"error": "You are not authorized to view this subject.", "code": "FORBIDDEN"}), 403

    return jsonify(sub.to_dict()), 200

@app.route("/api/subjects/<subject_id>/students", methods=["GET"])
@require_auth
def get_subject_students(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Access rule: admins, the teacher assigned to manage this subject, or an
    # enrolled student may view the roster (people in the subject).
    is_assigned_teacher = role == "teacher" and user_id == sub.teacher_id
    is_enrolled_student = role == "student" and StudentSubjectModel.query.filter_by(
        subject_id=subject_id, student_id=user_id
    ).first() is not None
    if role != "admin" and not is_assigned_teacher and not is_enrolled_student:
        return jsonify({"error": "You are not authorized to view this subject roster.", "code": "FORBIDDEN"}), 403

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    # Students only see peer names, never classmates' email addresses.
    include_email = role in ("admin", "teacher")
    students = []
    for en in enrollments:
        student = db.session.get(UserModel, en.student_id)
        if student:
            entry = {
                "id": student.user_id,
                "name": student.to_dict()["name"],
                "studentId": student.student_id,
                "dateEnrolled": en.date_enrolled
            }
            if include_email:
                entry["email"] = student.email
            students.append(entry)
    students.sort(key=lambda s: s["name"].lower())
    return jsonify(students), 200

@app.route("/api/subjects/<subject_id>/students", methods=["POST"])
@require_roles("admin")
def assign_subject_students(subject_id):
    """Assign (enroll) one or more students to a subject. Admin-only, like teacher assignment."""
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    student_ids = data.get("studentIds") or []
    if not isinstance(student_ids, list) or not student_ids:
        return jsonify({"error": "Please provide at least one studentId to assign.", "code": "BAD_REQUEST"}), 400

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    existing = {
        en.student_id for en in StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    }
    added = 0
    for sid in student_ids:
        student = db.session.get(UserModel, sid)
        if not student or student.role != "student":
            continue
        if sid in existing:
            continue
        db.session.add(StudentSubjectModel(
            student_id=sid,
            subject_id=subject_id,
            date_enrolled=now_str
        ))
        existing.add(sid)
        added += 1

    if not _commit_or_warn("assign students to subject"):
        return jsonify({"error": "Could not save the enrollment. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_ENROLL",
               f"Assigned {added} student(s) to '{sub.subject_code} - {sub.subject_name}'")

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    students = []
    for en in enrollments:
        student = db.session.get(UserModel, en.student_id)
        if student:
            students.append({
                "id": student.user_id,
                "name": student.to_dict()["name"],
                "email": student.email,
                "studentId": student.student_id,
                "dateEnrolled": en.date_enrolled
            })
    students.sort(key=lambda s: s["name"].lower())
    return jsonify({"students": students, "added": added}), 201

@app.route("/api/subjects/<subject_id>/students", methods=["DELETE"])
@require_roles("admin")
def unassign_subject_students(subject_id):
    """Unassign (unenroll) one or more students from a subject. Admin-only."""
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    student_ids = data.get("studentIds") or []
    if not isinstance(student_ids, list) or not student_ids:
        return jsonify({"error": "Please provide at least one studentId to unassign.", "code": "BAD_REQUEST"}), 400

    removed = 0
    for sid in student_ids:
        en = StudentSubjectModel.query.filter_by(subject_id=subject_id, student_id=sid).first()
        if en:
            db.session.delete(en)
            removed += 1

    if not _commit_or_warn("unassign students from subject"):
        return jsonify({"error": "Could not save the removal. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_UNENROLL",
               f"Removed {removed} student(s) from '{sub.subject_code} - {sub.subject_name}'")

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    students = []
    for en in enrollments:
        student = db.session.get(UserModel, en.student_id)
        if student:
            students.append({
                "id": student.user_id,
                "name": student.to_dict()["name"],
                "email": student.email,
                "studentId": student.student_id,
                "dateEnrolled": en.date_enrolled
            })
    students.sort(key=lambda s: s["name"].lower())
    return jsonify({"students": students, "removed": removed}), 200

def _missing_attempt_entries(subject_id, student_id, student_name, own_dicts):
    """Synthetic 0% 'Missing' grade rows for published course quizzes whose
    deadline has passed without any attempt by the given student."""
    attempted = {a.get("quizId") for a in own_dicts}
    quizzes = (QuizModel.query
               .filter_by(subject_id=subject_id, quiz_type="teacher", is_published=True)
               .all())
    out = []
    for qz in quizzes:
        if not qz.deadline or qz.quiz_id in attempted:
            continue
        try:
            dl = str(qz.deadline).replace("Z", "+00:00")
            dl_dt = datetime.datetime.fromisoformat(dl)
            now_dt = datetime.datetime.now(dl_dt.tzinfo) if dl_dt.tzinfo else datetime.datetime.now(datetime.timezone.utc)
            if now_dt <= dl_dt:
                continue
        except ValueError:
            continue
        try:
            qs = json.loads(qz.questions_json) if qz.questions_json else []
        except Exception:
            qs = []
        max_score = 0
        for qq in qs:
            try:
                max_score += int(qq.get("points") or qq.get("maxPoints") or 1)
            except Exception:
                max_score += 1
        total = max_score or len(qs) or 1
        out.append({
            "id": f"missing-{qz.quiz_id}-{student_id}",
            "quizId": qz.quiz_id,
            "quizTitle": qz.title,
            "studentId": student_id,
            "studentName": student_name,
            "subjectId": subject_id,
            "subjectName": qz.subject_name,
            "score": 0,
            "maxScore": total,
            "totalPoints": total,
            "percentage": 0,
            "passed": False,
            "timeTaken": 0,
            "answers": [],
            "feedback": [],
            "weakTopics": [],
            "strongTopics": [],
            "submittedAt": str(qz.deadline),
            "completedAt": str(qz.deadline),
            "status": "Missing"
        })
    return out


@app.route("/api/subjects/<subject_id>/grades", methods=["GET"])
@require_auth
def get_subject_grades(subject_id):
    """Quiz grades for a subject.

    - Students see their own quiz attempts + computed final grade (average %).
    - Teachers/admins see a per-student breakdown for the subject roster.
    """
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    is_assigned_teacher = role == "teacher" and user_id == sub.teacher_id
    is_enrolled_student = role == "student" and StudentSubjectModel.query.filter_by(
        subject_id=subject_id, student_id=user_id
    ).first() is not None
    if role != "admin" and not is_assigned_teacher and not is_enrolled_student:
        return jsonify({"error": "You are not authorized to view grades for this subject.", "code": "FORBIDDEN"}), 403

    attempts = (QuizAttemptModel.query
                .filter_by(subject_id=subject_id)
                .order_by(QuizAttemptModel.submitted_at.desc())
                .all())

    base = {"subjectId": subject_id, "subjectName": sub.subject_name}

    if role == "admin" or is_assigned_teacher:
        roster = []
        for en in StudentSubjectModel.query.filter_by(subject_id=subject_id).all():
            student = db.session.get(UserModel, en.student_id)
            if not student:
                continue
            own = [a.to_dict() for a in attempts if a.student_id == student.user_id]
            display = sorted(
                own + _missing_attempt_entries(subject_id, student.user_id, student.to_dict()["name"], own),
                key=lambda a: str(a.get("submittedAt") or ""),
                reverse=True,
            )
            roster.append({
                "studentId": student.user_id,
                "studentName": student.to_dict()["name"],
                "attemptCount": len(own),
                "averagePercentage": (
                    round(sum(_latest_attempt_percentages(own)) / len(latest_pcts))
                    if (latest_pcts := _latest_attempt_percentages(own))
                    else 0
                ),
                "attempts": display,
            })
        roster.sort(key=lambda r: r["studentName"].lower())
        base["students"] = roster
    else:
        own = [a.to_dict() for a in attempts if a.student_id == user_id]
        display = sorted(
            own + _missing_attempt_entries(subject_id, user_id, current_user.get("name", "Student"), own),
            key=lambda a: str(a.get("submittedAt") or ""),
            reverse=True,
        )
        latest_pcts = _latest_attempt_percentages(own)
        base["studentId"] = user_id
        base["studentName"] = current_user.get("name", "Student")
        base["attemptCount"] = len(own)
        base["averagePercentage"] = round(sum(latest_pcts) / len(latest_pcts)) if latest_pcts else 0
        base["attempts"] = display

    return jsonify(base), 200

# --------------------------------------------------
# MATERIAL ROUTES
# --------------------------------------------------
@app.route("/api/materials", methods=["GET"])
@require_auth
def get_materials():
    current_user = getattr(request, "current_user", None) or {}
    requester_role = current_user.get("role") or ""
    requester_id = current_user.get("id") or ""

    # Newest first so a freshly saved resource is on page 1 of the client-side
    # paginated grid. uploaded_at is an ISO-8601 string, so lexical order is
    # chronological. Without this the grid renders primary-key order (oldest
    # first) and new saves appear to "vanish" onto the last page.
    mats = MaterialModel.query.order_by(MaterialModel.uploaded_at.desc()).all()

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

    return jsonify([m.to_dict() for m in mats])

@app.route("/api/materials/extract", methods=["POST"])
@require_auth
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

@app.route("/api/materials/upload", methods=["POST"])
@require_auth
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
    subject_id = request.form.get("subjectId", "sub-101")
    material_type = request.form.get("materialType", "course")
    text_input = request.form.get("textInput", "").strip()

    if file_bytes is None and not text_input:
        return jsonify({"error": "No file or text content provided"}), 400

    sub = db.session.get(SubjectModel, subject_id) if subject_id else None

    # Ownership rule: a teacher may only upload course material to a subject they
    # are assigned to manage. Admins may upload anywhere. Personal notes bypass subjects.
    # A blank subject_id means a subjectless draft awaiting assignment (AI saves).
    if uploader_role == "teacher" and subject_id not in ("", "personal"):
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
        material_id=f"mat-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
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
    db.session.commit()

    log_action(uploader_id, uploaded_by, uploader_role, "MATERIAL_UPLOAD", f"Uploaded '{title}' ({file_ext}) to Cloud Storage")
    return jsonify(new_mat.to_dict()), 201

def _render_ai_resource_text(resource_type, payload):
    """Builds a plain-text rendering of an AI resource for the learning materials library."""
    lines = []
    if resource_type == "summary":
        if payload.get("executiveSummary"):
            lines.append(str(payload["executiveSummary"]))
        for takeaway in payload.get("keyTakeaways") or []:
            if isinstance(takeaway, dict):
                lines.append(f"- Key Takeaway: {takeaway.get('text') or takeaway.get('title') or ''}")
            else:
                lines.append(f"- Key Takeaway: {takeaway}")
        for bullet in payload.get("bulletPoints") or []:
            lines.append(f"- {bullet}")
    elif resource_type == "reviewer":
        if payload.get("overview"):
            lines.append(str(payload["overview"]))
        for topic in payload.get("topics") or []:
            if isinstance(topic, dict):
                lines.append(f"\nTopic: {topic.get('topic') or topic.get('title') or ''}")
                if topic.get("overview"):
                    lines.append(str(topic["overview"]))
                for c in topic.get("keyConcepts") or topic.get("concepts") or []:
                    if isinstance(c, dict):
                        lines.append(f"  - {c.get('text') or c.get('concept') or c.get('title') or ''}")
                    else:
                        lines.append(f"  - {c}")
            else:
                lines.append(str(topic))
    elif resource_type == "flashcards":
        for i, card in enumerate(payload.get("cards") or [], 1):
            if isinstance(card, dict):
                q = card.get("question") or card.get("front") or ""
                a = card.get("answer") or card.get("back") or ""
                lines.append(f"Card {i}: Q: {q}\n  A: {a}")
            else:
                lines.append(str(card))
    elif resource_type == "quiz":
        for i, q in enumerate(payload.get("questions") or [], 1):
            if not isinstance(q, dict):
                continue
            lines.append(f"Q{i}: {q.get('question') or ''}")
            options = q.get("options") or []
            for oi, opt in enumerate(options):
                lines.append(f"  {chr(65 + oi)}. {opt}")
            ca = q.get("correctAnswer")
            if isinstance(ca, int) and 0 <= ca < len(options):
                lines.append(f"  Correct Answer: {chr(65 + ca)}")
            elif isinstance(ca, str) and ca in "ABCD":
                lines.append(f"  Correct Answer: {ca}")
    return "\n".join(lines)

@app.route("/api/materials/from-ai", methods=["POST"])
@require_auth
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
        material_id=f"mat-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
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
        return jsonify({"error": "Could not save the material. The database write failed. Please try again.", "code": "SAVE_FAILED", "reason": _LAST_COMMIT_ERROR}), 500

    log_action(user_id, new_mat.uploaded_by, new_mat.uploader_role, "MATERIAL_AI_SAVE", f"Saved AI {resource_type} '{title}' as a learning material")
    return jsonify(new_mat.to_dict()), 201

@app.route("/api/materials/<material_id>", methods=["PUT"])
@require_auth
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

@app.route("/api/materials/<material_id>", methods=["DELETE"])
@require_auth
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

# --------------------------------------------------
# MATERIAL CONTENT REVIEW (ADMIN FLAGS TEACHER UPLOADS)
# --------------------------------------------------
MATERIAL_FLAG_CATEGORIES = ("Wrong file", "Wrong subject", "Incomplete content", "Other")

def _resolve_material_flags(material_id, resolved_by, resolution_note=None, actor_role="teacher"):
    """Flips every pending flag on a material to resolved and notifies the admin(s)
    who raised them. Called by the explicit resolve endpoint and automatically after
    a material edit/delete fixes the underlying issue."""
    flags = MaterialFlagModel.query.filter_by(material_id=material_id, status="pending").all()
    if not flags:
        return flags
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    mat = None
    try:
        mat = db.session.get(MaterialModel, material_id)
    except Exception:
        pass
    mat_title = mat.title if mat else "(deleted material)"
    for flag in flags:
        flag.status = "resolved"
        flag.resolved_at = server_now
        flag.resolved_by = resolved_by
        if resolution_note:
            flag.resolution_note = resolution_note
        _create_notification(
            flag.flagged_by,
            f"Flag resolved on '{mat_title}'",
            f"The teacher addressed the '{flag.category}' flag."
            + (f" Note: {resolution_note}" if resolution_note else ""),
            target=f"material:{material_id}",
        )
        log_action(resolved_by, None, actor_role, "MATERIAL_FLAG_RESOLVED",
                   f"Resolved '{flag.category}' flag on '{mat_title}'")
    _commit_or_warn("material flag resolution")
    return flags

@app.route("/api/materials/<material_id>/flag", methods=["POST"])
@require_roles("admin")
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
        flag_id=f"flag-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
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

@app.route("/api/material-flags", methods=["GET"])
@require_auth
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

@app.route("/api/material-flags/<flag_id>/resolve", methods=["POST"])
@require_roles("admin", "teacher")
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

# --------------------------------------------------
# AI ASSESSMENT GENERATION (GROQ GPT-OSS-120B)
# --------------------------------------------------
@app.route("/api/quizzes/generate", methods=["POST"])
@require_auth
def generate_quiz_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    auth_id = current_user.get("id") or ""
    auth_name = current_user.get("name") or "User"
    auth_role = current_user.get("role") or "student"

    # Attribution is taken from the verified session so a caller can never author
    # a quiz under another identity (content-forgery hardening). Students can only
    # create private personal-practice quizzes, never published course quizzes, so
    # an explicit teacher-type request from a student is rejected outright.
    data["createdById"] = auth_id or "usr-teacher-1"
    data["createdByName"] = auth_name
    if auth_role == "student":
        if data.get("quizType", "teacher") == "teacher":
            return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
        data["quizType"] = "student"

    quiz_type = data.get("quizType", "teacher")
    subject_id = data.get("subjectId", "sub-101")
    # Teachers may only create course quizzes for subjects they manage.
    if auth_role == "teacher" and quiz_type == "teacher" and subject_id not in ("", "personal"):
        sub_q = db.session.get(SubjectModel, subject_id)
        if not sub_q or sub_q.teacher_id != auth_id:
            return jsonify({"error": "You can only create quizzes for a subject assigned to you.", "code": "FORBIDDEN"}), 403

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    text_content = data.get("textContent", "Graph traversal BFS and DFS algorithms.")
    num_questions = _clamp_count(data.get("numQuestions", 5), fallback=5, maximum=MAX_AI_QUESTIONS)
    difficulty = data.get("difficulty", "medium")
    
    questions = generate_quiz_with_groq(text_content, num_questions=num_questions, difficulty=difficulty)
    
    new_quiz = QuizModel(
        quiz_id=f"quiz-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        title=data.get("title", f"AI Quiz: {text_content[:30]}..."),
        description="",
        subject_id=data.get("subjectId", "sub-101"),
        subject_name=data.get("subjectName", "Data Structures & Algorithms"),
        material_id=data.get("materialId"),
        teacher_id=data.get("createdById", "usr-teacher-1"),
        created_by_name=data.get("createdByName", "Christian C. Barral, MIT"),
        quiz_type=data.get("quizType", "teacher"),
        questions_json=json.dumps(questions),
        is_published=bool(data.get("subjectId", "sub-101")),
        time_limit_minutes=15,
        pass_percentage=70,
        difficulty=difficulty,
        attempts_allowed=_clamp_attempts(data.get("attemptsAllowed")),
        reveal_answers=_reveal_answers(data.get("revealAnswers")),
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(new_quiz)
    if not _commit_or_warn("AI quiz"):
        return jsonify({"error": "Could not save the quiz. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    
    log_action(new_quiz.teacher_id, new_quiz.created_by_name, new_quiz.quiz_type, "AI_QUIZ_GENERATE", f"Generated {len(questions)} items via Groq GPT-OSS-120B")

    return jsonify(new_quiz.to_dict()), 201

@app.route("/api/flashcards/generate", methods=["POST"])
@require_auth
def generate_flashcards_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    text_content = data.get("textContent", "Key concepts of data structures.")
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    card_count = _clamp_count(data.get("cardCount", 5), fallback=5, maximum=MAX_AI_FLASHCARDS)
    cards = generate_flashcards_with_groq(text_content, count=card_count)

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_deck = AIGeneratedContentModel(
        content_id=f"deck-{timestamp_ms}",
        material_id=data.get("materialId"),
        generated_by=author_id,
        title=data.get("title", f"Flashcards: {text_content[:25]}..."),
        content_type="Flashcard",
        generated_text=json.dumps({
            "title": data.get("title", f"Flashcards: {text_content[:25]}..."),
            "subjectId": data.get("subjectId", "sub-101"),
            "subjectName": data.get("subjectName", "Data Structures"),
            "materialId": data.get("materialId"),
            "cards": cards,
            "isPublished": True,
            "createdById": author_id,
            "createdAt": created_at,
        }),
        created_at=created_at
    )
    db.session.add(new_deck)
    if not _commit_or_warn("AI flashcard deck"):
        return jsonify({"error": "Could not save the flashcard deck. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    return jsonify(_ai_content_to_dict(new_deck)), 201

@app.route("/api/summaries/generate", methods=["POST"])
@require_auth
def generate_summary_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    author_name = data.get("createdByName") if current_user.get("role") == "admin" else (current_user.get("name") or "")
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    text_content = data.get("textContent", "Lecture material summary.")
    summary_data = generate_summary_with_groq(text_content)

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_sum = AIGeneratedContentModel(
        content_id=f"sum-{timestamp_ms}",
        material_id=data.get("materialId"),
        generated_by=author_id,
        title=data.get("title", f"Summary: {text_content[:30]}..."),
        content_type="Summary",
        generated_text=json.dumps({
            "title": data.get("title", f"Summary: {text_content[:30]}..."),
            "subjectId": data.get("subjectId", "sub-101"),
            "subjectName": data.get("subjectName", "CS 301"),
            "materialId": data.get("materialId"),
            "executiveSummary": summary_data.get("executiveSummary", ""),
            "keyTakeaways": summary_data.get("keyTakeaways", []),
            "bulletPoints": summary_data.get("bulletPoints", []),
            "createdById": author_id,
            "createdByName": author_name,
            "createdAt": created_at,
        }),
        created_at=created_at
    )
    db.session.add(new_sum)
    if not _commit_or_warn("AI summary"):
        return jsonify({"error": "Could not save the summary. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    return jsonify(_ai_content_to_dict(new_sum)), 201

@app.route("/api/reviewers/generate", methods=["POST"])
@require_auth
def generate_reviewer_ai():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    author_name = data.get("createdByName") if current_user.get("role") == "admin" else (current_user.get("name") or "")
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    text_content = data.get("textContent", "Study material reviewer.")
    reviewer = generate_reviewer_with_groq(text_content)

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_rev = AIGeneratedContentModel(
        content_id=f"rev-{timestamp_ms}",
        material_id=data.get("materialId"),
        generated_by=author_id,
        title=data.get("title", f"Reviewer: {text_content[:30]}..."),
        content_type="Reviewer",
        generated_text=json.dumps({
            "title": data.get("title", f"Reviewer: {text_content[:30]}..."),
            "subjectId": data.get("subjectId", "sub-101"),
            "subjectName": data.get("subjectName", "General Subject"),
            "materialId": data.get("materialId"),
            "overview": reviewer.get("overview", ""),
            "topics": reviewer.get("topics", []),
            "createdById": author_id,
            "createdByName": author_name,
            "createdAt": created_at,
        }),
        created_at=created_at
    )
    db.session.add(new_rev)
    if not _commit_or_warn("AI reviewer"):
        return jsonify({"error": "Could not save the reviewer. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(new_rev.generated_by, author_name or "User", current_user.get("role") or "teacher", "AI_REVIEWER_GENERATE", f"Generated a {len(reviewer.get('topics', []))}-topic study reviewer via Groq GPT-OSS-120B")
    return jsonify(_ai_content_to_dict(new_rev)), 201

def _build_generated_resource(mode, data, text_content, timestamp_ms, created_at):
    """Generates AI content and returns it as a dict (shaped like the model to_dict).

    Used both for preview (save=False) and as the payload for /api/ai/save.
    """
    subject_id = data.get("subjectId") or ""
    subject_name = data.get("subjectName") or ""
    created_by_id = data.get("createdById") or "usr-teacher-1"
    created_by_name = data.get("createdByName") or "User"
    material_id = data.get("materialId")
    difficulty = data.get("difficulty", "medium")
    instructions = data.get("instructions") or ""

    if mode == "quiz":
        num_questions = _clamp_count(data.get("quizCount") or data.get("numQuestions") or 5, fallback=5, maximum=MAX_AI_QUESTIONS)
        # The quiz count box was removed from the UI: the prompt is the single source of
        # truth for how many questions to make. Callers that still send an explicit count
        # (legacy /api/quizzes/generate) keep the old default behavior.
        explicit_count = "quizCount" in data or "numQuestions" in data
        questions = generate_quiz_with_groq(
            text_content, num_questions=num_questions, difficulty=difficulty, instructions=instructions,
            require_count=not explicit_count,
        )
        ai_title = generate_title_with_groq("quiz", questions)
        quiz_title = data.get("title") or ai_title or f"AI Quiz: {_trim_preview(text_content)}..."
        title_exists = QuizModel.query.filter(
            QuizModel.title == quiz_title,
            QuizModel.teacher_id == created_by_id,
        ).first() is not None
        return {
            "id": f"quiz-{timestamp_ms}",
            "title": quiz_title,
            "description": "",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "quizType": data.get("quizType") or ("teacher" if data.get("userRole") == "teacher" else "student"),
            "questions": questions,
            "isPublished": (data.get("quizType") or ("teacher" if data.get("userRole") == "teacher" else "student")) == "student" or bool(subject_id),
            "timeLimitMinutes": 15,
            "passPercentage": 70,
            "difficulty": difficulty,
            "createdAt": created_at,
            "titleExists": title_exists
        }
    if mode == "flashcards":
        card_count = _clamp_count(data.get("flashcardCount") or data.get("cardCount") or 5, fallback=5, maximum=MAX_AI_FLASHCARDS)
        cards = generate_flashcards_with_groq(text_content, count=card_count, instructions=instructions)
        ai_title = generate_title_with_groq("flashcards", cards)
        return {
            "id": f"deck-{timestamp_ms}",
            "title": data.get("title") or ai_title or f"Flashcards: {_trim_preview(text_content, 25)}...",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "cards": cards,
            "isPublished": True,
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "createdAt": created_at
        }
    if mode == "summary":
        summary_data = generate_summary_with_groq(text_content, instructions=instructions)
        ai_title = generate_title_with_groq("summary", summary_data)
        return {
            "id": f"sum-{timestamp_ms}",
            "title": data.get("title") or ai_title or f"Summary: {_trim_preview(text_content)}...",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "executiveSummary": summary_data.get("executiveSummary", ""),
            "keyTakeaways": summary_data.get("keyTakeaways", []),
            "bulletPoints": summary_data.get("bulletPoints", []),
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "createdAt": created_at
        }
    if mode == "reviewer":
        reviewer = generate_reviewer_with_groq(text_content, instructions=instructions)
        ai_title = generate_title_with_groq("reviewer", reviewer)
        return {
            "id": f"rev-{timestamp_ms}",
            "title": data.get("title") or ai_title or f"Reviewer: {_trim_preview(text_content)}...",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "overview": reviewer.get("overview", ""),
            "topics": reviewer.get("topics", []),
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "createdAt": created_at
        }
    return None


def _trim_preview(text, max_len=30):
    text = (text or "").strip()
    return text if len(text) <= max_len else text[:max_len].rstrip() + "..."


def _ai_content_to_dict(entry):
    """Reconstructs the frontend/mobile resource shape from an ai_generated_content row.

    The full payload (including cards / summary fields / reviewer topics and subject
    metadata) was stored as JSON in generated_text, so responses stay byte-compatible
    with the previous flashcard_decks / summaries / reviewers tables.
    """
    try:
        payload = json.loads(entry.generated_text) or {}
    except Exception:
        payload = {}
    base = {
        "id": entry.content_id,
        "title": entry.title,
        "subjectId": payload.get("subjectId") or "",
        "subjectName": payload.get("subjectName") or "",
        "materialId": payload.get("materialId"),
        "createdById": entry.generated_by,
        "createdAt": entry.created_at,
    }
    if entry.content_type == "Flashcard":
        return {
            **base,
            "cards": payload.get("cards", []),
            "isPublished": bool(payload.get("isPublished", True)),
        }
    if entry.content_type == "Summary":
        return {
            **base,
            "executiveSummary": payload.get("executiveSummary", ""),
            "keyTakeaways": payload.get("keyTakeaways", []),
            "bulletPoints": payload.get("bulletPoints", []),
        }
    if entry.content_type == "Reviewer":
        return {
            **base,
            "overview": payload.get("overview", ""),
            "topics": payload.get("topics", []),
        }
    return base


def _build_quiz_model(payload, data, timestamp_ms, saved_at):
    """Constructs (but does not add) a QuizModel from a generated resource dict."""
    quiz_type = payload.get("quizType") or "student"
    effective_subject = payload.get("subjectId") or ("" if quiz_type == "teacher" else "personal")
    return QuizModel(
        quiz_id=payload.get("id") or f"quiz-{timestamp_ms}",
        title=payload.get("title", "AI Quiz"),
        description=payload.get("description", ""),
        # Teacher quizzes without a subject are subjectless drafts (""), hidden from
        # students until assigned. Student quizzes default to personal practice.
        subject_id=effective_subject,
        subject_name=payload.get("subjectName") or ("" if quiz_type == "teacher" else "Personal Practice"),
        material_id=payload.get("materialId"),
        teacher_id=payload.get("createdById") or "usr-teacher-1",
        created_by_name=payload.get("createdByName") or data.get("createdByName") or "User",
        quiz_type=quiz_type,
        questions_json=json.dumps(payload.get("questions", [])),
        is_published=bool(payload.get("isPublished", bool(effective_subject))),
        time_limit_minutes=int(payload.get("timeLimitMinutes") or 15),
        pass_percentage=int(payload.get("passPercentage") or 70),
        difficulty=payload.get("difficulty", "medium"),
        attempts_allowed=_clamp_attempts(payload.get("attemptsAllowed")),
        reveal_answers=_reveal_answers(payload.get("revealAnswers")),
        created_at=payload.get("createdAt") or saved_at,
    )


def _build_ai_content_model(payload, timestamp_ms, saved_at, content_type):
    """Constructs (but does not add) an AIGeneratedContentModel from a generated dict."""
    payload_persisted = dict(payload)
    payload_persisted.setdefault("isPublished", True)
    payload_persisted["createdById"] = payload.get("createdById") or "usr-teacher-1"
    return AIGeneratedContentModel(
        content_id=payload.get("id") or f"ai-{content_type.lower()}-{timestamp_ms}",
        material_id=payload.get("materialId"),
        generated_by=payload.get("createdById") or "usr-teacher-1",
        title=payload.get("title", content_type),
        content_type=content_type,
        generated_text=json.dumps(payload_persisted),
        created_at=payload.get("createdAt") or saved_at,
    )


def _persist_generated_resource(mode, payload, data, timestamp_ms, created_at):
    """Persists a generated AI resource dict (idempotent). Returns the saved model or None.

    Quizzes are stored in the quizzes + quiz_questions tables; flashcards, summaries,
    and reviewers are stored in the single ai_generated_content table (content_type),
    matching the manuscript ERD.
    """
    resource_id = payload.get("id")
    saved_at = payload.get("createdAt") or created_at

    if mode == "quiz":
        existing = db.session.get(QuizModel, resource_id) if resource_id else None
        if existing:
            return existing

        def _stage_quiz():
            model = _build_quiz_model(payload, data, timestamp_ms, saved_at)
            db.session.add(model)
            _replace_quiz_questions(model.quiz_id, payload.get("questions", []))
            return model

        new_model = _stage_quiz()
        if not _commit_or_warn("AI quiz save", restage=lambda: _stage_quiz()):
            return None
        return new_model

    content_type_map = {"flashcards": "Flashcard", "summary": "Summary", "reviewer": "Reviewer"}
    content_type = content_type_map.get(mode)
    if content_type is None:
        return None

    existing = db.session.get(AIGeneratedContentModel, resource_id) if resource_id else None
    if existing:
        return existing

    user_role = data.get("userRole") or "student"
    created_by_id = payload.get("createdById") or "usr-teacher-1"
    current_user = getattr(request, "current_user", None) or {}
    created_by_name = (current_user or {}).get("name") or data.get("createdByName") or payload.get("createdByName") or "User"

    def _stage_content():
        model = _build_ai_content_model(payload, timestamp_ms, saved_at, content_type)
        db.session.add(model)
        # Course material mirror: summaries, reviewers, and flashcards are saved
        # straight into the Upload & Manage Materials library (subjectless for
        # teachers; assigned there later). Quizzes never become materials, and a
        # TEACHER's or STUDENT's flashcards live in the Flashcards feature only —
        # they are NOT mirrored into Learning Materials. Admins have no Flashcards
        # feature, so their flashcards still mirror into Materials.
        if mode == "flashcards" and user_role in ("teacher", "student"):
            return model
        title = (payload.get("title") or "").strip() or f"AI {content_type}"
        db.session.add(MaterialModel(
            material_id=f"mat-{timestamp_ms}",
            # subject_id is a real FK to subjects.subject_id, so it must be NULL
            # (unassigned) rather than ""/"personal" -- those are not subject ids
            # and MySQL rejects the insert. Matches upload_material and
            # /api/materials/from-ai, which both normalise the same way.
            subject_id=None,
            teacher_id=created_by_id,
            title=title,
            description=f"AI-generated {content_type.lower()} saved from the StudyLens Resource Creator.",
            file_url=None,
            file_type=f"ai-{mode}",
            file_size="—",
            extracted_text=_render_ai_resource_text(mode, payload) or title,
            uploaded_at=created_at,
            material_type="personal" if user_role == "student" else "course",
            uploaded_by=created_by_name,
            uploader_role=user_role or "teacher",
        ))
        return model

    new_model = _stage_content()
    if not _commit_or_warn(f"AI {mode} save", restage=lambda: _stage_content()):
        return None
    return new_model


def _can_access_saved_resource(item, mode, current_user):
    """Whether the caller may read/return an already-saved AI resource.

    A client-supplied resource id must never let a user fetch a quiz or AI
    resource they don't own (or, for teachers, manage through a subject).
    """
    role = (current_user or {}).get("role", "")
    auth_id = (current_user or {}).get("id", "")
    if role == "admin":
        return True
    if mode == "quiz":
        if item.teacher_id == auth_id:
            return True
        if role == "teacher" and item.subject_id and item.subject_id != "personal":
            subject = db.session.get(SubjectModel, item.subject_id)
            return bool(subject and subject.teacher_id == auth_id)
        return False
    if item.generated_by == auth_id:
        return True
    if role == "teacher":
        try:
            payload = json.loads(item.generated_text) or {}
        except Exception:
            payload = {}
        subject_id = payload.get("subjectId") or ""
        if subject_id and subject_id != "personal":
            subject = db.session.get(SubjectModel, subject_id)
            return bool(subject and subject.teacher_id == auth_id)
        return False
    return False


@app.route("/api/ai/generate", methods=["POST"])
@require_auth
def generate_ai_resource():
    """Unified generation endpoint used by the web AI Study Assistant.

    When `save` is false (default for the web generator) no record is persisted;
    the user previews the result and decides to save it later via /api/ai/save.
    Every generation is still written to the activity audit log (AI_*_GENERATE).
    """
    data = request.json or {}
    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    mode = data.get("mode", "quiz")
    text_content = data.get("text", "") or data.get("textContent", "")

    if not text_content or not text_content.strip():
        return jsonify({"error": "No source text provided.", "code": "EMPTY_TEXT"}), 400

    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    reset_generation_source()
    try:
        payload = _build_generated_resource(mode, data, text_content, timestamp_ms, created_at)
    except GroqAPIError as e:
        # Structured generation errors (e.g. COUNT_REQUIRED when the prompt names no
        # count) become friendly 400s instead of a generic 500.
        return jsonify({"error": e.message, "code": e.code}), 400
    if payload is None:
        return jsonify({"error": f"Unknown generation mode: {mode}", "code": "INVALID_MODE"}), 400
    offline_reason = generation_used_fallback()
    if offline_reason:
        # The cloud AI provider was unavailable/billing-gated; these results came from
        # content-derived offline generation. Surface it so the UI can show a notice.
        payload["source"] = "offline-fallback"
        payload["offlineReason"] = offline_reason

# Attribution: the verified session is authoritative. Client-sent identity
    # fields (createdById/createdByName/userRole) can be spoofed, so the checks
    # below key off the token and the stored payload always uses the token's
    # identity (admins may still author a resource for another user).
    current_user = getattr(request, "current_user", None) or {}
    auth_id = current_user.get("id") or ""
    auth_name = current_user.get("name") or ""
    auth_role = current_user.get("role") or "student"
    payload["createdById"] = auth_id or payload.get("createdById") or "usr-teacher-1"
    payload["createdByName"] = auth_name or payload.get("createdByName") or "User"
    action_map = {
        "quiz": ("AI_QUIZ_GENERATE", f"Generated {len(payload.get('questions', []))} items via Groq GPT-OSS-120B"),
        "flashcards": ("AI_FLASHCARDS_GENERATE", f"Generated {len(payload.get('cards', []))} cards via Groq GPT-OSS-120B"),
        "summary": ("AI_SUMMARY_GENERATE", "Generated executive summary via Groq GPT-OSS-120B"),
        "reviewer": ("AI_REVIEWER_GENERATE", f"Generated a {len(payload.get('topics', []))}-topic study reviewer via Groq GPT-OSS-120B"),
    }
    action, detail = action_map.get(mode, ("AI_RESOURCE_GENERATE", "Generated an AI study resource"))
    log_action(payload["createdById"], payload["createdByName"], auth_role, action, detail)

    save = bool(data.get("save", True))
    if not save:
        # Return the generated resource as a draft WITHOUT persisting it.
        return jsonify({"saved": False, **payload}), 200

    # Quiz ownership rule: teacher quizzes may only target a subject the creator
    # manages (or stay subjectless). Admins may target any subject. Students cannot
    # create course quizzes at all.
    if mode == "quiz":
        if auth_role == "student":
            payload["quizType"] = "student"
        quiz_type = payload.get("quizType") or "student"
        user_role = auth_role
        subject_id = payload.get("subjectId") or ""
        if quiz_type == "teacher" and user_role not in ("teacher", "admin"):
            return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
        if quiz_type == "teacher" and user_role == "teacher" and subject_id not in ("", "personal"):
            subject = db.session.get(SubjectModel, subject_id)
            if not subject or subject.teacher_id != payload.get("createdById"):
                return jsonify({"error": "You can only save quizzes to a subject assigned to you.", "code": "FORBIDDEN"}), 403

    saved = _persist_generated_resource(mode, payload, data, timestamp_ms, created_at)
    if saved is None:
        return jsonify({"error": "Could not save the generated resource. The database write failed. Please try again.", "code": "SAVE_FAILED", "reason": _LAST_COMMIT_ERROR}), 500

    current_user = getattr(request, "current_user", None) or {}
    if not _can_access_saved_resource(saved, mode, current_user):
        return jsonify({"error": "You can only save generated resources you own or manage.", "code": "FORBIDDEN"}), 403

    if isinstance(saved, AIGeneratedContentModel):
        return jsonify(_ai_content_to_dict(saved)), 201
    return jsonify(saved.to_dict()), 201


@app.route("/api/ai/export/pdf", methods=["POST"])
@require_auth
def export_ai_pdf():
    """Builds a formatted PDF for a generated summary or reviewer and returns it as a file.

    Body: {"mode": "reviewer" | "summary", "title": str, "subjectName": str, "data": {...}}
    PDFs are generated server-side with ReportLab (already a project dependency) so both the
    web app and the mobile app can download the same nicely formatted document.
    """
    import re

    data = request.json or {}
    mode = data.get("mode", "")
    if mode not in ("summary", "reviewer", "quiz", "flashcards"):
        return jsonify({"error": "Unsupported export mode.", "code": "INVALID_MODE"}), 400

    payload = data.get("data") or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Missing resource data.", "code": "EMPTY_DATA"}), 400

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, ListFlowable, ListItem, HRFlowable,
        )
    except Exception:
        return jsonify({"error": "PDF library (reportlab) is not installed.", "code": "PDF_UNAVAILABLE"}), 500

    title = str(data.get("title") or payload.get("title") or "StudyLens AI Resource")
    subject_name = str(data.get("subjectName") or payload.get("subjectName") or "")

    def sanitize(text):
        """Reduces text to ASCII so the standard PDF fonts never render missing-glyph squares."""
        s = str(text or "")
        replacements = {
            "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
            "\u2013": "-", "\u2014": "-", "\u2022": "-", "\u00b7": "-",
            "\u2026": "...", "\u00a0": " ", "\ufeff": "",
        }
        for k, v in replacements.items():
            s = s.replace(k, v)
        return "".join(ch for ch in s if ch in "\t\n\r" or 32 <= ord(ch) <= 126)

    title = sanitize(title)
    subject_name = sanitize(subject_name)

    styles = getSampleStyleSheet()
    heading = ParagraphStyle("StudyHeading", parent=styles["Title"], fontSize=18, leading=22, spaceAfter=6)
    subtitle = ParagraphStyle("StudySubtitle", parent=styles["Normal"], fontSize=10, leading=14, alignment=TA_CENTER, textColor="#475569", spaceAfter=4)
    section = ParagraphStyle("StudySection", parent=styles["Heading2"], fontSize=13, leading=17, spaceBefore=10, spaceAfter=6, textColor="#1d4ed8")
    body = ParagraphStyle("StudyBody", parent=styles["BodyText"], fontSize=10.5, leading=15, spaceAfter=4)
    topic_heading = ParagraphStyle("StudyTopic", parent=styles["Heading3"], fontSize=11.5, leading=15, spaceBefore=8, spaceAfter=4)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="StudyLens AI",
    )

    story = []
    story.append(Paragraph(title, heading))
    story.append(Paragraph(f"Subject: {subject_name}" if subject_name else "StudyLens AI Study Resource", subtitle))
    story.append(Paragraph(f"Generated {datetime.datetime.now(datetime.timezone.utc).strftime('%B %d, %Y at %H:%M')}", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color="#d1d5db", spaceBefore=8, spaceAfter=10))

    def esc(text):
        return sanitize(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    if mode == "summary":
        story.append(Paragraph("Executive Summary", section))
        story.append(Paragraph(esc(payload.get("executiveSummary") or ""), body))

        takeaways = payload.get("keyTakeaways") or []
        if isinstance(takeaways, list) and takeaways:
            story.append(Paragraph("Key Takeaways", section))
            story.append(ListFlowable(
                [ListItem(Paragraph(esc(t), body), leftIndent=18) for t in takeaways],
                bulletType="bullet", start="-", leftIndent=18,
            ))

        bullets = payload.get("bulletPoints") or []
        if isinstance(bullets, list) and bullets:
            story.append(Paragraph("Core Bullet Points", section))
            story.append(ListFlowable(
                [ListItem(Paragraph(esc(b), body), leftIndent=18) for b in bullets],
                bulletType="bullet", start="-", leftIndent=18,
            ))
    elif mode == "reviewer":
        story.append(Paragraph("Concept Overview", section))
        story.append(Paragraph(esc(payload.get("overview") or ""), body))

        topics = payload.get("topics") or []
        if isinstance(topics, list) and topics:
            story.append(Paragraph("Topic-by-Topic Breakdown", section))
            for idx, t in enumerate(topics, start=1):
                if not isinstance(t, dict):
                    continue
                story.append(Paragraph(f"Topic {idx}: {esc(t.get('topic') or t.get('topicName') or 'Study Topic')}", topic_heading))
                if t.get("overview"):
                    story.append(Paragraph(esc(t["overview"]), body))

                concepts = t.get("keyConcepts") or t.get("keyPoints") or []
                if isinstance(concepts, list) and concepts:
                    story.append(Paragraph("Key Concepts", body))
                    story.append(ListFlowable(
                        [ListItem(Paragraph(esc(c), body), leftIndent=18) for c in concepts],
                        bulletType="bullet", start="-", leftIndent=18,
                    ))

                sample_questions = t.get("sampleQuestions") or []
                if isinstance(sample_questions, list) and sample_questions:
                    story.append(Paragraph("Sample Self-Check Questions", body))
                    for qidx, sq in enumerate(sample_questions, start=1):
                        if isinstance(sq, dict):
                            q_text = sq.get("question") or ""
                            a_text = sq.get("answer") or ""
                        else:
                            q_text = sq or ""
                            a_text = ""
                        if q_text:
                            story.append(Paragraph(f"Q{qidx}. {esc(q_text)}", body))
                        if a_text:
                            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;A: {esc(a_text)}", body))

    elif mode == "quiz":
        questions = payload.get("questions") or []
        if isinstance(questions, list) and questions:
            story.append(Paragraph("Quiz Questions", section))
            for idx, q in enumerate(questions, start=1):
                if not isinstance(q, dict):
                    continue
                story.append(Paragraph(f"Q{idx}. {esc(q.get('question') or '')}", body))
                options = q.get("options") or []
                correct_idx = q.get("correctAnswer")
                if isinstance(options, list):
                    for oi, opt in enumerate(options):
                        letter = chr(65 + oi)
                        marker = "* " if str(correct_idx) == str(oi) else "  "
                        story.append(Paragraph(f"{marker}{letter}. {esc(opt)}", body))
                if isinstance(correct_idx, int) and isinstance(options, list) and 0 <= correct_idx < len(options):
                    story.append(Paragraph(f"Correct Answer: {esc(options[correct_idx])}", body))
                elif str(correct_idx).isdigit() and isinstance(options, list):
                    ci = int(correct_idx)
                    if 0 <= ci < len(options):
                        story.append(Paragraph(f"Correct Answer: {esc(options[ci])}", body))
                elif isinstance(correct_idx, str) and not (isinstance(options, list) and options):
                    # Identification / short-answer items carry a string answer with no options.
                    story.append(Paragraph(f"Correct Answer: {esc(correct_idx)}", body))
    else:
        cards = payload.get("cards") or []
        if isinstance(cards, list) and cards:
            story.append(Paragraph("Flashcards", section))
            for idx, c in enumerate(cards, start=1):
                if not isinstance(c, dict):
                    continue
                story.append(Paragraph(f"Card {idx}: {esc(c.get('question') or '')}", body))
                if c.get("answer"):
                    story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;Answer: {esc(c.get('answer') or '')}", body))

    doc.build(story)
    buf.seek(0)

    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower() or "studylens-resource"
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{slug[:60]}.pdf",
    )


@app.route("/api/convert-to-pdf", methods=["POST"])
@require_auth
def convert_to_pdf():
    """Renders a simple {title, content, items[]} payload into a downloadable PDF.

    Matches the legacy Express /api/convert-to-pdf contract used by the web analytics
    page and flashcard export: title heading, optional content paragraph, then numbered
    items rendered as "1. <question|topic>" + "Answer / Detail: <answer|overview>".
    """
    data = request.json or {}
    title = str(data.get("title") or "StudyLens AI Report")
    meta_line = str(data.get("metaLine") or "")
    content = str(data.get("content") or "")
    items = data.get("items") or []

    import re

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import SimpleDocTemplate, Paragraph, HRFlowable, Spacer
    except Exception:
        return jsonify({"error": "PDF library (reportlab) is not installed.", "code": "PDF_UNAVAILABLE"}), 500

    def sanitize(text):
        s = str(text or "")
        replacements = {
            "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
            "\u2013": "-", "\u2014": "-", "\u2022": "-", "\u00b7": "-",
            "\u2026": "...", "\u00a0": " ", "\ufeff": "",
        }
        for k, v in replacements.items():
            s = s.replace(k, v)
        return "".join(ch for ch in s if ch in "\t\n\r" or 32 <= ord(ch) <= 126)

    # -- Markdown → reportlab HTML converter --
    # Converts common markdown markers into the subset of HTML that
    # reportlab's Paragraph element supports: <b>, <i>, <u>, <br/>.

    _TAG_PLACEHOLDER_RE = re.compile(r"(<[^>]+>)")

    def _md_to_pdf_html(text):
        """Convert markdown-style formatting into reportlab-safe HTML tags."""
        s = sanitize(text)
        if not s:
            return ""

        # Preserve any HTML-like tags already present (e.g. from content).
        tags = []
        def _save_tag(m):
            tags.append(m.group(0))
            return f"\x00{len(tags) - 1}\x00"
        s = _TAG_PLACEHOLDER_RE.sub(_save_tag, s)

        # Escape literal markup characters first so stray <, >, & render as
        # text instead of being interpreted (or escaping our own tags below).
        s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        # **bold**
        s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
        # *italic* (but not ** which was already handled)
        s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", s)
        # __bold__
        s = re.sub(r"__(.+?)__", r"<b>\1</b>", s)
        # _italic_
        s = re.sub(r"(?<!_)_(?!_)(.+?)(?<!_)_(?!_)", r"<i>\1</i>", s)

        # Restore saved tags.
        for idx, tag in enumerate(tags):
            s = s.replace(f"\x00{idx}\x00", tag)
        return s

    def _is_header(line):
        """Return (level, text) if line is a markdown header, else None."""
        m = re.match(r"^(#{1,6})\s+(.+)$", line)
        if m:
            return len(m.group(1)), m.group(2).strip()
        return None

    def _is_bullet(line):
        """Return bullet text if line starts with '- ' or '* ', else None."""
        m = re.match(r"^[-*]\s+(.+)$", line)
        if m:
            return m.group(1).strip()
        return None

    def _is_rule(line):
        """Return True if line is a horizontal rule (---, ***, ___, ===)."""
        return bool(re.match(r"^[-*=]{3,}\s*$", line.strip()))

    def _is_numbered(line):
        """Return (num, text) if line starts with '1. ', '2. ', etc."""
        m = re.match(r"^(\d+)[.)]\s+(.+)$", line)
        if m:
            return m.group(1), m.group(2).strip()
        return None

    # -- Styles --
    styles = getSampleStyleSheet()
    heading = ParagraphStyle("ReportHeading", parent=styles["Title"], fontSize=18, leading=22, spaceAfter=6)
    subtitle = ParagraphStyle("ReportSubtitle", parent=styles["Normal"], fontSize=10, leading=14, alignment=TA_CENTER, textColor="#475569", spaceAfter=4)
    body = ParagraphStyle("ReportBody", parent=styles["BodyText"], fontSize=10.5, leading=15, spaceAfter=4)
    body_bold = ParagraphStyle("ReportBodyBold", parent=body, fontSize=11, leading=15, spaceAfter=4, textColor="#0f172a")
    h2_style = ParagraphStyle("ReportH2", parent=styles["Heading2"], fontSize=14, leading=18, spaceBefore=10, spaceAfter=4, textColor="#1e293b")
    h3_style = ParagraphStyle("ReportH3", parent=styles["Heading3"], fontSize=12, leading=16, spaceBefore=8, spaceAfter=3, textColor="#334155")
    bullet_style = ParagraphStyle("ReportBullet", parent=body, leftIndent=18, bulletIndent=6, spaceBefore=1, spaceAfter=1)
    item_heading = ParagraphStyle("ReportItem", parent=styles["Heading3"], fontSize=11, leading=15, spaceBefore=8, spaceAfter=2, textColor="#0f766e")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="StudyLens AI",
    )

    story = []
    story.append(Paragraph(_md_to_pdf_html(title), heading))
    if meta_line:
        story.append(Paragraph(_md_to_pdf_html(meta_line), subtitle))
    story.append(Paragraph(f"Generated {datetime.datetime.now(datetime.timezone.utc).strftime('%B %d, %Y at %H:%M')}", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color="#d1d5db", spaceBefore=8, spaceAfter=10))

    if content:
        for line in content.split("\n"):
            stripped = line.strip()
            if not stripped:
                story.append(Spacer(1, 6))
                continue
            if _is_rule(stripped):
                story.append(HRFlowable(width="100%", thickness=1, color="#e5e7eb", spaceBefore=4, spaceAfter=4))
                continue
            hdr = _is_header(stripped)
            if hdr:
                level, text = hdr
                style = h2_style if level <= 2 else h3_style
                story.append(Paragraph(_md_to_pdf_html(text), style))
                continue
            bul = _is_bullet(stripped)
            if bul is not None:
                story.append(Paragraph(
                    f"\u2022 {_md_to_pdf_html(bul)}",
                    bullet_style,
                ))
                continue
            num = _is_numbered(stripped)
            if num:
                story.append(Paragraph(
                    f"{num[0]}. {_md_to_pdf_html(num[1])}",
                    bullet_style,
                ))
                continue
            # Regular paragraph — split on double-spaces for line breaks
            # and render with inline formatting.
            story.append(Paragraph(_md_to_pdf_html(stripped), body))
        story.append(HRFlowable(width="100%", thickness=1, color="#e5e7eb", spaceBefore=4, spaceAfter=8))

    def esc(text):
        return sanitize(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    if isinstance(items, list):
        for idx, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                continue
            label = item.get("question") or item.get("topic") or "Item"
            detail = item.get("answer") or item.get("overview") or ""
            story.append(Paragraph(f"{idx}. {esc(label)}", item_heading))
            if detail:
                story.append(Paragraph(f"Answer / Detail: {esc(detail)}", body))

    doc.build(story)
    buf.seek(0)

    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower() or "studylens-report"
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{slug[:60]}.pdf",
    )


@app.route("/api/ai/save", methods=["POST"])
@require_auth
def save_ai_resource():
    """Saves a previously generated (non-persisted) AI resource draft."""
    try:
        data = request.json or {}
        mode = data.get("mode")
        if mode not in ("quiz", "flashcards", "summary", "reviewer"):
            return jsonify({"error": "Missing or invalid mode.", "code": "INVALID_MODE"}), 400

        timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        # Quiz ownership rule (parity with /api/ai/generate): teacher quizzes may
        # only target a subject the creator manages (or stay subjectless). Admins
        # may target any subject. Students cannot create course quizzes at all.
        # All identity checks key off the verified session, never client fields.
        current_user = getattr(request, "current_user", None) or {}
        auth_id = current_user.get("id") or ""
        auth_name = current_user.get("name") or ""
        auth_role = current_user.get("role") or "student"
        data["createdById"] = auth_id or data.get("createdById") or "usr-teacher-1"
        data["createdByName"] = auth_name or data.get("createdByName") or "User"
        # user_role decides the mirrored material's material_type/uploader_role,
        # so it must come from the session too -- otherwise a stale client role
        # silently files a teacher's resource as "personal" and the materials
        # page hides it. Mirrors the attribution rule documented at generate_ai_resource.
        data["userRole"] = auth_role
        if mode == "quiz":
            if auth_role == "student":
                data["quizType"] = "student"
            quiz_type = data.get("quizType") or "student"
            subject_id = data.get("subjectId") or ""
            if quiz_type == "teacher" and auth_role not in ("teacher", "admin"):
                return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
            if quiz_type == "teacher" and auth_role == "teacher" and subject_id not in ("", "personal"):
                subject = db.session.get(SubjectModel, subject_id)
                if not subject or subject.teacher_id != auth_id:
                    return jsonify({"error": "You can only save quizzes to a subject assigned to you.", "code": "FORBIDDEN"}), 403

        saved = _persist_generated_resource(mode, data, data, timestamp_ms, created_at)
        if saved is None:
            return jsonify({"error": "Could not save the resource. The database write failed. Please try again.", "code": "SAVE_FAILED", "reason": _LAST_COMMIT_ERROR}), 500

        current_user = getattr(request, "current_user", None) or {}
        if not _can_access_saved_resource(saved, mode, current_user):
            return jsonify({"error": "You can only save generated resources you own or manage.", "code": "FORBIDDEN"}), 403

        created_by_id = (current_user or {}).get("id") or data.get("createdById") or "usr-teacher-1"
        created_by_name = (current_user or {}).get("name") or data.get("createdByName") or "User"
        user_role = (current_user or {}).get("role") or data.get("userRole") or data.get("quizType") or "student"
        log_action(created_by_id, created_by_name, user_role, "AI_RESOURCE_SAVE", f"Saved generated {mode} to the library.")
        if isinstance(saved, AIGeneratedContentModel):
            return jsonify(_ai_content_to_dict(saved)), 201
        return jsonify(saved.to_dict()), 201
    except Exception as e:
        short = str(e).splitlines()[0][:180] if str(e) else e.__class__.__name__
        print(f"[Database] Unhandled error saving AI resource: {e}")
        return jsonify({"error": "Could not save the resource due to a server error. Please try again.", "code": "SAVE_ERROR", "reason": short}), 500


@app.route("/api/ai/explain", methods=["POST"])
@require_auth
def explain_answer_ai():
    """Generates a plain-language explanation of a quiz item for a student."""
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    question = data.get("question") or ""
    options = data.get("options") or []

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err
    correct_index = int(data.get("correctAnswer", 0))
    selected_index = int(data.get("selectedAnswer", 0))
    text_context = data.get("context") or data.get("textContent") or ""

    if not question:
        return jsonify({"error": "No question provided.", "code": "EMPTY_TEXT"}), 400

    result = explain_answer_with_groq(question, options, correct_index, selected_index, text_context)
    # Attribution follows the verified session (admins may still author for a user).
    author_id = data.get("createdById") if current_user.get("role") == "admin" else (current_user.get("id") or "")
    _save_ai_generated_content(author_id, data.get("materialId"), "Answer Explanation", "explanation", result)
    return jsonify(result), 200

@app.route("/api/explain", methods=["POST"])
@require_auth
def explain_answer_ai_alias():
    """Alias for /api/ai/explain so legacy components (e.g. FlashcardView) work."""
    return explain_answer_ai()

@app.route("/api/hint", methods=["POST"])
@require_auth
def ai_quiz_hint():
    """Generates a subtle educational hint for a quiz question without revealing the answer."""
    data = request.json or {}
    question = data.get("question") or ""
    options = data.get("options") or []

    if not question:
        return jsonify({"error": "No question provided.", "code": "EMPTY_TEXT"}), 400

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err

    hint = generate_hint_with_groq(question, options)
    return jsonify({"hint": hint}), 200

@app.route("/api/ai/recommendations", methods=["POST"])
@require_auth
def ai_personalized_recommendations():
    """Personalized learning recommendations derived from stored quiz analytics."""
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    role = current_user.get("role") or ""

    # The target student must be the caller, or (for staff) a student the caller
    # actually teaches. The client-supplied studentId is never trusted on its own.
    student_id = data.get("studentId") or user_id or ""
    if student_id != user_id and role != "admin":
        if role != "teacher" or not _teacher_covers_student(user_id, student_id):
            return jsonify({
                "error": "You can only generate recommendations for yourself or students you teach.",
                "code": "FORBIDDEN",
            }), 403

    rate_err = _ai_rate_limited()
    if rate_err:
        return rate_err

    subject_id = data.get("subjectId")
    profile = _build_student_learning_profile(student_id, subject_id)
    result = generate_recommendations_with_groq(profile)
    _save_ai_generated_content(student_id, None, "Personalized Learning Recommendations", "recommendation", result)
    return jsonify(result), 200

# --------------------------------------------------
# QUIZ MANAGEMENT
# --------------------------------------------------
@app.route("/api/quizzes", methods=["GET"])
@require_auth
def get_quizzes():
    qs = QuizModel.query.all()
    current_user = getattr(request, "current_user", None) or {}
    requester_id = current_user.get("id") or ""
    requester_role = current_user.get("role") or ""
    # Privacy Rule: Personal practice quizzes (quizType "student") are strictly
    # private to their creator. Teacher/course quizzes are distributed to enrolled
    # class rosters (per the spec): a student sees them only when enrolled in the
    # quiz's subject (subjectless drafts and unpublished quizzes stay hidden).
    if requester_role == "student":
        enrolled = {
            e.subject_id
            for e in StudentSubjectModel.query.filter_by(student_id=requester_id).all()
        }
        qs = [
            q for q in qs
            if (q.quiz_type != "student" or q.teacher_id == requester_id)
            and (q.quiz_type != "teacher" or (q.subject_id in enrolled and q.is_published))
        ]
    elif requester_role == "teacher":
        # Teachers see ONLY their own quizzes plus course quizzes assigned to
        # subjects they manage — never other teachers' assessments.
        managed = {
            s.subject_id
            for s in SubjectModel.query.filter_by(teacher_id=requester_id).all()
        }
        qs = [
            q for q in qs
            if q.teacher_id == requester_id
            or (q.quiz_type != "student" and q.subject_id in managed)
        ]
    else:
        qs = [q for q in qs if q.quiz_type != "student" or q.teacher_id == requester_id]

    used = {}
    last_score = {}
    best_score = {}
    last_raw = {}
    last_max = {}
    if requester_role == "student" and requester_id:
        for a in QuizAttemptModel.query.filter_by(student_id=requester_id).order_by(QuizAttemptModel.submitted_at.desc()).all():
            used[a.quiz_id] = used.get(a.quiz_id, 0) + 1
            last_score.setdefault(a.quiz_id, a.percentage)
            best_score[a.quiz_id] = max(best_score.get(a.quiz_id, 0.0), a.percentage)
            last_raw.setdefault(a.quiz_id, a.score)
            last_max.setdefault(a.quiz_id, a.max_score)
    return jsonify([
        {**_public_quiz_payload(q, requester_role), **({"attemptsUsed": used.get(q.quiz_id, 0), "lastScore": last_score.get(q.quiz_id), "bestScore": best_score.get(q.quiz_id), "lastScoreRaw": last_raw.get(q.quiz_id), "lastMaxScore": last_max.get(q.quiz_id)} if requester_role == "student" else {})}
        for q in qs
    ])

@app.route("/api/quizzes", methods=["POST"])
@require_roles("teacher", "admin", "student")
def create_quiz():
    data = request.json or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Quiz title is required.", "code": "BAD_REQUEST"}), 400

    # "" = subjectless draft (teacher-created, awaiting assignment); "personal"
    # = the student's private practice bucket. No default subject is forced here.
    subject_id = data.get("subjectId") or ""
    subject = db.session.get(SubjectModel, subject_id) if subject_id else None
    subject_name = data.get("subjectName")
    if not subject_name and subject:
        subject_name = f"{subject.subject_code} - {subject.subject_name}"

    current_user = getattr(request, "current_user", None) or {}
    user_role = current_user.get("role") or data.get("userRole") or data.get("uploaderRole") or ""
    if user_role == "admin":
        return jsonify({"error": "Administrators have read-only access to quizzes and cannot create them.", "code": "FORBIDDEN"}), 403
    created_by_id = current_user.get("id") or data.get("createdById") or (data.get("created_by_id") or "usr-teacher-1")
    created_by_name = data.get("createdByName") or (data.get("created_by_name") or "User")
    quiz_type = data.get("quizType") or ("teacher" if str(created_by_id).startswith("usr-teacher") else "student")

    # Students may ONLY create private practice quizzes: scope and subject are
    # forced server-side regardless of what the client sends.
    if user_role == "student":
        quiz_type = "student"
        subject_id = "personal"
        subject = None
        subject_name = "Personal Practice"

    questions = data.get("questions") or []
    if not isinstance(questions, list):
        return jsonify({"error": "questions must be a list.", "code": "BAD_REQUEST"}), 400

    # Ownership rule: teacher quizzes may only target a subject the creator manages
    # (or stay subjectless). Admins may target any subject. Students cannot create
    # course quizzes at all.
    if quiz_type == "teacher" and user_role not in ("teacher", "admin"):
        return jsonify({"error": "Only instructors can create course quizzes.", "code": "FORBIDDEN"}), 403
    if quiz_type == "teacher" and user_role == "teacher" and subject_id not in ("", "personal"):
        if not subject or subject.teacher_id != created_by_id:
            return jsonify({"error": "You can only create quizzes in a subject assigned to you.", "code": "FORBIDDEN"}), 403

    new_quiz = QuizModel(
        quiz_id=f"quiz-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        teacher_id=created_by_id,
        title=title,
        description=data.get("description"),
        status="active",
        subject_id=subject_id,
        subject_name=subject_name or "",
        created_by_name=created_by_name,
        quiz_type=quiz_type,
        questions_json=json.dumps(questions),
        is_published=bool(data.get("isPublished", quiz_type == "teacher")),
        time_limit_minutes=int(data.get("timeLimitMinutes") or 15),
        pass_percentage=int(data.get("passPercentage") or 70),
        difficulty=data.get("difficulty") or "medium",
        attempts_allowed=_clamp_attempts(data.get("attemptsAllowed")),
        reveal_answers=_reveal_answers(data.get("revealAnswers")),
        deadline=(data.get("deadline") or None),
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(new_quiz)
    _replace_quiz_questions(new_quiz.quiz_id, questions)
    _commit_or_warn("quiz creation")
    if new_quiz.is_published and quiz_type == "teacher" and subject_id not in ("", "personal"):
        _fan_out_quiz_notification(new_quiz)
        _commit_or_warn("quiz publish notifications")
    log_action(created_by_id, created_by_name, quiz_type, "QUIZ_CREATE", f"Created quiz '{title}'")
    return jsonify(new_quiz.to_dict()), 201

@app.route("/api/quizzes/<quiz_id>", methods=["PUT"])
@require_auth
def update_quiz(quiz_id):
    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to quizzes and cannot edit them.", "code": "FORBIDDEN"}), 403

    # Ownership rule: students may only edit their own practice quizzes; teachers
    # may only edit quizzes in subjects they manage; admins unrestricted.
    if role == "student":
        if not (quiz.quiz_type == "student" and quiz.teacher_id == user_id):
            return jsonify({"error": "Only the owner can edit this quiz.", "code": "FORBIDDEN"}), 403
        data_probe = request.json or {}
        for forbidden in ("subjectId", "subjectName", "quizType", "isPublished"):
            if forbidden in data_probe:
                return jsonify({"error": "Practice quizzes cannot change subject, type, or visibility.", "code": "FORBIDDEN"}), 403
    elif role == "teacher":
        if quiz.subject_id and quiz.subject_id != "personal":
            subject = db.session.get(SubjectModel, quiz.subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only edit quizzes from a subject assigned to you.", "code": "FORBIDDEN"}), 403
        elif quiz.teacher_id != user_id:
            # Subjectless draft / legacy "personal" practice quizzes belong to
            # their creator only; other teachers may not edit them.
            return jsonify({"error": "You can only edit quizzes you created.", "code": "FORBIDDEN"}), 403
    elif role != "admin":
        return jsonify({"error": "Only the owner can edit this quiz.", "code": "FORBIDDEN"}), 403

    data = request.json or {}
    publish_changed = False
    if "title" in data and data.get("title"):
        quiz.title = data["title"]
    if "description" in data:
        quiz.description = data.get("description")
    if "subjectId" in data:
        new_subject_id = data["subjectId"]
        # Ownership rule: teachers may only assign a quiz to a subject they manage,
        # or move it to a subjectless draft ("") / legacy personal practice.
        if role == "teacher" and new_subject_id not in ("", "personal"):
            subject = db.session.get(SubjectModel, new_subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only assign quizzes to a subject assigned to you.", "code": "FORBIDDEN"}), 403
        quiz.subject_id = new_subject_id
        # Assigning a subject NEVER publishes a quiz: publishing is an explicit,
        # deliberate action that appears only once a quiz is subject-assigned.
        # (See the "isPublished" block below, which still guards against
        # publishing a subjectless quiz.)
    if "subjectName" in data:
        quiz.subject_name = data["subjectName"]
    if "quizType" in data:
        quiz.quiz_type = data["quizType"]
    if "timeLimitMinutes" in data:
        quiz.time_limit_minutes = int(data.get("timeLimitMinutes") or 15)
    if "passPercentage" in data:
        quiz.pass_percentage = int(data.get("passPercentage") or 70)
    if "difficulty" in data:
        quiz.difficulty = data.get("difficulty") or "medium"
    if "attemptsAllowed" in data:
        quiz.attempts_allowed = _clamp_attempts(data.get("attemptsAllowed"))
    if "revealAnswers" in data:
        quiz.reveal_answers = _reveal_answers(data.get("revealAnswers"))
    if "deadline" in data:
        quiz.deadline = data.get("deadline") or None
    if "questions" in data:
        qs = data.get("questions") or []
        if not isinstance(qs, list):
            return jsonify({"error": "questions must be a list.", "code": "BAD_REQUEST"}), 400
        quiz.questions_json = json.dumps(qs)
        _replace_quiz_questions(quiz.quiz_id, qs)
    if "isPublished" in data and data.get("isPublished") != quiz.is_published and role not in ("teacher", "admin"):
        return jsonify({"error": "Only instructors can publish or unpublish quizzes.", "code": "FORBIDDEN"}), 403
    if "isPublished" in data:
        was_published = bool(quiz.is_published)
        if bool(data.get("isPublished")) and not quiz.subject_id:
            return jsonify({"error": "Assign this quiz to a subject before publishing it.", "code": "SUBJECT_REQUIRED"}), 400
        quiz.is_published = bool(data.get("isPublished"))
        publish_changed = quiz.is_published != was_published

    _commit_or_warn("quiz update")
    if publish_changed:
        log_action(user_id or quiz.teacher_id, quiz.created_by_name or "", quiz.quiz_type or "teacher",
                   "QUIZ_PUBLISH" if quiz.is_published else "QUIZ_UNPUBLISH",
                   f"{'Published' if quiz.is_published else 'Unpublished'} quiz '{quiz.title}'")
        if quiz.is_published and quiz.quiz_type == "teacher":
            _fan_out_quiz_notification(quiz)
            _commit_or_warn("quiz publish notifications")
    log_action(user_id or quiz.teacher_id, quiz.created_by_name or "", quiz.quiz_type or "teacher", "QUIZ_UPDATE", f"Updated quiz '{quiz.title}'")
    return jsonify(quiz.to_dict()), 200

@app.route("/api/quizzes/<quiz_id>", methods=["DELETE"])
@require_auth
def delete_quiz(quiz_id):
    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    if role == "admin":
        return jsonify({"error": "Administrators have read-only access to quizzes and cannot delete them.", "code": "FORBIDDEN"}), 403

    # Ownership rule mirrors update_quiz: students may only delete their own
    # practice quizzes; teachers only quizzes in subjects they manage; admins any.
    if role == "student":
        if not (quiz.quiz_type == "student" and quiz.teacher_id == user_id):
            return jsonify({"error": "Only the owner can delete this quiz.", "code": "FORBIDDEN"}), 403
    elif role == "teacher":
        if quiz.subject_id and quiz.subject_id != "personal":
            subject = db.session.get(SubjectModel, quiz.subject_id)
            if not subject or subject.teacher_id != user_id:
                return jsonify({"error": "You can only delete quizzes from a subject assigned to you.", "code": "FORBIDDEN"}), 403
        elif quiz.teacher_id != user_id:
            # Subjectless draft / legacy "personal" practice quizzes belong to
            # their creator only; other teachers may not delete them.
            return jsonify({"error": "You can only delete quizzes you created.", "code": "FORBIDDEN"}), 403
    elif role != "admin":
        return jsonify({"error": "Only the owner can delete this quiz.", "code": "FORBIDDEN"}), 403

    QuizAttemptModel.query.filter_by(quiz_id=quiz_id).delete(synchronize_session=False)
    QuizQuestionModel.query.filter_by(quiz_id=quiz_id).delete(synchronize_session=False)
    db.session.delete(quiz)
    _commit_or_warn("quiz deletion")
    log_action(user_id or quiz.teacher_id, quiz.created_by_name or "", quiz.quiz_type or "teacher",
               "QUIZ_DELETE", f"Deleted quiz '{quiz.title}'")
    return jsonify({"success": True}), 200

def _answer_index(value, options):
    """Maps an answer value (option index, "A"-"D" letter, or option text) to a 0-based index.

    Returns None when the value cannot be resolved to a valid option index.
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value < len(options) else None
    text = str(value).strip()
    if text.isdigit():
        idx = int(text)
        return idx if 0 <= idx < len(options) else None
    letter = text.upper()
    if len(letter) == 1 and "A" <= letter <= "Z":
        idx = ord(letter) - ord("A")
        return idx if 0 <= idx < len(options) else None
    for i, opt in enumerate(options):
        if str(opt).strip().lower() == text.lower():
            return i
    return None


def _merge_questions_json(questions, questions_json):
    """Merges QuizQuestionModel rows with the authoritative questions_json copy.

    The JSON copy fills gaps on the rows (legacy rows lack topicTag, explanation,
    etc.) and is authoritative for multi-answer correctAnswer lists (the rows'
    correct_answer column is CHAR(1) and stores no letter for those).
    """
    try:
        json_qs = json.loads(questions_json) or []
    except Exception:
        json_qs = []
    json_by_id = {str(jq.get("id")): jq for jq in json_qs if jq.get("id")}
    for pos, q in enumerate(questions):
        jq = json_by_id.get(str(q.get("id")))
        if jq is None and pos < len(json_qs):
            jq = json_qs[pos]
        if not isinstance(jq, dict):
            continue
        for key in ("question", "options", "explanation", "topicTag", "bloomsLevel", "difficulty"):
            if q.get(key) in (None, "") and jq.get(key) is not None:
                q[key] = jq[key]
        # type: the questions_json copy knows the producer's canonical type (the
        # quiz_questions rows have no type column), so surface it on the rows.
        if not q.get("type") and jq.get("type"):
            q["type"] = jq["type"]
        # correctAnswer: the questions_json copy is authoritative when it holds a
        # multi-answer list; otherwise rows fill gaps for legacy quizzes.
        if isinstance(jq.get("correctAnswer"), list):
            q["correctAnswer"] = jq["correctAnswer"]
        elif q.get("correctAnswer") in (None, ""):
            q["correctAnswer"] = jq.get("correctAnswer")
    return questions


def _public_quiz_payload(quiz, requester_role):
    """Quiz dict for the list endpoint.

    Students never receive the answer key of teacher-authored quizzes before
    submitting: grading happens server-side, so exposing correctAnswer (and the
    explanation, which usually spells out the answer) upfront would leak it.
    Practice quizzes still return the key to their own author, and teachers/admins
    keep full fidelity.
    """
    d = quiz.to_dict()
    if requester_role == "student" and quiz.quiz_type == "teacher":
        d["questions"] = [
            {k: v for k, v in q.items() if k not in ("correctAnswer", "explanation")}
            for q in (d.get("questions") or [])
        ]
    return d


@app.route("/api/quizzes/<quiz_id>/submit", methods=["POST"])
@require_auth
def submit_quiz_attempt(quiz_id):
    """Grades a submitted quiz and persists a QuizAttempt for analytics."""
    quiz = db.session.get(QuizModel, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""

    # Who may submit: admins anywhere; the teacher previewing their OWN course
    # quizzes; students enrolled in the quiz's subject (course quizzes) or the
    # owner of a practice quiz.
    if role == "teacher":
        if quiz.quiz_type == "student" or quiz.teacher_id != user_id:
            return jsonify({"error": "You can only submit your own course quizzes.", "code": "FORBIDDEN"}), 403
    elif role == "student":
        if quiz.quiz_type == "student":
            if quiz.teacher_id != user_id:
                return jsonify({"error": "You can only submit your own practice quizzes.", "code": "FORBIDDEN"}), 403
        elif quiz.subject_id in ("", "personal"):
            # A subjectless / "personal" teacher draft has no enrolling class,
            # so only its creator may submit it (as a preview).
            if quiz.teacher_id != user_id:
                return jsonify({"error": "You can only submit your own quizzes.", "code": "FORBIDDEN"}), 403
        else:
            enrolled = StudentSubjectModel.query.filter_by(subject_id=quiz.subject_id, student_id=user_id).first()
            if not enrolled:
                return jsonify({"error": "You must be enrolled in this subject to submit the quiz.", "code": "NOT_ENROLLED"}), 403
    elif role != "admin":
        return jsonify({"error": "You do not have permission to submit this quiz.", "code": "FORBIDDEN"}), 403

    # Deadline enforcement: students cannot submit after the quiz deadline.
    if quiz.deadline and role != "admin":
        try:
            dl = str(quiz.deadline).replace("Z", "+00:00")
            deadline_dt = datetime.datetime.fromisoformat(dl)
            now_dt = datetime.datetime.now(deadline_dt.tzinfo) if deadline_dt.tzinfo else datetime.datetime.now(datetime.timezone.utc)
            if now_dt > deadline_dt:
                return jsonify({"error": "The deadline for this quiz has passed. It was recorded as Missing.", "code": "DEADLINE_PASSED"}), 409
        except ValueError:
            pass

    try:
        questions = _quiz_questions_for(quiz.quiz_id)
        if questions is None:
            questions = json.loads(quiz.questions_json)
        else:
            questions = _merge_questions_json(questions, quiz.questions_json)
    except Exception:
        questions = []

    data = request.json or {}
    payload_answers = data.get("answers") or data.get("userAnswers") or []
    # Attribution always comes from the verified token, never from the body:
    # a client-supplied studentId could otherwise forge attempts for peers.
    student_id = user_id
    student_name = current_user.get("name") or "Student"
    time_taken = int(data.get("timeTaken") or 0)
    pass_percentage = quiz.pass_percentage or 70

    # Attempt limit: teacher quizzes with a configured cap reject submissions once
    # the student has exhausted their allowed attempts. Practice quizzes and
    # uncapped (0) quizzes stay unlimited.
    if quiz.quiz_type == "teacher" and (quiz.attempts_allowed or 0) > 0:
        used = QuizAttemptModel.query.filter_by(quiz_id=quiz_id, student_id=student_id).count()
        if used >= quiz.attempts_allowed:
            return jsonify({
                "error": "You have reached the maximum number of attempts allowed for this quiz.",
                "code": "ATTEMPTS_EXHAUSTED",
                "attemptsUsed": used,
                "attemptsAllowed": quiz.attempts_allowed,
            }), 409

    if not isinstance(payload_answers, list):
        payload_answers = []

    q_by_id = {}
    for idx, q in enumerate(questions):
        q_by_id.setdefault(str(q.get("id")), q)
        q_by_id.setdefault(str(idx), q)

    score = 0
    feedback = []
    weak_topics = []
    strong_topics = []
    for q_idx, q in enumerate(questions):
        qid = str(q.get("id"))
        selected = None
        for ua in payload_answers:
            ua_qid = str(ua.get("questionId") or ua.get("id"))
            if ua_qid == qid or ua_qid == str(q_idx):
                selected = ua.get("selectedAnswer") or ua.get("answer")
                break

        correct = q.get("correctAnswer")
        options = q.get("options") or []
        if isinstance(correct, list):
            # Multiple-correct-answer question: exact set match wins.
            selected_items = selected if isinstance(selected, list) else [selected]
            selected_idx = [_answer_index(s, options) for s in selected_items]
            correct_idx = [_answer_index(c, options) for c in correct]
            if (not selected_idx or not correct_idx
                    or any(i is None for i in selected_idx) or any(i is None for i in correct_idx)):
                is_correct = False
                correct_idx = None
            else:
                is_correct = set(selected_idx) == set(correct_idx)
        elif not options:
            is_correct = (
                selected is not None
                and correct is not None
                and str(selected).strip().lower() == str(correct).strip().lower()
            )
            correct_idx = None
        else:
            selected_idx = _answer_index(selected, options)
            correct_idx = _answer_index(correct, options)
            is_correct = selected_idx is not None and correct_idx is not None and selected_idx == correct_idx
        if is_correct:
            score += 1

        correct_text = ""
        if isinstance(correct_idx, list):
            correct_text = ", ".join(str(options[i]) for i in correct_idx if i is not None)
        elif correct_idx is not None:
            correct_text = str(options[correct_idx])
        elif isinstance(correct, str):
            correct_text = correct

        topic = q.get("topicTag") or "General Concepts"
        if is_correct:
            if topic not in strong_topics:
                strong_topics.append(topic)
        elif topic not in weak_topics:
            weak_topics.append(topic)

        feedback.append({
            "questionId": qid,
            "question": q.get("question", ""),
            "options": options,
            "userAnswer": selected,
            "correctAnswer": correct,
            "isCorrect": is_correct,
            "explanation": q.get("explanation") or (
                f"The correct answer is {correct_text or 'the option highlighted as correct'}."
            ),
            "topic": topic,
            "bloomsLevel": q.get("bloomsLevel", ""),
            "difficulty": q.get("difficulty", "")
        })

    max_score = len(questions)
    percentage = round((score / max_score) * 100, 1) if max_score else 0.0
    passed = percentage >= pass_percentage

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    attempt = QuizAttemptModel(
        attempt_id=f"att-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        quiz_id=quiz_id,
        student_id=student_id,
        attempt_status="Completed",
        score=score,
        time_taken=time_taken or 300,
        submitted_at=now_str,
        quiz_title=quiz.title,
        student_name=student_name,
        subject_id=quiz.subject_id,
        subject_name=quiz.subject_name,
        max_score=max_score,
        percentage=percentage,
        passed=passed,
        answers_json=json.dumps(feedback),
        weak_topics_json=json.dumps(weak_topics),
        strong_topics_json=json.dumps(strong_topics)
    )
    db.session.add(attempt)
    _commit_or_warn("quiz attempt")

    log_action(student_id, student_name, "student", "QUIZ_SUBMIT",
               f"Submitted '{quiz.title}' — {score}/{max_score} ({percentage}%)")

    response_attempt = attempt.to_dict()
    # Answer-reveal gate: when the teacher disabled "students can see correct
    # answers", strip the correct answer + explanation from the student-facing
    # response (the stored attempt keeps the full record for grading views).
    if quiz.reveal_answers is False:
        for fb in response_attempt.get("feedback") or []:
            if isinstance(fb, dict):
                fb.pop("correctAnswer", None)
                fb.pop("explanation", None)
                fb.pop("options", None)

    return jsonify({"attempt": response_attempt}), 200

# --------------------------------------------------
# FLASHCARD / SUMMARY / REVIEWER ROUTES
# --------------------------------------------------
@app.route("/api/flashcards", methods=["GET"])
@require_auth
def get_flashcards():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    query = AIGeneratedContentModel.query.filter_by(content_type="Flashcard")
    if user_id:
        query = query.filter_by(generated_by=user_id)
    decks = query.order_by(AIGeneratedContentModel.created_at.desc()).all()
    return jsonify([_ai_content_to_dict(d) for d in decks])

@app.route("/api/flashcards/<deck_id>", methods=["DELETE"])
@require_auth
def delete_flashcard_deck(deck_id):
    deck = db.session.get(AIGeneratedContentModel, deck_id)
    if not deck or deck.content_type != "Flashcard":
        return jsonify({"error": "Flashcard deck not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(deck, current_user):
        return jsonify({"error": "You can only delete resources you own or manage.", "code": "FORBIDDEN"}), 403
    db.session.delete(deck)
    _commit_or_warn("flashcard deck deletion")
    log_action((current_user or {}).get("id") or deck.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "FLASHCARD_DELETE", f"Deleted flashcard deck '{deck.title}'")
    return jsonify({"success": True}), 200

def _resource_owned_by_current_user(item, current_user):
    """Admins may manage any resource; teachers only those in subjects they
    manage; students only resources they saved themselves."""
    role = (current_user or {}).get("role", "")
    user_id = (current_user or {}).get("id", "")
    if role == "admin":
        return True
    if role == "student":
        return item.generated_by == user_id
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    subject_id = payload.get("subjectId") or ""
    if role == "teacher":
        if not subject_id or subject_id == "personal":
            return item.generated_by == user_id
        subject = db.session.get(SubjectModel, subject_id)
        if not subject or subject.teacher_id != user_id:
            return False
    return True

def _apply_resource_edits(item, data):
    """Updates title / subject metadata (and publish flag where the model supports it)."""
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    if "title" in data and data.get("title"):
        item.title = str(data["title"])[:256]
        payload["title"] = item.title
    if "subjectId" in data:
        payload["subjectId"] = str(data["subjectId"])
    if "subjectName" in data:
        payload["subjectName"] = str(data["subjectName"])[:128]
    if item.content_type == "Flashcard" and "isPublished" in data:
        payload["isPublished"] = bool(data.get("isPublished"))
    item.generated_text = json.dumps(payload)

@app.route("/api/flashcards/<deck_id>", methods=["PUT"])
@require_auth
def update_flashcard_deck(deck_id):
    deck = db.session.get(AIGeneratedContentModel, deck_id)
    if not deck or deck.content_type != "Flashcard":
        return jsonify({"error": "Flashcard deck not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(deck, current_user):
        return jsonify({"error": "You can only edit resources from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    _apply_resource_edits(deck, request.json or {})
    data = request.json or {}
    if "cards" in data:
        cards = data.get("cards")
        if not isinstance(cards, list):
            return jsonify({"error": "cards must be a list.", "code": "BAD_REQUEST"}), 400
        try:
            payload = json.loads(deck.generated_text) or {}
        except Exception:
            payload = {}
        payload["cards"] = cards
        deck.generated_text = json.dumps(payload)
    _commit_or_warn("flashcard deck update")
    log_action((current_user or {}).get("id") or deck.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "FLASHCARD_UPDATE", f"Updated flashcard deck '{deck.title}'")
    return jsonify(_ai_content_to_dict(deck)), 200

@app.route("/api/summaries", methods=["GET"])
@require_auth
def get_summaries():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    query = AIGeneratedContentModel.query.filter_by(content_type="Summary")
    if user_id:
        query = query.filter_by(generated_by=user_id)
    sums = query.order_by(AIGeneratedContentModel.created_at.desc()).all()
    return jsonify([_ai_content_to_dict(s) for s in sums])

@app.route("/api/reviewers", methods=["GET"])
@require_auth
def get_reviewers():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    query = AIGeneratedContentModel.query.filter_by(content_type="Reviewer")
    if user_id:
        query = query.filter_by(generated_by=user_id)
    revs = query.order_by(AIGeneratedContentModel.created_at.desc()).all()
    return jsonify([_ai_content_to_dict(r) for r in revs])

@app.route("/api/summaries/<summary_id>", methods=["PUT"])
@require_auth
def update_summary(summary_id):
    item = db.session.get(AIGeneratedContentModel, summary_id)
    if not item or item.content_type != "Summary":
        return jsonify({"error": "Summary not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only edit resources from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    _apply_resource_edits(item, request.json or {})
    data = request.json or {}
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    if "executiveSummary" in data:
        payload["executiveSummary"] = str(data.get("executiveSummary") or "")[:10000]
    if "keyTakeaways" in data:
        kt = data.get("keyTakeaways")
        if not isinstance(kt, list):
            return jsonify({"error": "keyTakeaways must be a list.", "code": "BAD_REQUEST"}), 400
        payload["keyTakeaways"] = [str(x)[:2000] for x in kt]
    if "bulletPoints" in data:
        bp = data.get("bulletPoints")
        if not isinstance(bp, list):
            return jsonify({"error": "bulletPoints must be a list.", "code": "BAD_REQUEST"}), 400
        payload["bulletPoints"] = [str(x)[:2000] for x in bp]
    item.generated_text = json.dumps(payload)
    _commit_or_warn("summary update")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "SUMMARY_UPDATE", f"Updated summary '{item.title}'")
    return jsonify(_ai_content_to_dict(item)), 200

@app.route("/api/summaries/<summary_id>", methods=["DELETE"])
@require_auth
def delete_summary(summary_id):
    item = db.session.get(AIGeneratedContentModel, summary_id)
    if not item or item.content_type != "Summary":
        return jsonify({"error": "Summary not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only delete resources you own or manage.", "code": "FORBIDDEN"}), 403
    db.session.delete(item)
    _commit_or_warn("summary deletion")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "SUMMARY_DELETE", f"Deleted summary '{item.title}'")
    return jsonify({"success": True}), 200

@app.route("/api/reviewers/<reviewer_id>", methods=["PUT"])
@require_auth
def update_reviewer(reviewer_id):
    item = db.session.get(AIGeneratedContentModel, reviewer_id)
    if not item or item.content_type != "Reviewer":
        return jsonify({"error": "Reviewer not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only edit resources from a subject assigned to you.", "code": "FORBIDDEN"}), 403
    _apply_resource_edits(item, request.json or {})
    data = request.json or {}
    try:
        payload = json.loads(item.generated_text) or {}
    except Exception:
        payload = {}
    if "overview" in data:
        payload["overview"] = str(data.get("overview") or "")[:10000]
    if "topics" in data:
        topics = data.get("topics")
        if not isinstance(topics, list):
            return jsonify({"error": "topics must be a list.", "code": "BAD_REQUEST"}), 400
        payload["topics"] = topics
    item.generated_text = json.dumps(payload)
    _commit_or_warn("reviewer update")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "REVIEWER_UPDATE", f"Updated reviewer '{item.title}'")
    return jsonify(_ai_content_to_dict(item)), 200

@app.route("/api/reviewers/<reviewer_id>", methods=["DELETE"])
@require_auth
def delete_reviewer(reviewer_id):
    item = db.session.get(AIGeneratedContentModel, reviewer_id)
    if not item or item.content_type != "Reviewer":
        return jsonify({"error": "Reviewer not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if not _resource_owned_by_current_user(item, current_user):
        return jsonify({"error": "You can only delete resources you own or manage.", "code": "FORBIDDEN"}), 403
    db.session.delete(item)
    _commit_or_warn("reviewer deletion")
    log_action((current_user or {}).get("id") or item.generated_by, (current_user or {}).get("name") or "", (current_user or {}).get("role") or "teacher", "REVIEWER_DELETE", f"Deleted reviewer '{item.title}'")
    return jsonify({"success": True}), 200

# --------------------------------------------------
# NOTIFICATION ROUTES
# --------------------------------------------------
@app.route("/api/notifications", methods=["GET"])
@require_auth
def get_notifications():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or ""
    notifs = NotificationModel.query.filter_by(user_id=user_id).order_by(NotificationModel.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifs])

@app.route("/api/notifications/<notification_id>/read", methods=["PUT"])
@require_auth
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

@app.route("/api/notifications/read-all", methods=["PUT"])
@require_auth
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

def _quiz_topic_index():
    """topicTag lookup from questionId using all persisted quizzes."""
    index = {}
    for qz in QuizModel.query.all():
        try:
            for q in json.loads(qz.questions_json):
                index[str(q.get("id"))] = q.get("topicTag") or "General Concepts"
        except Exception:
            continue
    return index

def _aggregate_topic_performance(attempts):
    """topic -> {total, correct, accuracyPercentage} from persisted quiz attempts."""
    topic_index = _quiz_topic_index()
    topic_map = {}
    for att in attempts:
        try:
            answers = json.loads(att.answers_json)
        except Exception:
            answers = []
        for ans in answers:
            topic = topic_index.get(str(ans.get("questionId")), "General Concepts")
            entry = topic_map.setdefault(topic, {"total": 0, "correct": 0})
            entry["total"] += 1
            if ans.get("isCorrect"):
                entry["correct"] += 1
    for t, d in topic_map.items():
        d["accuracyPercentage"] = round((d["correct"] / d["total"]) * 100) if d["total"] else 0
    return topic_map


MASTERY_THRESHOLD = 70


def _first_match_for_topic(topic):
    """Best-effort lookups of study content tied to a topic (first match wins).

    Searches the persisted library directly: a quiz whose questions carry the
    topic tag, a material whose title/description mentions the topic, and any
    flashcard/reviewer decks whose titles match. Plain dict output (safe for
    jsonify).
    """
    needle = (topic or "").strip().lower()

    def topic_tags(questions):
        tags = set()
        for q in questions or []:
            tags.add((q.get("topicTag") or "General Concepts").strip().lower())
        return tags

    material = None
    for mat in MaterialModel.query.all():
        if needle and (needle in (mat.title or "").lower() or needle in (mat.description or "").lower()):
            material = mat
            break

    quiz = None
    for qz in QuizModel.query.all():
        try:
            tags = topic_tags(json.loads(qz.questions_json))
        except Exception:
            continue
        if needle in tags:
            quiz = qz
            break

    def ai_match(content_type):
        for entry in AIGeneratedContentModel.query.filter_by(content_type=content_type).all():
            if needle in (entry.title or "").lower():
                return entry
        return None

    flashcard = ai_match("Flashcard")
    reviewer = ai_match("Reviewer")

    return {
        "material": {"id": material.material_id, "title": material.title} if material else None,
        "flashcardId": flashcard.content_id if flashcard else None,
        "reviewerId": reviewer.content_id if reviewer else None,
        "quiz": (
            {"id": quiz.quiz_id, "title": quiz.title, "difficulty": quiz.difficulty, "subjectId": quiz.subject_id}
            if quiz else None
        ),
        "subjectId": quiz.subject_id if quiz else (material.subject_id if material else None),
    }


def _latest_attempt_percentages(attempts):
    """Return the percentage of the MOST RECENT attempt per quiz.

    Grading policy: when a quiz is retaken, the recorded score is the latest
    attempt only — earlier attempts never dilute the student's average.
    Accepts model instances or to_dict() mappings.
    """
    def _get(item, name):
        return item.get(name) if isinstance(item, dict) else getattr(item, name)

    latest = {}
    for a in sorted(attempts, key=lambda x: (_get(x, "submitted_at") or ""), reverse=True):
        qid = _get(a, "quiz_id")
        if qid not in latest:
            latest[qid] = float(_get(a, "percentage") or 0)
    return list(latest.values())


def _accuracy_before_latest_tagged_attempt(attempts, topic):
    """Accuracy across all attempts BEFORE the latest one that tagged ``topic``
    weak/strong. ``attempts`` must be sorted newest-first. Returns None when the
    topic was never tagged or has no comparable earlier data."""
    for idx, att in enumerate(attempts):
        try:
            tags = json.loads(att.weak_topics_json or "[]") + json.loads(att.strong_topics_json or "[]")
        except Exception:
            continue
        if topic in tags:
            earlier = attempts[idx + 1:]
            if not earlier:
                return None
            stats = _aggregate_topic_performance(earlier).get(topic)
            return stats.get("accuracyPercentage") if stats else None
    return None

# --------------------------------------------------
# STUDENT PROGRESS & RECOMMENDATIONS
# --------------------------------------------------
@app.route("/api/progress/<student_id>", methods=["GET"])
@require_auth
def get_student_progress(student_id):
    """Aggregated student progress, shaped like src/types.ts StudentProgress."""
    current_user = getattr(request, "current_user", None) or {}
    if not _can_view_student_data(current_user, student_id):
        return jsonify({
            "error": "You do not have permission to view this student's progress.",
            "code": "FORBIDDEN",
        }), 403
    attempts = QuizAttemptModel.query.filter_by(student_id=student_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
    # "Quizzes completed" counts distinct quizzes, not raw attempts (retakes
    # of the same quiz do not multiply the stat).
    total = len({a.quiz_id for a in attempts})

    topic_map = _aggregate_topic_performance(attempts)
    topic_performances = [
        {
            "topic": t,
            "totalQuestions": d["total"],
            "correctAnswers": d["correct"],
            "accuracyPercentage": d["accuracyPercentage"],
        }
        for t, d in topic_map.items()
    ]

    weak, strong = [], []
    for att in attempts:
        try:
            weak += json.loads(att.weak_topics_json) or []
            strong += json.loads(att.strong_topics_json) or []
        except Exception:
            continue

    # Accuracy-driven weak list: a topic only stays "weak" while its lifetime
    # accuracy sits below the mastery bar. Topics that were missed before but
    # are now at/above the bar move to masteredTopics so students can see
    # tangible proof they overcame them.
    historical_weak = list(dict.fromkeys(weak))
    if topic_map:
        current_weak = [
            t for t, d in topic_map.items()
            if d["total"] > 0 and d["accuracyPercentage"] < MASTERY_THRESHOLD
        ]
        current_weak.sort(key=lambda t: topic_map.get(t, {}).get("accuracyPercentage", 0))
        mastered = []
        for t in historical_weak:
            if t in current_weak:
                continue
            acc = topic_map.get(t, {}).get("accuracyPercentage", 0)
            if acc < MASTERY_THRESHOLD:
                continue
            mastered.append({
                "topic": t,
                "currentAccuracy": acc,
                "improvedFrom": _accuracy_before_latest_tagged_attempt(attempts, t),
            })
    else:
        # Legacy attempts without per-question data: fall back to stored tags.
        current_weak = historical_weak
        mastered = []

    payload = {
        "studentId": student_id,
        "totalQuizzesTaken": total,
        "averageScore": (
            round(sum(_latest_attempt_percentages(attempts)) / len(latest_pcts))
            if (latest_pcts := _latest_attempt_percentages(attempts))
            else 0
        ),
        "totalMaterialsUploaded": MaterialModel.query.filter(
            MaterialModel.uploader_role == "student",
            MaterialModel.subject_id.is_(None),
            MaterialModel.teacher_id == student_id,
        ).count(),
        "completedFlashcardDecks": AIGeneratedContentModel.query.filter(
            AIGeneratedContentModel.content_type == "Flashcard",
            AIGeneratedContentModel.generated_by == student_id,
        ).count(),
        "topicPerformances": topic_performances,
        "weakTopics": current_weak,
        "strongTopics": list(dict.fromkeys(strong)),
        "masteredTopics": mastered,
        "recentQuizAttempts": [a.to_dict() for a in attempts][:10],
    }
    return jsonify(payload)

@app.route("/api/recommendations/<student_id>", methods=["GET"])
@require_auth
def get_student_recommendations(student_id):
    """Personalized learning recommendations, shaped like src/types.ts Recommendation.

    Simple content-driven: each weak topic is paired with the first matching
    material, flashcard deck, reviewer, and quiz found in the library, with the
    difficulty derived from the student's actual per-topic accuracy.
    """
    current_user = getattr(request, "current_user", None) or {}
    if not _can_view_student_data(current_user, student_id):
        return jsonify({
            "error": "You do not have permission to view this student's recommendations.",
            "code": "FORBIDDEN",
        }), 403
    attempts = QuizAttemptModel.query.filter_by(student_id=student_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
    topic_map = _aggregate_topic_performance(attempts)

    stored_weak = []
    for att in attempts:
        try:
            stored_weak += json.loads(att.weak_topics_json) or []
        except Exception:
            continue
    stored_weak = list(dict.fromkeys(stored_weak))

    weak_topics = []
    for t, d in topic_map.items():
        if d["total"] > 0 and d["accuracyPercentage"] < MASTERY_THRESHOLD:
            weak_topics.append(t)
    if not weak_topics:
        weak_topics = stored_weak

    if not weak_topics:
        return jsonify([])

    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    def accuracy_for(topic):
        return topic_map.get(topic, {}).get("accuracyPercentage")

    def difficulty_for(acc):
        if acc is None or acc < 50:
            return "easy"
        if acc < 75:
            return "medium"
        return "hard"

    def steps_for(topic, diff, content):
        mat_target = content["material"]["id"] if content["material"] else content["subjectId"]
        quiz_target = content["quiz"]["id"] if content["quiz"] else content["subjectId"]
        return [
            {"step": 1, "type": "review", "title": f"Quick review: {topic}", "targetId": mat_target, "difficultyTarget": diff},
            {"step": 2, "type": "flashcard", "title": f"Concept flashcards: {topic}", "targetId": content["flashcardId"], "difficultyTarget": "easy"},
            {"step": 3, "type": "reviewer", "title": f"Targeted reviewer: {topic}", "targetId": content["reviewerId"], "difficultyTarget": diff},
            {"step": 4, "type": "quiz", "title": f"Adaptive {diff} quiz on {topic}", "targetId": quiz_target, "difficultyTarget": diff},
        ]

    recommendations = []
    for idx, topic in enumerate(weak_topics, start=1):
        acc = accuracy_for(topic)
        diff = difficulty_for(acc)
        content = _first_match_for_topic(topic)
        steps = steps_for(topic, diff, content)
        quiz_target = content["quiz"]["id"] if content["quiz"] else content["subjectId"]
        recommendations.append({
            "id": f"rec-{idx}",
            "studentId": student_id,
            "weakTopic": topic,
            "recommendationType": "quiz",
            "title": f"Adaptive Practice Quiz: {topic}",
            "description": f"You scored {acc if acc is not None else 'low'}% on {topic}. Retake a targeted {diff} quiz to reinforce these concepts.",
            "targetId": quiz_target,
            "difficultyTarget": diff,
            "accuracyPercentage": acc,
            "createdAt": now,
            "steps": steps,
        })
        recommendations.append({
            "id": f"rec-{idx + 10}",
            "studentId": student_id,
            "weakTopic": topic,
            "recommendationType": "reviewer",
            "title": f"Targeted Reviewer: {topic}",
            "description": f"Consolidate your understanding of {topic} with this focused reviewer before retaking quizzes.",
            "targetId": content["reviewerId"],
            "difficultyTarget": diff,
            "accuracyPercentage": acc,
            "createdAt": now,
            "steps": steps,
        })
    return jsonify(recommendations)


# --------------------------------------------------
# TEACHER ANALYTICS & ANNOUNCEMENTS
# --------------------------------------------------
@app.route("/api/analytics/teacher", methods=["GET"])
@require_auth
def get_teacher_analytics():
    """Class-level analytics for a teacher: per-subject rollups of student
    performance, weak topics, and at-risk students."""
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") not in ("teacher", "admin"):
        return jsonify({"error": "You do not have permission to view teacher analytics.", "code": "FORBIDDEN"}), 403

    teacher_id = request.args.get("teacherId", "") or ""
    if not teacher_id:
        return jsonify({"error": "teacherId is required.", "code": "BAD_REQUEST"}), 400
    if current_user.get("role") == "teacher" and current_user.get("id") != teacher_id:
        return jsonify({"error": "You can only view your own analytics.", "code": "FORBIDDEN"}), 403

    subjects = SubjectModel.query.filter_by(teacher_id=teacher_id).all()
    rows = []
    total_students = 0
    total_attempts = 0
    total_passed = 0
    total_at_risk = 0
    all_scores = []

    for sub in subjects:
        enrollments = StudentSubjectModel.query.filter_by(subject_id=sub.subject_id).all()
        student_ids = [e.student_id for e in enrollments]
        attempts = QuizAttemptModel.query.filter_by(subject_id=sub.subject_id).all()
        quiz_count = QuizModel.query.filter_by(subject_id=sub.subject_id).count()

        per_student_avg = {}
        for a in attempts:
            per_student_avg.setdefault(a.student_id, []).append(a.percentage)
        at_risk = []
        for sid in student_ids:
            scores = per_student_avg.get(sid, [])
            if not scores:
                continue
            avg = sum(scores) / len(scores)
            if avg < 70:
                stu = db.session.get(UserModel, sid)
                at_risk.append({"id": sid, "name": stu.first_name + " " + stu.last_name if stu else sid, "averageScore": round(avg)})

        weak = []
        for att in attempts:
            try: weak += json.loads(att.weak_topics_json) or []
            except Exception: pass
        weak_counts = {}
        for w in weak:
            weak_counts[w] = weak_counts.get(w, 0) + 1
        top_weak = [t for t, _ in sorted(weak_counts.items(), key=lambda kv: -kv[1])[:5]]

        avg = round(sum(a.percentage for a in attempts) / len(attempts)) if attempts else 0
        passed = sum(1 for a in attempts if a.passed)
        total_students += len(student_ids)
        total_attempts += len(attempts)
        total_passed += passed
        total_at_risk += len(at_risk)
        all_scores += [a.percentage for a in attempts]

        rows.append({
            "subjectId": sub.subject_id,
            "subjectCode": sub.subject_code,
            "subjectName": sub.subject_name,
            "teacherName": sub.teacher_name,
            "studentCount": len(student_ids),
            "quizCount": quiz_count,
            "attempts": len(attempts),
            "averageScore": avg,
            "passRate": round(passed / len(attempts) * 100) if attempts else 0,
            "weakTopics": top_weak,
            "atRiskStudents": at_risk,
        })

    return jsonify({
        "teacherId": teacher_id,
        "subjects": rows,
        "totals": {
            "subjectCount": len(subjects),
            "studentCount": total_students,
            "attempts": total_attempts,
            "averageScore": round(sum(all_scores) / len(all_scores)) if all_scores else 0,
            "passRate": round(total_passed / total_attempts * 100) if total_attempts else 0,
            "atRiskCount": total_at_risk,
        },
    }), 200

@app.route("/api/announcements", methods=["GET"])
@require_auth
def list_announcements():
    current_user = getattr(request, "current_user", None) or {}
    requester_id = current_user.get("id") or ""
    requester_role = current_user.get("role") or ""
    anns = AnnouncementModel.query.order_by(AnnouncementModel.created_at.desc()).all()
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
    return jsonify([a.to_dict() for a in anns])

@app.route("/api/announcements", methods=["POST"])
@require_roles("teacher", "admin")
def post_announcement():
    data = request.json or {}
    if not data.get("title"):
        return jsonify({"error": "Announcement title is required.", "code": "EMPTY_TITLE"}), 400
    current_user = getattr(request, "current_user", None) or {}
    author_id = current_user.get("id") or data.get("teacherId") or data.get("createdById") or "usr-admin-1"
    author_name = current_user.get("name") or data.get("authorName") or "Faculty"
    author_role = current_user.get("role") or "teacher"
    if author_role == "admin":
        return jsonify({"error": "Administrators have read-only access to announcements and cannot post them.", "code": "FORBIDDEN"}), 403
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
    # Server-stamp all timestamps: client-provided values (e.g. optimistic
    # placeholders like "Just now") are never persisted.
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    new_ann = AnnouncementModel(
        announcement_id=f"ann-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
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

@app.route("/api/announcements/<announcement_id>", methods=["PUT"])
@require_auth
def update_announcement(announcement_id):
    """Edit an existing announcement (author only).

    Editable: title, message/content, priority. Administrators authoring a
    notice may also change targetAudience. The subject cannot be changed: it
    defines who received the notice, so edits never silently re-target a
    different class.
    """
    ann = db.session.get(AnnouncementModel, announcement_id)
    if not ann:
        return jsonify({"error": "Announcement not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    is_admin = role == "admin"
    if is_admin:
        return jsonify({"error": "Administrators have read-only access to announcements and cannot edit them.", "code": "FORBIDDEN"}), 403
    is_author = bool(ann.teacher_id) and ann.teacher_id == current_user.get("id")
    if not is_author:
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
    if is_admin and "targetAudience" in data and data["targetAudience"]:
        ann.target_audience = data["targetAudience"]
        changed = True

    if not changed:
        return jsonify({"error": "Nothing to update.", "code": "NO_CHANGES"}), 400

    ann.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    _commit_or_warn("announcement update")
    log_action(current_user.get("id") or "unknown", current_user.get("name") or "Unknown",
               role, "ANNOUNCEMENT_UPDATED", f"Edited announcement '{ann.title}'")
    return jsonify(ann.to_dict()), 200

@app.route("/api/announcements/<announcement_id>", methods=["DELETE"])
@require_auth
def delete_announcement(announcement_id):
    ann = db.session.get(AnnouncementModel, announcement_id)
    if not ann:
        return jsonify({"error": "Announcement not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") == "admin":
        return jsonify({"error": "Administrators have read-only access to announcements and cannot delete them.", "code": "FORBIDDEN"}), 403
    is_author = bool(ann.teacher_id) and ann.teacher_id == current_user.get("id")
    if not is_author:
        return jsonify({"error": "You can only delete announcements you posted.", "code": "FORBIDDEN"}), 403
    db.session.delete(ann)
    _commit_or_warn("announcement deletion")
    log_action(current_user.get("id") or "unknown", current_user.get("name") or "Unknown",
               current_user.get("role") or "user", "ANNOUNCEMENT_DELETED",
               f"Deleted announcement '{ann.title}'")
    return jsonify({"success": True}), 200

# ----------------------------------------------------
# REPORTS & ANALYTICS (Module 7)
# ----------------------------------------------------

REPORT_TYPES = ("Student Performance", "Quiz Analytics", "Subject Summary", "AI Usage")

def _build_report_summary(report_type, target_id="", teacher_id=""):
    """Aggregates academic data into a structured report summary.

    When teacher_id is provided the report is scoped to that teacher's own
    subjects, students, quizzes, and AI-generated content.
    """
    subject_ids = set()
    teacher_quiz_ids = set()
    enrolled_student_ids = set()
    own_ai_query = None
    if teacher_id:
        subject_ids = {s.subject_id for s in SubjectModel.query.filter_by(teacher_id=teacher_id).all()}
        teacher_quiz_ids = {q.quiz_id for q in QuizModel.query.filter_by(teacher_id=teacher_id).all()}
        enrolled_student_ids = {
            e.student_id
            for e in StudentSubjectModel.query.all()
            if e.subject_id in subject_ids
        }
        own_ai_query = AIGeneratedContentModel.query.filter_by(generated_by=teacher_id)

    if report_type == "Student Performance":
        student = db.session.get(UserModel, target_id) if target_id else None
        if not student:
            return {"error": "A valid student is required for a Student Performance report.", "code": "BAD_REQUEST"}, 400
        if teacher_id and target_id not in enrolled_student_ids:
            return {"error": "This student is not enrolled in any of your subjects.", "code": "FORBIDDEN"}, 403
        attempts = QuizAttemptModel.query.filter_by(student_id=target_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
        if teacher_id:
            attempts = [a for a in attempts if a.subject_id in subject_ids or a.quiz_id in teacher_quiz_ids]
        total = len(attempts)
        avg = round(sum(a.percentage for a in attempts) / total) if total else 0
        passed = sum(1 for a in attempts if a.passed)
        weak, strong = [], []
        for att in attempts:
            try: weak += json.loads(att.weak_topics_json) or []
            except Exception: pass
            try: strong += json.loads(att.strong_topics_json) or []
            except Exception: pass
        progress_rows = StudentProgressModel.query.filter_by(student_id=target_id).all()
        summary = {
            "studentId": target_id,
            "studentName": (student.first_name or "") + (" " + student.last_name if student.last_name else ""),
            "quizzesTaken": total,
            "averageScore": avg,
            "passRate": round(passed / total * 100) if total else 0,
            "weakTopics": list(dict.fromkeys(weak)),
            "strongTopics": list(dict.fromkeys(strong)),
            "subjects": [
                {"subjectId": p.subject_id, "completionPercentage": p.completion_percentage, "averageScore": p.average_score, "learningLevel": p.learning_level}
                for p in progress_rows
            ],
            "recentAttempts": [a.to_dict() for a in attempts][:10],
        }
        return summary, 200

    if report_type == "Quiz Analytics":
        attempts = QuizAttemptModel.query.order_by(QuizAttemptModel.submitted_at.desc()).all()
        if teacher_id:
            attempts = [a for a in attempts if a.subject_id in subject_ids or a.quiz_id in teacher_quiz_ids]
        if target_id:
            attempts = [a for a in attempts if a.quiz_id == target_id]
        quiz_totals = {}
        for a in attempts:
            key = a.quiz_id
            q = quiz_totals.setdefault(key, {"quizId": key, "quizTitle": a.quiz_title, "subjectName": a.subject_name, "attempts": 0, "totalScore": 0.0, "passed": 0, "scores": []})
            q["attempts"] += 1
            q["totalScore"] += a.percentage
            q["passed"] += 1 if a.passed else 0
            q["scores"].append(a.percentage)
        quiz_rows = []
        for q in quiz_totals.values():
            quiz_rows.append({
                "quizId": q["quizId"],
                "quizTitle": q["quizTitle"],
                "subjectName": q["subjectName"],
                "attempts": q["attempts"],
                "averageScore": round(q["totalScore"] / q["attempts"]) if q["attempts"] else 0,
                "passRate": round(q["passed"] / q["attempts"] * 100) if q["attempts"] else 0,
                "highestScore": round(max(q["scores"])) if q["scores"] else 0,
                "lowestScore": round(min(q["scores"])) if q["scores"] else 0,
            })
        # Attempt-weighted overall average (not an average of per-quiz averages)
        weighted_avg = round(sum(a.percentage for a in attempts) / len(attempts)) if attempts else 0
        summary = {
            "totalAttempts": len(attempts),
            "quizzes": quiz_rows,
            "overallAverage": weighted_avg,
        }
        return summary, 200

    if report_type == "Subject Summary":
        subjects = SubjectModel.query.all()
        if teacher_id:
            subjects = [s for s in subjects if s.subject_id in subject_ids]
        if target_id:
            subjects = [s for s in subjects if s.subject_id == target_id]
        rows = []
        for sub in subjects:
            materials = MaterialModel.query.filter_by(subject_id=sub.subject_id).count()
            quizzes = QuizModel.query.filter_by(subject_id=sub.subject_id).count()
            attempts = QuizAttemptModel.query.filter_by(subject_id=sub.subject_id).all()
            avg = round(sum(a.percentage for a in attempts) / len(attempts)) if attempts else 0
            # AI items linked to this subject's mirrored materials
            material_rows = MaterialModel.query.filter_by(subject_id=sub.subject_id).all()
            material_ids = [m.material_id for m in material_rows]
            ai_items = AIGeneratedContentModel.query.filter(
                AIGeneratedContentModel.material_id.in_(material_ids)
            ).all() if material_ids else []
            ai_total = len(ai_items)
            rows.append({
                "subjectId": sub.subject_id,
                "subjectName": f"{sub.subject_code} - {sub.subject_name}",
                "teacherName": sub.teacher_name,
                "materials": materials,
                "quizzes": quizzes,
                "aiGeneratedItems": ai_total,
                "quizAttempts": len(attempts),
                "averageScore": avg,
            })
        summary = {"subjects": rows}
        return summary, 200

    # AI Usage
    items = own_ai_query.all() if own_ai_query is not None else AIGeneratedContentModel.query.all()
    by_type = {}
    for item in items:
        by_type[item.content_type] = by_type.get(item.content_type, 0) + 1
    if teacher_id:
        quiz_count = QuizModel.query.filter_by(teacher_id=teacher_id).count()
        ai_quiz_count = QuizModel.query.filter_by(teacher_id=teacher_id, quiz_type="student").count()
        generate_logs = ActivityLogModel.query.filter(
            ActivityLogModel.user_id == teacher_id,
            ActivityLogModel.activity.in_(["AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE"]),
        ).count()
    else:
        quiz_count = QuizModel.query.count()
        ai_quiz_count = QuizModel.query.filter_by(quiz_type="student").count()
        generate_logs = ActivityLogModel.query.filter(ActivityLogModel.activity.in_(["AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE"])).count()
    if ai_quiz_count:
        by_type = {**by_type, "Quiz": by_type.get("Quiz", 0) + ai_quiz_count}
    summary = {
        "totalGenerated": sum(by_type.values()),
        "quizCount": quiz_count,
        "generationEvents": generate_logs,
        "breakdown": {k: v for k, v in sorted(by_type.items(), key=lambda kv: -kv[1])},
    }
    return summary, 200

@app.route("/api/reports", methods=["GET"])
@require_roles("teacher", "admin")
def handle_reports():
    generated_by = request.args.get("generatedBy", "")
    report_type = request.args.get("reportType", "")
    query = ReportModel.query
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") == "student":
        # Students only ever see the reports they generated for themselves.
        query = query.filter_by(generated_by=current_user.get("id"))
    elif current_user.get("role") == "teacher":
        # Teachers only see reports they generated (no cross-teacher reads).
        query = query.filter_by(generated_by=current_user.get("id"))
    elif generated_by:
        query = query.filter_by(generated_by=generated_by)
    if report_type:
        query = query.filter_by(report_type=report_type)
    reports = query.order_by(ReportModel.generated_at.desc()).all()
    return jsonify([r.to_dict() for r in reports])

@app.route("/api/reports", methods=["POST"])
@require_roles("teacher", "admin")
def create_report():
    data = request.json or {}
    report_type = data.get("reportType") or ""
    if report_type not in REPORT_TYPES:
        return jsonify({"error": f"reportType must be one of: {', '.join(REPORT_TYPES)}.", "code": "INVALID_REPORT_TYPE"}), 400
    current_user = getattr(request, "current_user", None) or {}
    is_student = current_user.get("role") == "student"
    if is_student:
        # Students may only generate their own Student Performance report.
        if report_type != "Student Performance":
            return jsonify({"error": "Students can only generate a Student Performance report.", "code": "FORBIDDEN"}), 403
        data["targetId"] = current_user.get("id")
        data["teacherId"] = ""
    elif current_user.get("role") == "teacher":
        # Teachers are always scoped to their own subjects/students; a client
        # may not widen the scope by omitting or substituting teacherId.
        data["teacherId"] = current_user.get("id")
    summary, status = _build_report_summary(
        report_type,
        str(data.get("targetId") or ""),
        str(data.get("teacherId") or ""),
    )
    if status != 200:
        return jsonify(summary), status
    # Token identity wins over any client-supplied attribution
    generated_by = current_user.get("id") or data.get("generatedBy") or "usr-admin-1"
    timestamp_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    title = str(data.get("title") or f"{report_type} Report")
    report = ReportModel(
        report_id=f"rpt-{timestamp_ms}",
        generated_by=generated_by,
        report_type=report_type,
        generated_at=data.get("generatedAt") or (datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")),
        title=title,
        summary_json=json.dumps(summary, ensure_ascii=False),
        target_id=data.get("targetId"),
    )
    db.session.add(report)
    _commit_or_warn("report")
    log_action(generated_by, current_user.get("name") or "", current_user.get("role") or "teacher", "REPORT_GENERATE", f"Generated {report_type}: {title}")
    return jsonify(report.to_dict()), 201

@app.route("/api/reports/<report_id>", methods=["GET"])
@require_roles("teacher", "admin")
def handle_report_detail(report_id):
    report = db.session.get(ReportModel, report_id)
    if not report:
        return jsonify({"error": "Report not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") in ("student", "teacher") and report.generated_by != current_user.get("id"):
        return jsonify({"error": "You can only view reports you generated.", "code": "FORBIDDEN"}), 403
    return jsonify(report.to_dict()), 200

@app.route("/api/reports/<report_id>", methods=["DELETE"])
@require_roles("teacher", "admin")
def delete_report(report_id):
    report = db.session.get(ReportModel, report_id)
    if not report:
        return jsonify({"error": "Report not found.", "code": "NOT_FOUND"}), 404
    current_user = getattr(request, "current_user", None) or {}
    if current_user.get("role") != "admin" and report.generated_by != current_user.get("id"):
        return jsonify({"error": "You can only delete reports you generated.", "code": "FORBIDDEN"}), 403
    db.session.delete(report)
    _commit_or_warn("report deletion")
    return jsonify({"success": True}), 200

# --------------------------------------------------
# ACTIVITY LOG ROUTES
# --------------------------------------------------

# Actions considered part of "Learning Materials Moderation" in the admin UI.
MODERATION_LOG_CODES = [
    "MATERIAL_UPLOAD", "MATERIAL_UPDATE", "MATERIAL_DELETE", "MATERIAL_AI_SAVE",
    "AI_QUIZ_GENERATE", "AI_SUMMARY_GENERATE", "AI_REVIEWER_GENERATE", "AI_FLASHCARDS_GENERATE",
    "AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE",
    "FLASHCARD_UPDATE", "SUMMARY_UPDATE", "REVIEWER_UPDATE",
    "FLASHCARD_DELETE", "SUMMARY_DELETE", "REVIEWER_DELETE",
]
@app.route("/api/logs", methods=["GET"])
@require_roles("admin")
def get_activity_logs():
    try:
        page = max(1, int(request.args.get("page", 1) or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = max(1, min(500, int(request.args.get("limit", 25) or 25)))
    except (TypeError, ValueError):
        limit = 25

    query = ActivityLogModel.query

    # Role filter
    role = (request.args.get("role") or "").strip()
    if role:
        query = query.filter(ActivityLogModel.user_role == role)

    # Action filter (supports the special "__moderation__" umbrella)
    action = (request.args.get("action") or "").strip()
    if action:
        if action == "__moderation__":
            query = query.filter(ActivityLogModel.activity.in_(MODERATION_LOG_CODES))
        else:
            query = query.filter(ActivityLogModel.activity == action)

    # Free-text search across action, user name, details and IP
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                ActivityLogModel.activity.ilike(like),
                ActivityLogModel.user_name.ilike(like),
                ActivityLogModel.details.ilike(like),
                ActivityLogModel.ip_address.ilike(like),
            )
        )

    total = query.count()
    pages = max(1, (total + limit - 1) // limit)
    logs = (
        query.order_by(ActivityLogModel.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return jsonify({
        "logs": [l.to_dict() for l in logs],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    })

@app.route("/api/logs", methods=["POST"])
@require_roles("admin")
def add_activity_log():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or "usr-admin-1"
    user_name = current_user.get("name") or "System Administrator"
    user_role = "admin"
    action = data.get("action", "ADMIN_ACTION")
    details = data.get("details", "")
    log_action(user_id, user_name, user_role, action, details)
    return jsonify({"success": True})

@app.route("/api/logs", methods=["DELETE"])
@require_roles("admin")
def clear_activity_logs():
    try:
        ActivityLogModel.query.delete()
        log_action("usr-admin-1", "System", "admin", "LOGS_CLEARED", "Activity logs cleared by administrator")
    except Exception:
        pass
    return jsonify({"success": True}), 200

# ----------------------------------------------------
# SEED INITIAL DATABASE DATA (UC CCS Capstone Project Team)
# ----------------------------------------------------

def seed_database_if_empty():
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print("db.create_all notice:", e)
            return

        try:
            seed_roles_needed = (RoleModel.query.count() == 0)
            # Column-safe count: the ORM model may reference columns that only
            # exist after the migrations below (e.g. the auth-security columns),
            # so use a raw count here and let the _ensure_* migrations catch up.
            seed_users_needed = (db.session.execute(db.text("SELECT COUNT(*) FROM users")).scalar() == 0)
        except Exception as e:
            err_text = str(e)
            if "Unknown column" in err_text or "doesn't exist" in err_text or "no such column" in err_text:
                print("[Database] Existing database schema is from an older version and is incompatible with StudyLens.")
                print("[Database] To rebuild it with the current 14-table schema + capstone seed data, run: py scripts/reset_db.py --yes")
            else:
                print("[Database] Seeding skipped, database unavailable:", e)
            return

        # Bring existing databases up to the current schema (2FA columns)
        _ensure_users_2fa_columns()
        _ensure_auth_security_columns()
        _ensure_quiz_deadline_column()
        _ensure_notification_target_column()
        _normalize_avatar_placeholders()
        _purge_test_announcements()
        # Password auth is mandatory; heal seed accounts that lack a hash.
        _ensure_demo_passwords()
        # Provisioned demo accounts skip the registration email check.
        _ensure_demo_email_verified()
        # Run the 90-day audit archive pass on startup when enabled
        try:
            _enforce_archiving(_load_system_settings())
        except Exception:
            pass

        if seed_roles_needed:
            roles = [RoleModel(role_id=1, role_name="Student"), RoleModel(role_id=2, role_name="Teacher"), RoleModel(role_id=3, role_name="Administrator")]
            db.session.bulk_save_objects(roles)
            db.session.commit()

        if seed_users_needed:
            seed_users = [
                UserModel(user_id="usr-teacher-1", role_id=2, first_name="Christian C.", last_name="Barral, MIT", email="teacher@studylens.edu", role="teacher", department="College of Computer Studies", password_hash=generate_password_hash(DEMO_TEACHER_PASSWORD), created_at="2023-09-01T08:00:00.000Z"),
                UserModel(user_id="usr-admin-1", role_id=3, first_name="Neil A.", last_name="Basabe, DIT", email="admin@studylens.edu", role="admin", department="College of Computer Studies", password_hash=generate_password_hash(DEMO_ADMIN_PASSWORD), created_at="2023-08-01T08:00:00.000Z")
            ]
            db.session.bulk_save_objects(seed_users)

            seed_subs = [
                SubjectModel(subject_id="sub-101", subject_code="CS 301", subject_name="Data Structures & Algorithms", description="Fundamental data structures, search trees, graphs, sorting algorithms.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=51, material_count=2, created_at="2024-01-10T08:00:00.000Z"),
                SubjectModel(subject_id="sub-102", subject_code="AI 402", subject_name="Artificial Intelligence & Neural Networks", description="Machine learning, Groq GPT-OSS-120B inference, and deep learning.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=45, material_count=1, created_at="2024-01-12T08:00:00.000Z")
            
            ]
            db.session.bulk_save_objects(seed_subs)
            db.session.commit()
            print("[Database Seed] 14-table schema initialized with UC CCS Capstone seed data.")

if __name__ == "__main__":
    seed_database_if_empty()
    # Debug mode is opt-in ONLY (FLASK_DEBUG=true). The Werkzeug debugger is a
    # remote-code-execution vector on a public interface, so it is off by default.
    debug_mode = os.getenv("FLASK_DEBUG", "false").strip().lower() in ("1", "true", "yes", "on")
    print(f"StudyLens AI Python Flask Backend running on http://127.0.0.1:{PORT} (debug={debug_mode})")
    app.run(host="0.0.0.0", port=PORT, debug=debug_mode)
