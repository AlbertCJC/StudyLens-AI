import os
import io
import json
import jwt
import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

# Import Groq AI (GPT-OSS-120B) & Cloud Storage Services
from groq_service import (
    call_groq_ai,
    generate_quiz_with_groq,
    generate_flashcards_with_groq,
    generate_summary_with_groq,
    generate_reviewer_with_groq,
    explain_answer_with_groq,
    generate_recommendations_with_groq,
    reset_generation_source,
    generation_used_fallback,
    GroqAPIError
)
from cloud_storage import upload_file_to_cloud

# Load environment variables (path-independent: resolves .env from this file's folder
# regardless of which directory the Flask process is launched from).
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_UPLOADS_DIR = os.path.join(_BACKEND_DIR, "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)

app = Flask(__name__, static_folder=_UPLOADS_DIR, static_url_path="/uploads")
CORS(app)

# Configuration & Secrets
SECRET_KEY = os.getenv("JWT_SECRET", "studylens_ai_jwt_secret_key_2026")
PORT = int(os.getenv("FLASK_PORT", 5000))

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
            "department": self.department,
            "studentId": self.student_id,
            "status": self.status,
            "createdAt": self.created_at,
            "lastLogin": self.last_login
        }

class SubjectModel(db.Model):
    __tablename__ = "subjects"
    subject_id = db.Column(db.String(64), primary_key=True)
    teacher_id = db.Column(db.String(64), nullable=False)
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
    student_id = db.Column(db.String(64), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    date_enrolled = db.Column(db.String(64), nullable=False)

class MaterialModel(db.Model):
    __tablename__ = "learning_materials"
    material_id = db.Column(db.String(64), primary_key=True)
    subject_id = db.Column(db.String(64), nullable=False)
    teacher_id = db.Column(db.String(64), nullable=False)
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
        sub = SubjectModel.query.get(self.subject_id)
        if sub:
            subject_name = f"{sub.subject_code} - {sub.subject_name}"
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

class AIGeneratedContentModel(db.Model):
    __tablename__ = "ai_generated_content"
    content_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), nullable=True)
    generated_by = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(32), nullable=False)
    generated_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)

class QuizModel(db.Model):
    __tablename__ = "quizzes"
    quiz_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), nullable=True)
    teacher_id = db.Column(db.String(64), nullable=False)
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
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        try: qs = json.loads(self.questions_json)
        except Exception: qs = []
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
            "createdAt": self.created_at
        }

class QuizAttemptModel(db.Model):
    __tablename__ = "quiz_attempts"
    attempt_id = db.Column(db.String(64), primary_key=True)
    quiz_id = db.Column(db.String(64), nullable=False)
    student_id = db.Column(db.String(64), nullable=False)
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
    student_id = db.Column(db.String(64), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    average_score = db.Column(db.Float, default=0.0)
    learning_level = db.Column(db.String(32), default="Intermediate")
    updated_at = db.Column(db.String(64), nullable=False)
    last_activity = db.Column(db.String(64), nullable=False)

class NotificationModel(db.Model):
    __tablename__ = "notifications"
    notification_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    read_at = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        return {
            "id": self.notification_id,
            "userId": self.user_id,
            "title": self.title,
            "message": self.message,
            "isRead": bool(self.read_at),
            "createdAt": self.created_at
        }

class FlashcardDeckModel(db.Model):
    __tablename__ = "flashcard_decks"
    id = db.Column(db.String(64), primary_key=True)
    title = db.Column(db.String(256), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    material_id = db.Column(db.String(64), nullable=True)
    cards_json = db.Column(db.Text, nullable=False)
    is_published = db.Column(db.Boolean, default=True)
    created_by_id = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        try: cards = json.loads(self.cards_json)
        except Exception: cards = []
        return {
            "id": self.id,
            "title": self.title,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "materialId": self.material_id,
            "cards": cards,
            "isPublished": self.is_published,
            "createdById": self.created_by_id,
            "createdAt": self.created_at
        }

class SummaryModel(db.Model):
    __tablename__ = "summaries"
    id = db.Column(db.String(64), primary_key=True)
    title = db.Column(db.String(256), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    material_id = db.Column(db.String(64), nullable=True)
    executive_summary = db.Column(db.Text, nullable=False)
    key_takeaways_json = db.Column(db.Text, nullable=False)
    bullet_points_json = db.Column(db.Text, nullable=False)
    created_by_id = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        try: kt = json.loads(self.key_takeaways_json)
        except Exception: kt = []
        try: bp = json.loads(self.bullet_points_json)
        except Exception: bp = []
        return {
            "id": self.id,
            "title": self.title,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "materialId": self.material_id,
            "executiveSummary": self.executive_summary,
            "keyTakeaways": kt,
            "bulletPoints": bp,
            "createdById": self.created_by_id,
            "createdAt": self.created_at
        }

class ReviewerModel(db.Model):
    __tablename__ = "reviewers"
    id = db.Column(db.String(64), primary_key=True)
    title = db.Column(db.String(256), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    material_id = db.Column(db.String(64), nullable=True)
    overview = db.Column(db.Text, nullable=False)
    topics_json = db.Column(db.Text, nullable=False)
    created_by_id = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        try: tp = json.loads(self.topics_json)
        except Exception: tp = []
        return {
            "id": self.id,
            "title": self.title,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "materialId": self.material_id,
            "overview": self.overview,
            "topics": tp,
            "createdById": self.created_by_id,
            "createdAt": self.created_at
        }

class AnnouncementModel(db.Model):
    __tablename__ = "announcements"
    announcement_id = db.Column(db.String(64), primary_key=True)
    teacher_id = db.Column(db.String(64), nullable=True)
    subject_id = db.Column(db.String(64), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)
    updated_at = db.Column(db.String(64), nullable=True)
    posted_at = db.Column(db.String(64), nullable=True)
    author_name = db.Column(db.String(128), nullable=False, default="Faculty")
    target_audience = db.Column(db.String(32), default="all")
    priority = db.Column(db.String(32), default="medium")

    def to_dict(self):
        return {
            "id": self.announcement_id,
            "title": self.title,
            "content": self.message,
            "authorName": self.author_name,
            "targetAudience": self.target_audience,
            "priority": self.priority,
            "subjectId": self.subject_id,
            "createdAt": self.created_at
        }

class AnnouncementReadModel(db.Model):
    __tablename__ = "announcement_reads"
    announcement_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), primary_key=True)
    read_at = db.Column(db.String(64), nullable=False, default="")

class ReportModel(db.Model):
    __tablename__ = "reports"
    report_id = db.Column(db.String(64), primary_key=True)
    generated_by = db.Column(db.String(64), nullable=False)
    report_type = db.Column(db.String(100), nullable=False)
    generated_at = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)

class ActivityLogModel(db.Model):
    __tablename__ = "activity_logs"
    log_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), nullable=False)
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
            "timestamp": self.created_at
        }

# System settings state
system_settings_state = {
    "aiModel": "gpt-oss-120b (Groq Inference)",
    "maxTokens": 4096,
    "temperature": 0.7,
    "require2FA": False,
    "maintenanceMode": False,
    "sessionTimeoutMins": 60,
    "autoAuditArchiving": True
}

# ----------------------------------------------------
# JWT AUTHENTICATION DECORATORS
# ----------------------------------------------------

