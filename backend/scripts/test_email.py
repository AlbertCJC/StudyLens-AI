"""Sends a test email through the configured SMTP mailer.

Usage:
    python backend/scripts/test_email.py [recipient@example.com]

With no recipient, the message is sent to GMAIL_SENDER (self-send). This is the
fastest way to confirm that backend/.env SMTP credentials work without going
through registration or a password reset. The app password itself is never
printed.
"""

import argparse
import os
import sys

from dotenv import load_dotenv

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_DIR)

load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

from email_service import email_config_summary, send_test_email  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Send a StudyLens AI SMTP test email.")
    parser.add_argument(
        "recipient",
        nargs="?",
        help="Destination address (defaults to GMAIL_SENDER)",
    )
    args = parser.parse_args()

    summary = email_config_summary()
    print("SMTP configuration:")
    print(f"  enabled          : {summary['enabled']}")
    print(f"  host             : {summary['host']}")
    print(f"  port             : {summary['port']} (SSL={summary['use_ssl']})")
    print(f"  timeout          : {summary['timeout']}s")
    print(f"  sender           : {summary['sender'] or '(missing)'}")
    print(f"  app password     : {'set, ' + str(summary['password_length']) + ' chars' if summary['password_length'] else '(missing)'}")
    if summary["reply_to"]:
        print(f"  reply-to         : {summary['reply_to']}")

    if not summary["enabled"]:
        print("\nEmail delivery is disabled. Set GMAIL_SENDER and GMAIL_APP_PASSWORD in backend/.env.")
        return 1

    recipient = (args.recipient or summary["sender"]).strip()
    if "@" not in recipient:
        print(f"\nInvalid recipient: {recipient}")
        return 1

    print(f"\nSending test message to {recipient} ...")
    ok, detail = send_test_email(recipient)
    if ok:
        print(f"SUCCESS: {detail}")
        print("Check the inbox (and Spam folder). If it is missing, confirm the recipient address.")
        return 0
    print(f"FAILED: {detail}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
