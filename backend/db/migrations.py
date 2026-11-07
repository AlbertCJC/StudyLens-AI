"""Idempotent schema/data repairs run at startup."""

from werkzeug.security import generate_password_hash

from config import DEMO_ADMIN_PASSWORD, DEMO_TEACHER_PASSWORD
from extensions import db
from lib.constants import _SMOKE_ANNOUNCEMENT_TITLES
from models import AnnouncementModel, UserModel

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
