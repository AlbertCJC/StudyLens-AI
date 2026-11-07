"""Initial database seed data (UC CCS Capstone Project Team)."""

from app import app, db
from config import DEMO_ADMIN_PASSWORD, DEMO_TEACHER_PASSWORD
from db.migrations import (
    _ensure_auth_security_columns,
    _ensure_demo_email_verified,
    _ensure_demo_passwords,
    _ensure_notification_target_column,
    _ensure_quiz_deadline_column,
    _ensure_users_2fa_columns,
    _normalize_avatar_placeholders,
    _purge_test_announcements,
)
from models import RoleModel, SubjectModel, UserModel
from werkzeug.security import generate_password_hash

from services.settings_service import _enforce_archiving, _load_system_settings


def seed_database_if_empty():
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print("db.create_all notice:", e)
            return

        try:
            seed_roles_needed = (RoleModel.query.count() == 0)
            seed_users_needed = (db.session.execute(db.text("SELECT COUNT(*) FROM users")).scalar() == 0)
        except Exception as e:
            err_text = str(e)
            if "Unknown column" in err_text or "doesn't exist" in err_text or "no such column" in err_text:
                print("[Database] Existing database schema is from an older version and is incompatible with StudyLens.")
                print("[Database] To rebuild it with the current 14-table schema + capstone seed data, run: py scripts/reset_db.py --yes")
            else:
                print("[Database] Seeding skipped, database unavailable:", e)
            return

        _ensure_users_2fa_columns()
        _ensure_auth_security_columns()
        _ensure_quiz_deadline_column()
        _ensure_notification_target_column()
        _normalize_avatar_placeholders()
        _purge_test_announcements()
        _ensure_demo_passwords()
        _ensure_demo_email_verified()
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
                UserModel(user_id="usr-admin-1", role_id=3, first_name="Neil A.", last_name="Basabe, DIT", email="admin@studylens.edu", role="admin", department="College of Computer Studies", password_hash=generate_password_hash(DEMO_ADMIN_PASSWORD), created_at="2023-08-01T08:00:00.000Z"),
            ]
            db.session.bulk_save_objects(seed_users)

            seed_subs = [
                SubjectModel(subject_id="sub-101", subject_code="CS 301", subject_name="Data Structures & Algorithms", description="Fundamental data structures, search trees, graphs, sorting algorithms.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=51, material_count=2, created_at="2024-01-10T08:00:00.000Z"),
                SubjectModel(subject_id="sub-102", subject_code="AI 402", subject_name="Artificial Intelligence & Neural Networks", description="Machine learning, Groq GPT-OSS-120B inference, and deep learning.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=45, material_count=1, created_at="2024-01-12T08:00:00.000Z"),
            ]
            db.session.bulk_save_objects(seed_subs)
            db.session.commit()
            print("[Database Seed] 14-table schema initialized with UC CCS Capstone seed data.")
