"""Explicitly reset a seeded demo account password.

This is deliberate operator action, never an automatic startup repair.

Usage:
    python backend/scripts/reset_demo_password.py --user usr-admin-1 --yes
    # The new password is read from NEW_DEMO_PASSWORD or prompted for.

Only the built-in demo accounts (usr-teacher-1, usr-admin-1) are supported.
"""

import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from werkzeug.security import generate_password_hash  # noqa: E402

import app as app_module  # noqa: E402
from lib.validation import _validate_password_strength  # noqa: E402
from models import UserModel  # noqa: E402

DEMO_USER_IDS = {"usr-teacher-1", "usr-admin-1"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset a seeded demo account password.")
    parser.add_argument("--user", required=True, choices=sorted(DEMO_USER_IDS))
    parser.add_argument("--yes", action="store_true", help="Confirm the reset.")
    args = parser.parse_args()

    if not args.yes:
        print("Refusing to reset without --yes.")
        return 1

    new_password = os.getenv("NEW_DEMO_PASSWORD") or getpass.getpass("New password: ")
    if not new_password:
        print("No password supplied.")
        return 1
    strength_error = _validate_password_strength(new_password)
    if strength_error:
        print(f"Password rejected: {strength_error}")
        return 1

    with app_module.app.app_context():
        user = app_module.db.session.get(UserModel, args.user)
        if not user:
            print(f"User not found: {args.user}")
            return 1
        user.password_hash = generate_password_hash(new_password)
        user.token_version = (user.token_version or 0) + 1
        app_module.db.session.commit()
        print(f"Password reset for {args.user}. All their sessions are now invalid.")
        print("This action is not logged to the activity table by design; record it in your ops log.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