def generate_token(user_data):
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
        
        if not token:
            request.current_user = None
            return f(*args, **kwargs)

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user = UserModel.query.get(data["user_id"])
            request.current_user = user.to_dict() if user else None
        except Exception:
            request.current_user = None
            
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
        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "Authentication required. Please log in.", "code": "AUTH_REQUIRED"}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user = UserModel.query.get(data["user_id"])
            if not user:
                raise ValueError("Unknown user")
        except Exception:
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
            log_id=f"log-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            activity=action,
            details=details,
            ip_address=request.remote_addr or "127.0.0.1",
            device=request.user_agent.platform or "Web Browser",
            browser=request.user_agent.browser or "Chrome/Edge",
            created_at=datetime.datetime.utcnow().isoformat() + "Z"
        )
        db.session.add(log_item)
        db.session.commit()
    except Exception as e:
        print("Failed to record audit log:", e)

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

def _commit_or_warn(description):
    """Best-effort MySQL persistence: content is still returned if the DB write fails."""
    try:
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"[Database] Could not persist {description}: {e}")
        return False

def _json_loads(text):
    if not text:
        return []
    try:
        return json.loads(text)
    except Exception:
        return []

# Cap AI generation counts so single requests stay within the model's output-token budget.
MAX_AI_QUESTIONS = 20
MAX_AI_FLASHCARDS = 20

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

def _extract_text_from_file(file_bytes, ext):
    """Extracts readable text from an uploaded document (best-effort)."""
    ext = (ext or "").lower()
    try:
        if ext == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = []
            for page in reader.pages:
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
    except Exception as e:
        print(f"[Upload] Text extraction failed for extension .{ext}: {e}")
    return ""

def _save_ai_generated_content(generated_by, material_id, title, content_type, result):
    """Stores explain/recommendation outputs in the ai_generated_content table (best-effort)."""
    entry = AIGeneratedContentModel(
        content_id=f"ai-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        material_id=material_id,
        generated_by=generated_by,
        title=title,
        content_type=content_type,
        generated_text=json.dumps(result),
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(entry)
    _commit_or_warn(f"AI {content_type} content")

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

@app.route("/api/system/settings", methods=["GET", "POST"])
def system_settings():
    if request.method == "POST":
        data = request.json or {}
        system_settings_state.update(data)
        return jsonify(system_settings_state)
    return jsonify(system_settings_state)

# --- AUTH ROUTES ---
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.json or {}
    email = data.get("email")
    role = data.get("role")
    custom_user = data.get("user")

    email_str = email.strip() if isinstance(email, str) else (email.get("email", "").strip() if isinstance(email, dict) else "")

    user = UserModel.query.filter(db.func.lower(UserModel.email) == email_str.lower()).first() if email_str else None

    if not user and custom_user and custom_user.get("id"):
        user = UserModel.query.get(custom_user["id"])

    if not user and custom_user and custom_user.get("name"):
        user_id = custom_user.get("id") or f"usr-{custom_user.get('role', 'student')}-{int(datetime.datetime.utcnow().timestamp()*1000)}"
        names = custom_user.get("name", "").split(" ", 1)
        user = UserModel(
            user_id=user_id,
            first_name=names[0],
            last_name=names[1] if len(names) > 1 else "",
            email=email_str or custom_user.get("email", f"user{user_id}@studylens.edu"),
            role=custom_user.get("role", "student"),
            department=custom_user.get("department", "Computer Science"),
            student_id=custom_user.get("studentId"),
            status="active",
            created_at=datetime.datetime.utcnow().isoformat() + "Z"
        )
        db.session.add(user)
        db.session.commit()

    if not user and role:
        user = UserModel.query.filter_by(role=role).first()

    if not user:
        return jsonify({"error": "No account found in user directory."}), 401

    user_dict = user.to_dict()
    token = generate_token(user_dict)
    log_action(user.user_id, user_dict["name"], user.role, "USER_LOGIN", f"User {user_dict['name']} ({user.email}) logged in with JWT token")

    return jsonify({"token": token, "user": user_dict})

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()
    role = "teacher" if data.get("role") == "teacher" else "student"

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
        user_id=f"usr-{role}-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        first_name=names[0] if names else "Registered",
        last_name=names[1] if len(names) > 1 else "User",
        email=email,
        role=role,
        department=data.get("department") or ("Computer Science" if role == "student" else "Computer Science & IT"),
        student_id=data.get("studentId") or (f"2024-STU-{int(datetime.datetime.utcnow().timestamp()) % 8999 + 1000}" if role == "student" else None),
        status="active",
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_user)
    db.session.commit()

    user_dict = new_user.to_dict()
    token = generate_token(user_dict)
    log_action(new_user.user_id, user_dict["name"], new_user.role, "USER_REGISTER", f"Registered new {role} account: {email}")

    return jsonify({"token": token, "user": user_dict})

# --- USERS ---
@app.route("/api/users", methods=["GET"])
@app.route("/api/users/", methods=["GET"])
def get_users():
    users = UserModel.query.all()
    return jsonify([u.to_dict() for u in users])

# --- SUBJECTS ---
@app.route("/api/subjects", methods=["GET"])
@token_required
def get_subjects():
    current_user = getattr(request, "current_user", None) or {}
    requester_role = current_user.get("role") or request.args.get("userRole", "")
    requester_id = current_user.get("id") or request.args.get("userId", "")

    subs = SubjectModel.query.all()

    # Privacy Rule: teachers only see the subjects they are assigned to manage.
    if requester_role == "teacher":
        subs = [s for s in subs if s.teacher_id == requester_id]

    return jsonify([s.to_dict() for s in subs])

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

    teacher = UserModel.query.get(teacher_id)
    if not teacher:
        return jsonify({"error": "Assigned teacher account was not found.", "code": "BAD_REQUEST"}), 400
    if teacher.role != "teacher":
        return jsonify({"error": "Only a teacher account can be assigned to manage a subject.", "code": "BAD_REQUEST"}), 400

    if SubjectModel.query.filter_by(subject_code=code).first():
        return jsonify({"error": f"A subject with code '{code}' already exists.", "code": "DUPLICATE"}), 409

    new_sub = SubjectModel(
        subject_id=f"sub-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
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
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_sub)
    _commit_or_warn("subject creation")
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_CREATE", f"Created subject '{code} - {name}' and assigned {teacher.to_dict()['name']}")
    return jsonify(new_sub.to_dict()), 201

