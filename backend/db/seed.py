"""Explicit demo-data seeding.

Seeding is never automatic. It runs only from ``scripts/seed_dev.py`` when
``SEED_DEMO_DATA=true`` and the environment is not production.
"""

from app import app, db
from config import (
    DEMO_ADMIN_PASSWORD,
    DEMO_TEACHER_PASSWORD,
    IS_PRODUCTION,
    KNOWN_DEFAULT_DEMO_PASSWORDS,
    SEED_DEMO_DATA,
)
from db.migrations import (
    _ensure_demo_email_verified,
    _ensure_demo_passwords,
    _normalize_avatar_placeholders,
    _purge_test_announcements,
    run_migrations,
)
from lib.validation import _validate_password_strength
from models import RoleModel, SubjectModel, UserModel
from werkzeug.security import generate_password_hash

from services.settings_service import _enforce_archiving, _load_system_settings


def seed_refusal_reason():
    """Returns why demo seeding must not run, or ``None`` when it may run."""
    if not SEED_DEMO_DATA:
        return "SEED_DEMO_DATA is disabled."
    if IS_PRODUCTION:
        return "Demo seeding is not allowed when FLASK_ENV=production."
    for name, value in (
        ("DEMO_TEACHER_PASSWORD", DEMO_TEACHER_PASSWORD),
        ("DEMO_ADMIN_PASSWORD", DEMO_ADMIN_PASSWORD),
    ):
        if not value:
            return f"{name} is required when SEED_DEMO_DATA is enabled."
        if value in KNOWN_DEFAULT_DEMO_PASSWORDS:
            return f"{name} is set to a known default value."
        strength_error = _validate_password_strength(value)
        if strength_error:
            return f"{name} is too weak: {strength_error}"
    return None


def _run_schema_repairs():
    run_migrations()
    _normalize_avatar_placeholders()
    _purge_test_announcements()
    _ensure_demo_passwords()
    _ensure_demo_email_verified()
    try:
        _enforce_archiving(_load_system_settings())
    except Exception:
        pass


def seed_database_if_empty():
    """Seeds demo roles/users/subjects when explicitly enabled and empty.

    Returns a summary dict: ``{"seeded": bool, "reason": str|None,
    "created": {...}}``.
    """
    reason = seed_refusal_reason()
    if reason:
        print(f"[Database Seed] Skipped: {reason}")
        return {"seeded": False, "reason": reason, "created": {}}

    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print("db.create_all notice:", e)
            return {"seeded": False, "reason": f"schema error: {e}", "created": {}}

        try:
            seed_roles_needed = (RoleModel.query.count() == 0)
            seed_users_needed = (db.session.execute(db.text("SELECT COUNT(*) FROM users")).scalar() == 0)
        except Exception as e:
            err_text = str(e)
            if "Unknown column" in err_text or "doesn't exist" in err_text or "no such column" in err_text:
                print("[Database] Existing database schema is from an older version and is incompatible with StudyLens.")
                print("[Database] Rebuild it with: py scripts/reset_db.py --yes")
            else:
                print("[Database] Seeding skipped, database unavailable:", e)
            return {"seeded": False, "reason": f"database unavailable: {e}", "created": {}}

        _run_schema_repairs()

        created = {"roles": 0, "users": 0, "subjects": 0}

        if seed_roles_needed:
            roles = [
                RoleModel(role_id=1, role_name="Student"),
                RoleModel(role_id=2, role_name="Teacher"),
                RoleModel(role_id=3, role_name="Administrator"),
            ]
            db.session.bulk_save_objects(roles)
            db.session.commit()
            created["roles"] = len(roles)

        if seed_users_needed:
            seed_users = [
                UserModel(user_id="usr-teacher-1", role_id=2, first_name="Christian C.", last_name="Barral, MIT", email="teacher@studylens.edu", role="teacher", department="College of Computer Studies", password_hash=generate_password_hash(DEMO_TEACHER_PASSWORD), status="active", email_verified=1, token_version=0, created_at="2023-09-01T08:00:00.000Z"),
                UserModel(user_id="usr-admin-1", role_id=3, first_name="Neil A.", last_name="Basabe, DIT", email="admin@studylens.edu", role="admin", department="College of Computer Studies", password_hash=generate_password_hash(DEMO_ADMIN_PASSWORD), status="active", email_verified=1, token_version=0, created_at="2023-08-01T08:00:00.000Z"),
            ]
            db.session.bulk_save_objects(seed_users)

            seed_subs = [
                SubjectModel(subject_id="sub-101", subject_code="CS 301", subject_name="Data Structures & Algorithms", description="Fundamental data structures, search trees, graphs, sorting algorithms.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=51, material_count=2, created_at="2024-01-10T08:00:00.000Z"),
                SubjectModel(subject_id="sub-102", subject_code="AI 402", subject_name="Artificial Intelligence & Neural Networks", description="Machine learning, Groq GPT-OSS-120B inference, and deep learning.", teacher_id="usr-teacher-1", teacher_name="Christian C. Barral, MIT", student_count=45, material_count=1, created_at="2024-01-12T08:00:00.000Z"),
            ]
            db.session.bulk_save_objects(seed_subs)
            db.session.commit()
            # Heal any legacy demo rows created before email_verified existed.
            _ensure_demo_email_verified()
            created["users"] = len(seed_users)
            created["subjects"] = len(seed_subs)

        seeded = any(created.values())
        if seeded:
            print(
                "[Database Seed] Created "
                f"{created['roles']} role(s), {created['users']} user(s), "
                f"{created['subjects']} subject(s)."
            )
        else:
            print("[Database Seed] Demo data already present; nothing to do.")
        return {"seeded": seeded, "reason": None, "created": created}