@app.route("/api/subjects/<subject_id>", methods=["PUT"])
@require_roles("admin")
def update_subject(subject_id):
    sub = SubjectModel.query.get(subject_id)
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
        teacher = UserModel.query.get(new_teacher_id)
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
    sub = SubjectModel.query.get(subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    code_name = f"{sub.subject_code} - {sub.subject_name}"
    try:
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
    sub = SubjectModel.query.get(subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Access rule: admins, or the teacher assigned to manage this subject.
    if role != "admin" and not (role == "teacher" and user_id == sub.teacher_id):
        return jsonify({"error": "You are not authorized to view this subject.", "code": "FORBIDDEN"}), 403

    return jsonify(sub.to_dict()), 200

@app.route("/api/subjects/<subject_id>/students", methods=["GET"])
@require_auth
def get_subject_students(subject_id):
    sub = SubjectModel.query.get(subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Access rule: admins, or the teacher assigned to manage this subject.
    if role != "admin" and not (role == "teacher" and user_id == sub.teacher_id):
        return jsonify({"error": "You are not authorized to view this subject roster.", "code": "FORBIDDEN"}), 403

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    students = []
    for en in enrollments:
        student = UserModel.query.get(en.student_id)
        if student:
            students.append({
                "id": student.user_id,
                "name": student.to_dict()["name"],
                "email": student.email,
                "studentId": student.student_id,
                "dateEnrolled": en.date_enrolled
            })
    students.sort(key=lambda s: s["name"].lower())
    return jsonify(students), 200

# --- MATERIALS ---
@app.route("/api/materials", methods=["GET"])
@token_required
def get_materials():
    current_user = getattr(request, "current_user", None) or {}
    requester_role = current_user.get("role") or request.args.get("userRole", "")
    requester_id = current_user.get("id") or request.args.get("userId", "")

    mats = MaterialModel.query.all()

    # Privacy Rule: teachers only see materials belonging to the subjects they manage
    # (plus their own personal notes). Admins and students see the full catalog.
    if requester_role == "teacher":
        managed_subject_ids = {
            s.subject_id for s in SubjectModel.query.filter_by(teacher_id=requester_id).all()
        }
        mats = [
            m for m in mats
            if m.subject_id == "personal" or m.subject_id in managed_subject_ids
        ]

    return jsonify([m.to_dict() for m in mats])

@app.route("/api/materials/upload", methods=["POST"])
def upload_material():
    file = request.files.get("file")
    filename = file.filename if file else "note.txt"
    file_bytes = file.read() if file else None

    title = request.form.get("title") or os.path.splitext(filename)[0]
    description = request.form.get("description", "Uploaded lecture notes")
    subject_id = request.form.get("subjectId", "sub-101")
    uploaded_by = request.form.get("uploadedBy", "Christian C. Barral, MIT")
    uploader_role = request.form.get("uploaderRole", "teacher")
    uploader_id = request.form.get("uploaderId", "usr-teacher-1")
    material_type = request.form.get("materialType", "course")
    text_input = request.form.get("textInput", "").strip()

    if file_bytes is None and not text_input:
        return jsonify({"error": "No file or text content provided"}), 400

    sub = SubjectModel.query.get(subject_id)

    # Ownership rule: a teacher may only upload course material to a subject they
    # are assigned to manage. Admins may upload anywhere. Personal notes bypass subjects.
    if uploader_role == "teacher" and subject_id != "personal":
        if not sub:
            return jsonify({"error": "Selected subject was not found.", "code": "NOT_FOUND"}), 404
        if sub.teacher_id != uploader_id:
            return jsonify({"error": "You can only upload materials to a subject assigned to you.", "code": "FORBIDDEN"}), 403

    cloud_url = None
    file_html_ext = os.path.splitext(filename)[1].replace(".", "").lower() or "txt"

    if file_bytes:
        cloud_url = upload_file_to_cloud(file_bytes, filename)

    file_size = f"{len(file_bytes)//1024} KB" if file_bytes else "—"

    file_ext = file_html_ext
    if file_ext == "doc":
        file_ext = "docx"

    extracted_text = _extract_text_from_file(file_bytes, file_ext) if file_bytes else ""
    if not extracted_text:
        extracted_text = _clean_extracted_text(text_input)
    if not extracted_text:
        extracted_text = _clean_extracted_text(f"{title}. {description}")

    new_mat = MaterialModel(
        material_id=f"mat-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        subject_id=subject_id,
        teacher_id=uploader_id,
        title=title,
        description=description,
        file_url=cloud_url,
        file_type=file_ext,
        file_size=file_size,
        extracted_text=extracted_text,
        uploaded_at=datetime.datetime.utcnow().isoformat() + "Z",
        material_type=material_type,
        uploaded_by=uploaded_by,
        uploader_role=uploader_role
    )

    db.session.add(new_mat)
    if sub: sub.material_count += 1
    db.session.commit()

    log_action(uploader_id, uploaded_by, uploader_role, "MATERIAL_UPLOAD", f"Uploaded '{title}' ({file_ext}) to Cloud Storage")
    return jsonify(new_mat.to_dict()), 201

@app.route("/api/materials/<material_id>", methods=["PUT"])
@token_required
def update_material(material_id):
    mat = MaterialModel.query.get(material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Ownership rule: teachers may only edit materials in subjects they manage.
    if role == "teacher" and mat.subject_id != "personal":
        subject = SubjectModel.query.get(mat.subject_id)
        if not subject or subject.teacher_id != user_id:
            return jsonify({"error": "You can only edit materials from a subject assigned to you.", "code": "FORBIDDEN"}), 403

    data = request.json or {}

    new_title = (data.get("title") or "").strip()
    if new_title:
        mat.title = new_title
    if data.get("description") is not None:
        mat.description = data.get("description")

    text_input = (data.get("textInput") or "").strip()
    if text_input:
        mat.extracted_text = _clean_extracted_text(text_input)

    _commit_or_warn("material update")
    log_action(user_id or mat.teacher_id, mat.uploaded_by, mat.uploader_role, "MATERIAL_UPDATE", f"Updated '{mat.title}'")
    return jsonify(mat.to_dict()), 200

@app.route("/api/materials/<material_id>", methods=["DELETE"])
@token_required
def delete_material(material_id):
    mat = MaterialModel.query.get(material_id)
    if not mat:
        return jsonify({"error": "Material not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Ownership rule: teachers may only delete materials in subjects they manage.
    if role == "teacher" and mat.subject_id != "personal":
        subject = SubjectModel.query.get(mat.subject_id)
        if not subject or subject.teacher_id != user_id:
            return jsonify({"error": "You can only delete materials from a subject assigned to you.", "code": "FORBIDDEN"}), 403

    subject = SubjectModel.query.get(mat.subject_id)
    if subject and subject.material_count and subject.material_count > 0:
        subject.material_count -= 1
    db.session.delete(mat)
    _commit_or_warn("material deletion")
    log_action(mat.teacher_id, mat.uploaded_by, mat.uploader_role, "MATERIAL_DELETE", f"Deleted '{mat.title}'")
    return jsonify({"success": True}), 200

# --- GROQ AI (GPT-OSS-120B) ASSESSMENTS ---
@app.route("/api/quizzes/generate", methods=["POST"])
def generate_quiz_ai():
    data = request.json or {}
    text_content = data.get("textContent", "Graph traversal BFS and DFS algorithms.")
    num_questions = _clamp_count(data.get("numQuestions", 5), fallback=5, maximum=MAX_AI_QUESTIONS)
    difficulty = data.get("difficulty", "medium")
    
    questions = generate_quiz_with_groq(text_content, num_questions=num_questions, difficulty=difficulty)
    
    new_quiz = QuizModel(
        quiz_id=f"quiz-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        title=data.get("title", f"AI Quiz: {text_content[:30]}..."),
        description="Automated Bloom's Taxonomy Quiz generated via Groq Inference (GPT-OSS-120B).",
        subject_id=data.get("subjectId", "sub-101"),
        subject_name=data.get("subjectName", "Data Structures & Algorithms"),
        material_id=data.get("materialId"),
        teacher_id=data.get("createdById", "usr-teacher-1"),
        created_by_name=data.get("createdByName", "Christian C. Barral, MIT"),
        quiz_type=data.get("quizType", "teacher"),
        questions_json=json.dumps(questions),
        is_published=True,
        time_limit_minutes=15,
        pass_percentage=70,
        difficulty=difficulty,
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_quiz)
    if not _commit_or_warn("AI quiz"):
        return jsonify({"error": "Could not save the quiz. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    
    log_action(new_quiz.teacher_id, new_quiz.created_by_name, new_quiz.quiz_type, "AI_QUIZ_GENERATE", f"Generated {len(questions)} items via Groq GPT-OSS-120B")

    return jsonify(new_quiz.to_dict()), 201

@app.route("/api/flashcards/generate", methods=["POST"])
def generate_flashcards_ai():
    data = request.json or {}
    text_content = data.get("textContent", "Key concepts of data structures.")
    card_count = _clamp_count(data.get("cardCount", 5), fallback=5, maximum=MAX_AI_FLASHCARDS)
    cards = generate_flashcards_with_groq(text_content, count=card_count)
    
    new_deck = FlashcardDeckModel(
        id=f"deck-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        title=data.get("title", f"Flashcards: {text_content[:25]}..."),
        subject_id=data.get("subjectId", "sub-101"),
        subject_name=data.get("subjectName", "Data Structures"),
        material_id=data.get("materialId"),
        cards_json=json.dumps(cards),
        is_published=True,
        created_by_id=data.get("createdById", "usr-student-1"),
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_deck)
    if not _commit_or_warn("AI flashcard deck"):
        return jsonify({"error": "Could not save the flashcard deck. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    return jsonify(new_deck.to_dict()), 201

@app.route("/api/summaries/generate", methods=["POST"])
def generate_summary_ai():
    data = request.json or {}
    text_content = data.get("textContent", "Lecture material summary.")
    summary_data = generate_summary_with_groq(text_content)
    
    new_sum = SummaryModel(
        id=f"sum-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        title=data.get("title", f"Summary: {text_content[:30]}..."),
        subject_id=data.get("subjectId", "sub-101"),
        subject_name=data.get("subjectName", "CS 301"),
        material_id=data.get("materialId"),
        executive_summary=summary_data.get("executiveSummary", ""),
        key_takeaways_json=json.dumps(summary_data.get("keyTakeaways", [])),
        bullet_points_json=json.dumps(summary_data.get("bulletPoints", [])),
        created_by_id=data.get("createdById", "usr-teacher-1"),
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_sum)
    if not _commit_or_warn("AI summary"):
        return jsonify({"error": "Could not save the summary. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    return jsonify(new_sum.to_dict()), 201

@app.route("/api/reviewers/generate", methods=["POST"])
def generate_reviewer_ai():
    data = request.json or {}
    text_content = data.get("textContent", "Study material reviewer.")
    reviewer = generate_reviewer_with_groq(text_content)

    new_rev = ReviewerModel(
        id=f"rev-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        title=data.get("title", f"Reviewer: {text_content[:30]}..."),
        subject_id=data.get("subjectId", "sub-101"),
        subject_name=data.get("subjectName", "General Subject"),
        material_id=data.get("materialId"),
        overview=reviewer.get("overview", ""),
        topics_json=json.dumps(reviewer.get("topics", [])),
        created_by_id=data.get("createdById", "usr-teacher-1"),
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_rev)
    if not _commit_or_warn("AI reviewer"):
        return jsonify({"error": "Could not save the reviewer. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(new_rev.created_by_id, data.get("createdByName", "User"), data.get("userRole", "teacher"), "AI_REVIEWER_GENERATE", f"Generated a {len(reviewer.get('topics', []))}-topic study reviewer via Groq GPT-OSS-120B")
    return jsonify(new_rev.to_dict()), 201

def _build_generated_resource(mode, data, text_content, timestamp_ms, created_at):
    """Generates AI content and returns it as a dict (shaped like the model to_dict).

    Used both for preview (save=False) and as the payload for /api/ai/save.
    """
    subject_id = data.get("subjectId") or "sub-101"
    subject_name = data.get("subjectName") or "General Subject"
    created_by_id = data.get("createdById") or "usr-teacher-1"
    created_by_name = data.get("createdByName") or "User"
    material_id = data.get("materialId")
    difficulty = data.get("difficulty", "medium")
    instructions = data.get("instructions") or ""

    if mode == "quiz":
        num_questions = _clamp_count(data.get("quizCount") or data.get("numQuestions") or 5, fallback=5, maximum=MAX_AI_QUESTIONS)
        questions = generate_quiz_with_groq(
            text_content, num_questions=num_questions, difficulty=difficulty, instructions=instructions
        )
        return {
            "id": f"quiz-{timestamp_ms}",
            "title": data.get("title", f"AI Quiz: {_trim_preview(text_content)}..."),
            "description": "Automated Bloom's Taxonomy Quiz generated via Groq Inference (GPT-OSS-120B).",
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "createdById": created_by_id,
            "createdByName": created_by_name,
            "quizType": data.get("quizType") or ("teacher" if data.get("userRole") == "teacher" else "student"),
            "questions": questions,
            "isPublished": True,
            "timeLimitMinutes": 15,
            "passPercentage": 70,
            "difficulty": difficulty,
            "createdAt": created_at
        }
    if mode == "flashcards":
        card_count = _clamp_count(data.get("flashcardCount") or data.get("cardCount") or 5, fallback=5, maximum=MAX_AI_FLASHCARDS)
        cards = generate_flashcards_with_groq(text_content, count=card_count, instructions=instructions)
        return {
            "id": f"deck-{timestamp_ms}",
            "title": data.get("title", f"Flashcards: {_trim_preview(text_content, 25)}..."),
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "cards": cards,
            "isPublished": True,
            "createdById": created_by_id,
            "createdAt": created_at
        }
    if mode == "summary":
        summary_data = generate_summary_with_groq(text_content, instructions=instructions)
        return {
            "id": f"sum-{timestamp_ms}",
            "title": data.get("title", f"Summary: {_trim_preview(text_content)}..."),
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "executiveSummary": summary_data.get("executiveSummary", ""),
            "keyTakeaways": summary_data.get("keyTakeaways", []),
            "bulletPoints": summary_data.get("bulletPoints", []),
            "createdById": created_by_id,
            "createdAt": created_at
        }
    if mode == "reviewer":
        reviewer = generate_reviewer_with_groq(text_content, instructions=instructions)
        return {
            "id": f"rev-{timestamp_ms}",
            "title": data.get("title", f"Reviewer: {_trim_preview(text_content)}..."),
            "subjectId": subject_id,
            "subjectName": subject_name,
            "materialId": material_id,
            "overview": reviewer.get("overview", ""),
            "topics": reviewer.get("topics", []),
            "createdById": created_by_id,
            "createdAt": created_at
        }
    return None


def _trim_preview(text, max_len=30):
    text = (text or "").strip()
    return text if len(text) <= max_len else text[:max_len].rstrip() + "..."


def _persist_generated_resource(mode, payload, data, timestamp_ms, created_at):
    """Persists a generated AI resource dict (idempotent). Returns the saved model or None."""
    resource_id = payload.get("id")
    subject_id = payload.get("subjectId") or "sub-101"
    subject_name = payload.get("subjectName") or "General Subject"
    material_id = payload.get("materialId")
    created_by_id = payload.get("createdById") or "usr-teacher-1"
    saved_at = payload.get("createdAt") or created_at

    if mode == "quiz":
        existing = QuizModel.query.get(resource_id) if resource_id else None
        if existing:
            return existing
        new_model = QuizModel(
            quiz_id=resource_id or f"quiz-{timestamp_ms}",
            title=payload.get("title", "AI Quiz"),
            description=payload.get("description", "Automated Bloom's Taxonomy Quiz."),
            subject_id=subject_id,
            subject_name=subject_name,
            material_id=material_id,
            teacher_id=created_by_id,
            created_by_name=payload.get("createdByName") or data.get("createdByName") or "User",
            quiz_type=payload.get("quizType") or "student",
            questions_json=json.dumps(payload.get("questions", [])),
            is_published=bool(payload.get("isPublished", True)),
            time_limit_minutes=int(payload.get("timeLimitMinutes") or 15),
            pass_percentage=int(payload.get("passPercentage") or 70),
            difficulty=payload.get("difficulty", "medium"),
            created_at=saved_at
        )
    elif mode == "flashcards":
        existing = FlashcardDeckModel.query.get(resource_id) if resource_id else None
        if existing:
            return existing
        new_model = FlashcardDeckModel(
            id=resource_id or f"deck-{timestamp_ms}",
            title=payload.get("title", "Flashcards"),
            subject_id=subject_id,
            subject_name=subject_name,
            material_id=material_id,
            cards_json=json.dumps(payload.get("cards", [])),
            is_published=bool(payload.get("isPublished", True)),
            created_by_id=created_by_id,
            created_at=saved_at
        )
    elif mode == "summary":
        existing = SummaryModel.query.get(resource_id) if resource_id else None
        if existing:
            return existing
        new_model = SummaryModel(
            id=resource_id or f"sum-{timestamp_ms}",
            title=payload.get("title", "AI Summary"),
            subject_id=subject_id,
            subject_name=subject_name,
            material_id=material_id,
            executive_summary=payload.get("executiveSummary", ""),
            key_takeaways_json=json.dumps(payload.get("keyTakeaways", [])),
            bullet_points_json=json.dumps(payload.get("bulletPoints", [])),
            created_by_id=created_by_id,
            created_at=saved_at
        )
    elif mode == "reviewer":
        existing = ReviewerModel.query.get(resource_id) if resource_id else None
        if existing:
            return existing
        new_model = ReviewerModel(
            id=resource_id or f"rev-{timestamp_ms}",
            title=payload.get("title", "AI Reviewer"),
            subject_id=subject_id,
            subject_name=subject_name,
            material_id=material_id,
            overview=payload.get("overview", ""),
            topics_json=json.dumps(payload.get("topics", [])),
            created_by_id=created_by_id,
            created_at=saved_at
        )
    else:
        return None

    db.session.add(new_model)
    if not _commit_or_warn(f"AI {mode} save"):
        return None
    return new_model


@app.route("/api/ai/generate", methods=["POST"])
def generate_ai_resource():
    """Unified generation endpoint used by the web AI Study Assistant.

    When `save` is false (default for the web generator) no record is persisted;
    the user previews the result and decides to save it later via /api/ai/save.
    """
    data = request.json or {}
    mode = data.get("mode", "quiz")
    text_content = data.get("text", "") or data.get("textContent", "")

    if not text_content or not text_content.strip():
        return jsonify({"error": "No source text provided.", "code": "EMPTY_TEXT"}), 400

    timestamp_ms = int(datetime.datetime.utcnow().timestamp() * 1000)
    created_at = datetime.datetime.utcnow().isoformat() + "Z"

    reset_generation_source()
    payload = _build_generated_resource(mode, data, text_content, timestamp_ms, created_at)
    if payload is None:
        return jsonify({"error": f"Unknown generation mode: {mode}", "code": "INVALID_MODE"}), 400
    if generation_used_fallback():
        # The cloud AI provider was unavailable/billing-gated; these results came from
        # content-derived offline generation. Surface it so the UI can show a notice.
        payload["source"] = "offline-fallback"

    save = bool(data.get("save", True))
    if not save:
        # Return the generated resource as a draft WITHOUT persisting it.
        return jsonify({"saved": False, **payload}), 200

    saved = _persist_generated_resource(mode, payload, data, timestamp_ms, created_at)
    if saved is None:
        return jsonify({"error": "Could not save the generated resource. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500

    user_role = data.get("userRole") or "student"
    created_by_id = payload.get("createdById") or "usr-teacher-1"
    created_by_name = data.get("createdByName") or "User"
    action_map = {
        "quiz": ("AI_QUIZ_GENERATE", f"Generated {len(payload.get('questions', []))} items via Groq GPT-OSS-120B"),
        "flashcards": ("AI_FLASHCARDS_GENERATE", f"Generated {len(payload.get('cards', []))} cards via Groq GPT-OSS-120B"),
        "summary": ("AI_SUMMARY_GENERATE", "Generated executive summary via Groq GPT-OSS-120B"),
        "reviewer": ("AI_REVIEWER_GENERATE", f"Generated a {len(payload.get('topics', []))}-topic study reviewer via Groq GPT-OSS-120B"),
    }
    action, detail = action_map.get(mode, ("AI_RESOURCE_GENERATE", "Generated an AI study resource"))
    log_action(created_by_id, created_by_name, user_role, action, detail)
    return jsonify(saved.to_dict()), 201


@app.route("/api/ai/save", methods=["POST"])
def save_ai_resource():
    """Saves a previously generated (non-persisted) AI resource draft."""
    data = request.json or {}
    mode = data.get("mode")
    if mode not in ("quiz", "flashcards", "summary", "reviewer"):
        return jsonify({"error": "Missing or invalid mode.", "code": "INVALID_MODE"}), 400

    timestamp_ms = int(datetime.datetime.utcnow().timestamp() * 1000)
    created_at = datetime.datetime.utcnow().isoformat() + "Z"

    saved = _persist_generated_resource(mode, data, data, timestamp_ms, created_at)
    if saved is None:
        return jsonify({"error": "Could not save the resource. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500

    created_by_id = data.get("createdById") or "usr-teacher-1"
    created_by_name = data.get("createdByName") or "User"
    user_role = data.get("userRole") or data.get("quizType") or "student"
    log_action(created_by_id, created_by_name, user_role, "AI_RESOURCE_SAVE", f"Saved generated {mode} to the library.")
    return jsonify(saved.to_dict()), 201

@app.route("/api/ai/explain", methods=["POST"])
def explain_answer_ai():
    """Generates a plain-language explanation of a quiz item for a student."""
    data = request.json or {}
    question = data.get("question") or ""
    options = data.get("options") or []
    correct_index = int(data.get("correctAnswer", 0))
    selected_index = int(data.get("selectedAnswer", 0))
    text_context = data.get("context") or data.get("textContent") or ""

    if not question:
        return jsonify({"error": "No question provided.", "code": "EMPTY_TEXT"}), 400

    result = explain_answer_with_groq(question, options, correct_index, selected_index, text_context)
    _save_ai_generated_content(data.get("createdById") or "usr-student-1", data.get("materialId"), "Answer Explanation", "explanation", result)
    return jsonify(result), 200

@app.route("/api/ai/recommendations", methods=["POST"])
def ai_personalized_recommendations():
    """Personalized learning recommendations derived from stored quiz analytics."""
    data = request.json or {}
    student_id = data.get("studentId") or "usr-student-1"
    subject_id = data.get("subjectId")
    profile = _build_student_learning_profile(student_id, subject_id)
    result = generate_recommendations_with_groq(profile)
    _save_ai_generated_content(student_id, None, "Personalized Learning Recommendations", "recommendation", result)
    return jsonify(result), 200

@app.route("/api/quizzes", methods=["GET"])
def get_quizzes():
    qs = QuizModel.query.all()
    requester_id = request.args.get("studentId") or request.args.get("userId") or ""
    # Privacy Rule: Personal practice quizzes (quizType "student") are strictly
    # private to their creator. Teacher/course quizzes are public to all users.
    if not requester_id:
        qs = [q for q in qs if q.quiz_type != "student"]
    else:
        qs = [q for q in qs if q.quiz_type != "student" or q.teacher_id == requester_id]
    return jsonify([q.to_dict() for q in qs])

@app.route("/api/quizzes", methods=["POST"])
def create_quiz():
    data = request.json or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Quiz title is required.", "code": "BAD_REQUEST"}), 400

    subject_id = data.get("subjectId") or "sub-101"
    subject = SubjectModel.query.get(subject_id)
    subject_name = data.get("subjectName")
    if not subject_name and subject:
        subject_name = f"{subject.subject_code} - {subject.subject_name}"

    created_by_id = data.get("createdById") or (data.get("created_by_id") or "usr-teacher-1")
    created_by_name = data.get("createdByName") or (data.get("created_by_name") or "User")
    quiz_type = data.get("quizType") or ("teacher" if str(created_by_id).startswith("usr-teacher") else "student")
    questions = data.get("questions") or []
    if not isinstance(questions, list):
        return jsonify({"error": "questions must be a list.", "code": "BAD_REQUEST"}), 400

    new_quiz = QuizModel(
        quiz_id=f"quiz-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
        teacher_id=created_by_id,
        title=title,
        description=data.get("description"),
        status="active",
        subject_id=subject_id,
        subject_name=subject_name or "General",
        created_by_name=created_by_name,
        quiz_type=quiz_type,
        questions_json=json.dumps(questions),
        is_published=bool(data.get("isPublished", quiz_type == "teacher")),
        time_limit_minutes=int(data.get("timeLimitMinutes") or 15),
        pass_percentage=int(data.get("passPercentage") or 70),
        difficulty=data.get("difficulty") or "medium",
        created_at=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.session.add(new_quiz)
    _commit_or_warn("quiz creation")
    log_action(created_by_id, created_by_name, quiz_type, "QUIZ_CREATE", f"Created quiz '{title}'")
    return jsonify(new_quiz.to_dict()), 201

@app.route("/api/quizzes/<quiz_id>", methods=["PUT"])
@token_required
def update_quiz(quiz_id):
    quiz = QuizModel.query.get(quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Ownership rule: teachers may only edit quizzes in subjects they manage.
    if role == "teacher" and quiz.subject_id and quiz.subject_id != "personal":
        subject = SubjectModel.query.get(quiz.subject_id)
        if not subject or subject.teacher_id != user_id:
            return jsonify({"error": "You can only edit quizzes from a subject assigned to you.", "code": "FORBIDDEN"}), 403

    data = request.json or {}
    if "title" in data and data.get("title"):
        quiz.title = data["title"]
    if "description" in data:
        quiz.description = data.get("description")
    if "subjectId" in data:
        quiz.subject_id = data["subjectId"]
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
    if "questions" in data:
        qs = data.get("questions") or []
        if not isinstance(qs, list):
            return jsonify({"error": "questions must be a list.", "code": "BAD_REQUEST"}), 400
        quiz.questions_json = json.dumps(qs)
    if "isPublished" in data:
        quiz.is_published = bool(data.get("isPublished"))

    _commit_or_warn("quiz update")
    log_action(user_id or quiz.created_by_id, quiz.created_by_name or "", quiz.quiz_type or "teacher", "QUIZ_UPDATE", f"Updated quiz '{quiz.title}'")
    return jsonify(quiz.to_dict()), 200

@app.route("/api/quizzes/<quiz_id>", methods=["DELETE"])
def delete_quiz(quiz_id):
    quiz = QuizModel.query.get(quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404
    db.session.delete(quiz)
    _commit_or_warn("quiz deletion")
    return jsonify({"success": True}), 200

@app.route("/api/quizzes/<quiz_id>/submit", methods=["POST"])
def submit_quiz_attempt(quiz_id):
    """Grades a submitted quiz and persists a QuizAttempt for analytics."""
    quiz = QuizModel.query.get(quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found.", "code": "NOT_FOUND"}), 404

    try:
        questions = json.loads(quiz.questions_json)
    except Exception:
        questions = []

    data = request.json or {}
    payload_answers = data.get("answers") or data.get("userAnswers") or []
    student_id = data.get("studentId") or data.get("student_id") or "usr-student-1"
    student_name = data.get("studentName") or "Student"
    time_taken = int(data.get("timeTaken") or 0)
    pass_percentage = quiz.pass_percentage or 70

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
    for q in questions:
        qid = str(q.get("id"))
        selected = None
        for ua in payload_answers:
            if str(ua.get("questionId") or ua.get("id")) == qid:
                selected = ua.get("selectedAnswer") or ua.get("answer")
                break

        correct = q.get("correctAnswer")
        options = q.get("options") or []
        is_correct = selected is not None and str(selected) == str(correct)
        if is_correct:
            score += 1

        correct_text = ""
        if isinstance(correct, int) and 0 <= correct < len(options):
            correct_text = str(options[correct])
        elif isinstance(correct, str):
            correct_text = correct
        else:
            try:
                correct_text = str(options[int(correct)])
            except Exception:
                correct_text = ""

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

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    attempt = QuizAttemptModel(
        attempt_id=f"att-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
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

    return jsonify({"attempt": attempt.to_dict()}), 200

@app.route("/api/flashcards", methods=["GET"])
def get_flashcards():
    user_id = request.args.get("userId", "")
    query = FlashcardDeckModel.query
    if user_id:
        query = query.filter_by(created_by_id=user_id)
    decks = query.order_by(FlashcardDeckModel.created_at.desc()).all()
    return jsonify([d.to_dict() for d in decks])

@app.route("/api/flashcards/<deck_id>", methods=["DELETE"])
def delete_flashcard_deck(deck_id):
    deck = FlashcardDeckModel.query.get(deck_id)
    if not deck:
        return jsonify({"error": "Flashcard deck not found.", "code": "NOT_FOUND"}), 404
    db.session.delete(deck)
    _commit_or_warn("flashcard deck deletion")
    return jsonify({"success": True}), 200

@app.route("/api/summaries", methods=["GET"])
def get_summaries():
    user_id = request.args.get("userId", "")
    query = SummaryModel.query
    if user_id:
        query = query.filter_by(created_by_id=user_id)
    sums = query.order_by(SummaryModel.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sums])

@app.route("/api/reviewers", methods=["GET"])
def get_reviewers():
    user_id = request.args.get("userId", "")
    query = ReviewerModel.query
    if user_id:
        query = query.filter_by(created_by_id=user_id)
    revs = query.order_by(ReviewerModel.created_at.desc()).all()
    return jsonify([r.to_dict() for r in revs])

@app.route("/api/summaries/<summary_id>", methods=["DELETE"])
def delete_summary(summary_id):
    item = SummaryModel.query.get(summary_id)
    if not item:
        return jsonify({"error": "Summary not found.", "code": "NOT_FOUND"}), 404
    db.session.delete(item)
    _commit_or_warn("summary deletion")
    return jsonify({"success": True}), 200

@app.route("/api/reviewers/<reviewer_id>", methods=["DELETE"])
def delete_reviewer(reviewer_id):
    item = ReviewerModel.query.get(reviewer_id)
    if not item:
        return jsonify({"error": "Reviewer not found.", "code": "NOT_FOUND"}), 404
    db.session.delete(item)
    _commit_or_warn("reviewer deletion")
    return jsonify({"success": True}), 200

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    user_id = request.args.get("userId", "usr-student-1")
    notifs = NotificationModel.query.filter_by(user_id=user_id).order_by(NotificationModel.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifs])

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

@app.route("/api/progress/<student_id>", methods=["GET"])
def get_student_progress(student_id):
    """Aggregated student progress, shaped like src/types.ts StudentProgress."""
    attempts = QuizAttemptModel.query.filter_by(student_id=student_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
    total = len(attempts)

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

    topic_performances = [
        {
            "topic": t,
            "totalQuestions": d["total"],
            "correctAnswers": d["correct"],
            "accuracyPercentage": round((d["correct"] / d["total"]) * 100) if d["total"] else 0,
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

    payload = {
        "studentId": student_id,
        "totalQuizzesTaken": total,
        "averageScore": round(sum(a.percentage for a in attempts) / total) if total else 0,
        "totalMaterialsUploaded": MaterialModel.query.filter_by(uploader_role="student").count(),
        "completedFlashcardDecks": FlashcardDeckModel.query.count(),
        "topicPerformances": topic_performances,
        "weakTopics": list(dict.fromkeys(weak)),
        "strongTopics": list(dict.fromkeys(strong)),
        "recentQuizAttempts": [a.to_dict() for a in attempts][:10],
    }

    if total == 0:
        payload.update({
            "averageScore": 80,
            "totalMaterialsUploaded": 1,
            "topicPerformances": [
                {"topic": "Graph Traversal", "totalQuestions": 5, "correctAnswers": 4, "accuracyPercentage": 80},
                {"topic": "Recursion & Stacks", "totalQuestions": 4, "correctAnswers": 4, "accuracyPercentage": 100},
                {"topic": "Binary Search Trees", "totalQuestions": 5, "correctAnswers": 4, "accuracyPercentage": 90},
                {"topic": "Database Normalization", "totalQuestions": 5, "correctAnswers": 3, "accuracyPercentage": 65},
            ],
        })
    return jsonify(payload)

@app.route("/api/recommendations/<student_id>", methods=["GET"])
def get_student_recommendations(student_id):
    """Personalized learning recommendations, shaped like src/types.ts Recommendation."""
    attempts = QuizAttemptModel.query.filter_by(student_id=student_id).order_by(QuizAttemptModel.submitted_at.desc()).all()
    weak = []
    for att in attempts:
        try:
            weak += json.loads(att.weak_topics_json) or []
        except Exception:
            continue
    weak_topics = list(dict.fromkeys(weak))

    first_quiz = QuizModel.query.first()
    first_reviewer = ReviewerModel.query.first()
    first_deck = FlashcardDeckModel.query.first()
    now = datetime.datetime.utcnow().isoformat() + "Z"

    recommendations = []
    if weak_topics:
        for idx, topic in enumerate(weak_topics, start=1):
            recommendations.append({
                "id": f"rec-{idx}",
                "studentId": student_id,
                "weakTopic": topic,
                "recommendationType": "reviewer",
                "title": f"Targeted Reviewer: {topic}",
                "description": f"Your score dropped on {topic}. Focus on these core formulas and key concepts to strengthen your understanding.",
                "targetId": first_reviewer.reviewer_id if first_reviewer else "rev-1",
                "difficultyTarget": "medium",
                "createdAt": now,
            })
            recommendations.append({
                "id": f"rec-{idx + 10}",
                "studentId": student_id,
                "weakTopic": topic,
                "recommendationType": "flashcard",
                "title": f"Concept Flashcard Drill: {topic}",
                "description": f"Practice 5 rapid flashcards focusing strictly on definitions and problem steps for {topic}.",
                "targetId": first_deck.id if first_deck else "deck-1",
                "difficultyTarget": "easy",
                "createdAt": now,
            })
    else:
        recommendations.append({
            "id": "rec-default-1",
            "studentId": student_id,
            "weakTopic": "General Graph Traversal",
            "recommendationType": "quiz",
            "title": "Adaptive Practice Quiz: Graphs & BFS/DFS",
            "description": "Keep your high score sharp with Bloom's Taxonomy Level 3 (Applying) question practice.",
            "targetId": first_quiz.quiz_id if first_quiz else "quiz-101",
            "difficultyTarget": "medium",
            "createdAt": now,
        })
    return jsonify(recommendations)

@app.route("/api/announcements", methods=["GET", "POST"])
def handle_announcements():
    if request.method == "POST":
        data = request.json or {}
        if not data.get("title"):
            return jsonify({"error": "Announcement title is required.", "code": "EMPTY_TITLE"}), 400
        new_ann = AnnouncementModel(
            announcement_id=f"ann-{int(datetime.datetime.utcnow().timestamp() * 1000)}",
            teacher_id=data.get("teacherId") or data.get("createdById"),
            subject_id=data.get("subjectId"),
            title=data["title"],
            message=data.get("content") or data.get("message") or "",
            created_at=data.get("createdAt") or (datetime.datetime.utcnow().isoformat() + "Z"),
            updated_at=data.get("createdAt"),
            posted_at=data.get("createdAt"),
            author_name=data.get("authorName") or "Faculty",
            target_audience=data.get("targetAudience") or "all",
            priority=data.get("priority") or "medium"
        )
        db.session.add(new_ann)
        _commit_or_warn("announcement")
        return jsonify(new_ann.to_dict()), 201

    user_id = request.args.get("userId", "")
    read_ids = set()
    if user_id:
        read_ids = {r.announcement_id for r in AnnouncementReadModel.query.filter_by(user_id=user_id).all()}

    anns = AnnouncementModel.query.order_by(AnnouncementModel.created_at.desc()).all()
    items = [a.to_dict() for a in anns]
    for item in items:
        item["isRead"] = item["id"] in read_ids
    return jsonify(items)

@app.route("/api/announcements/<announcement_id>/read", methods=["POST"])
def mark_announcement_read(announcement_id):
    user_id = (request.json or {}).get("userId", "")
    if not user_id:
        return jsonify({"error": "userId is required.", "code": "MISSING_USER"}), 400
    existing = AnnouncementReadModel.query.get((announcement_id, user_id)) if announcement_id and user_id else None
    if not existing:
        db.session.add(AnnouncementReadModel(
            announcement_id=announcement_id,
            user_id=user_id,
            read_at=datetime.datetime.utcnow().isoformat() + "Z"
        ))
        _commit_or_warn("announcement read state")
    return jsonify({"success": True, "isRead": True}), 200

@app.route("/api/announcements/<announcement_id>/unread", methods=["POST"])
def mark_announcement_unread(announcement_id):
    user_id = (request.json or {}).get("userId", "")
    if not user_id:
        return jsonify({"error": "userId is required.", "code": "MISSING_USER"}), 400
    existing = AnnouncementReadModel.query.get((announcement_id, user_id)) if announcement_id and user_id else None
    if existing:
        db.session.delete(existing)
        _commit_or_warn("announcement unread state")
    return jsonify({"success": True, "isRead": False}), 200

@app.route("/api/announcements/<announcement_id>", methods=["DELETE"])
def delete_announcement(announcement_id):
    ann = AnnouncementModel.query.get(announcement_id)
    if not ann:
        return jsonify({"error": "Announcement not found.", "code": "NOT_FOUND"}), 404
    db.session.delete(ann)
    _commit_or_warn("announcement deletion")
    return jsonify({"success": True}), 200

@app.route("/api/logs", methods=["GET", "POST"])
def handle_logs():
    if request.method == "POST":
        data = request.json or {}
        user_id = data.get("userId", "usr-student-1")
        user_name = data.get("userName", "John Wendyl S. Sanchez")
        user_role = data.get("userRole", "student")
        action = data.get("action", "USER_ACTION")
        details = data.get("details", "")
        log_action(user_id, user_name, user_role, action, details)
        return jsonify({"success": True})
    logs = ActivityLogModel.query.order_by(ActivityLogModel.created_at.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs])

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
            seed_users_needed = (UserModel.query.count() == 0)
        except Exception as e:
            err_text = str(e)
            if "Unknown column" in err_text or "doesn't exist" in err_text or "no such column" in err_text:
                print("[Database] Existing database schema is from an older version and is incompatible with StudyLens.")
                print("[Database] To rebuild it with the current 14-table schema + capstone seed data, run: py scripts/reset_db.py --yes")
            else:
                print("[Database] Seeding skipped, database unavailable:", e)
            return

        if seed_roles_needed:
            roles = [RoleModel(role_id=1, role_name="Student"), RoleModel(role_id=2, role_name="Teacher"), RoleModel(role_id=3, role_name="Administrator")]
            db.session.bulk_save_objects(roles)
            db.session.commit()

        if seed_users_needed:
            seed_users = [
                UserModel(user_id="usr-student-1", role_id=1, first_name="John Wendyl", last_name="Sanchez", email="student@studylens.edu", role="student", department="Computer Science", student_id="2024-STU-0841", created_at="2024-01-15T08:00:00.000Z"),
                UserModel(user_id="usr-student-2", role_id=1, first_name="Vin Henry", last_name="Ardiente", email="vin@studylens.edu", role="student", department="Information Technology", student_id="2024-STU-0842", created_at="2024-01-15T08:00:00.000Z"),
                UserModel(user_id="usr-student-3", role_id=1, first_name="Precious Marie", last_name="Salve", email="precious@studylens.edu", role="student", department="Information Technology", student_id="2024-STU-0843", created_at="2024-01-15T08:00:00.000Z"),
                UserModel(user_id="usr-student-4", role_id=1, first_name="Jeric Nino", last_name="Solitana", email="jeric@studylens.edu", role="student", department="Information Technology", student_id="2024-STU-0844", created_at="2024-01-15T08:00:00.000Z"),
                UserModel(user_id="usr-teacher-1", role_id=2, first_name="Christian C.", last_name="Barral, MIT", email="teacher@studylens.edu", role="teacher", department="College of Computer Studies", created_at="2023-09-01T08:00:00.000Z"),
                UserModel(user_id="usr-teacher-2", role_id=2, first_name="Mary Grace", last_name="Valencia", email="teacher2@studylens.edu", role="teacher", department="College of Computer Studies", created_at="2023-09-05T08:00:00.000Z"),
                UserModel(user_id="usr-admin-1", role_id=3, first_name="Neil A.", last_name="Basabe, DIT", email="admin@studylens.edu", role="admin", department="Dean, College of Computer Studies", created_at="2023-08-01T08:00:00.000Z")
            ]
            db.session.bulk_save_objects(seed_users)

            seed_subs = [
                SubjectModel(subject_id="sub-101", subject_code="CS 301", subject_name="Data Structures & Algorithms", description="Fundamental data structures, search trees, graphs, sorting algorithms.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=51, material_count=2, created_at="2024-01-10T08:00:00.000Z"),
                SubjectModel(subject_id="sub-102", subject_code="AI 402", subject_name="Artificial Intelligence & Neural Networks", description="Machine learning, Groq GPT-OSS-120B inference, and deep learning.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=45, material_count=1, created_at="2024-01-12T08:00:00.000Z"),
                SubjectModel(subject_id="sub-103", subject_code="DB 204", subject_name="Database Systems & Architecture", description="Relational database design, MySQL querying, 1NF to 3NF normalization.", teacher_id="usr-teacher-2", teacher_name="Mary Grace Valencia", student_count=55, material_count=1, created_at="2024-01-14T08:00:00.000Z")
            ]
            db.session.bulk_save_objects(seed_subs)

            seed_anns = [
                AnnouncementModel(announcement_id="ann-1", teacher_id="usr-admin-1", title="Welcome to StudyLens AI Platform!", message="Utilize AI-generated flashcards, reviewers, and adaptive Bloom's Taxonomy quizzes powered by Groq GPT-OSS-120B.", author_name="Neil A. Basabe, DIT (Dean)", target_audience="all", priority="high", created_at="2024-02-01T08:00:00.000Z"),
                AnnouncementModel(announcement_id="ann-2", teacher_id="usr-teacher-1", title="New Materials Uploaded for CS 301 & DB 204", message="Christian C. Barral, MIT uploaded lecture notes on Graph Algorithms and MySQL Normalization.", author_name="Christian C. Barral, MIT", target_audience="students", priority="medium", created_at="2024-02-06T09:30:00.000Z")
            ]
            db.session.bulk_save_objects(seed_anns)

            seed_notifs = [
                NotificationModel(notification_id="notif-1", user_id="usr-student-1", title="New Quiz Assigned", message="Data Structures midterm quiz is now published.", created_at="2024-02-10T08:00:00.000Z"),
                NotificationModel(notification_id="notif-2", user_id="usr-student-1", title="AI Reviewer Ready", message="Your Groq GPT-OSS-120B reviewer has been synthesized.", created_at="2024-02-12T08:00:00.000Z")
            ]
            db.session.bulk_save_objects(seed_notifs)
            db.session.commit()
            print("[Database Seed] 14-table schema initialized with UC CCS Capstone seed data.")

        try:
            seed_enrollments_needed = (StudentSubjectModel.query.count() == 0)
        except Exception:
            seed_enrollments_needed = False

        if seed_enrollments_needed and UserModel.query.count() > 0 and SubjectModel.query.count() > 0:
            enrollments = [
                StudentSubjectModel(student_id="usr-student-1", subject_id="sub-101", date_enrolled="2024-01-20T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-2", subject_id="sub-101", date_enrolled="2024-01-21T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-3", subject_id="sub-101", date_enrolled="2024-01-22T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-4", subject_id="sub-101", date_enrolled="2024-01-23T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-1", subject_id="sub-102", date_enrolled="2024-01-24T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-2", subject_id="sub-102", date_enrolled="2024-01-24T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-3", subject_id="sub-102", date_enrolled="2024-01-25T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-1", subject_id="sub-103", date_enrolled="2024-01-26T08:00:00.000Z"),
                StudentSubjectModel(student_id="usr-student-4", subject_id="sub-103", date_enrolled="2024-01-27T08:00:00.000Z")
            ]
            db.session.bulk_save_objects(enrollments)
            db.session.commit()
            print("[Database Seed] Enrolled demo students into course subjects (rosters seeded).")

if __name__ == "__main__":
    seed_database_if_empty()
    print(f"StudyLens AI Python Flask Backend running on http://127.0.0.1:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=True)
