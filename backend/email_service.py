"""SMTP delivery for StudyLens AI one-time codes.

Keeps mailer logic out of auth code paths. When ``GMAIL_SENDER`` and
``GMAIL_APP_PASSWORD`` are set, OTP codes (email verification, password reset,
staff 2FA) are delivered by email to the recipient's *registered* address over
Gmail SMTP. When either value is missing the module is inert, so the existing
development fallback (``OTP_DEV_REVEAL`` / console codes) keeps working.

Configuration (all optional, read from ``backend/.env``):

* ``GMAIL_SENDER``      - the Gmail address that sends the mail (required)
* ``GMAIL_APP_PASSWORD``- 16-character Google App Password (required). Spaces
                          are ignored, so the value can be pasted as displayed.
* ``GMAIL_SMTP_HOST``   - defaults to ``smtp.gmail.com``
* ``GMAIL_SMTP_PORT``   - defaults to ``587`` (STARTTLS) or ``465`` with SSL
* ``GMAIL_SMTP_USE_SSL``- ``true`` to connect with implicit SSL (port 465)
* ``GMAIL_SMTP_TIMEOUT``- connection timeout in seconds (default ``15``)
* ``GMAIL_REPLY_TO``    - optional Reply-To address

Delivery never blocks the request: sends run on a daemon thread. A failed
delivery is logged with the SMTP status code and pollutes nothing else, so a
mailer outage cannot break sign-in. Use ``send_test_email`` (see
``scripts/test_email.py``) to verify the configuration synchronously.
"""

import os
import smtplib
import ssl
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid

from config import IS_PRODUCTION

_DEFAULT_HOST = "smtp.gmail.com"
_DEFAULT_PORT = 587
_DEFAULT_SSL_PORT = 465
_DEFAULT_TIMEOUT = 15

_APP_NAME = "StudyLens AI"

_PURPOSE_LABELS = {
    "verify": ("verify your email", "Enter this code to activate your StudyLens AI account."),
    "reset": ("reset your password", "Enter this code to set a new password. It can only be used once."),
    "2fa": ("confirm your sign-in", "Enter this code to finish signing in to your account."),
}


def _clean(value):
    """Strips surrounding whitespace and every internal space.

    Google displays App Passwords grouped as ``xxxx xxxx xxxx xxxx``; the spaces
    are not part of the credential and must be removed before authentication.
    """
    return "".join((value or "").split())


def _truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def _config():
    """Returns the current SMTP configuration, reading the environment each call."""
    use_ssl = _truthy(os.getenv("GMAIL_SMTP_USE_SSL", ""))
    try:
        port = int(os.getenv("GMAIL_SMTP_PORT", "").strip() or (_DEFAULT_SSL_PORT if use_ssl else _DEFAULT_PORT))
    except (TypeError, ValueError):
        port = _DEFAULT_SSL_PORT if use_ssl else _DEFAULT_PORT
    try:
        timeout = int(os.getenv("GMAIL_SMTP_TIMEOUT", "").strip() or _DEFAULT_TIMEOUT)
    except (TypeError, ValueError):
        timeout = _DEFAULT_TIMEOUT
    sender = os.getenv("GMAIL_SENDER", "").strip()
    return {
        "host": os.getenv("GMAIL_SMTP_HOST", "").strip() or _DEFAULT_HOST,
        "port": port,
        "use_ssl": use_ssl,
        "timeout": max(3, timeout),
        "sender": sender,
        "password": _clean(os.getenv("GMAIL_APP_PASSWORD", "")),
        "reply_to": os.getenv("GMAIL_REPLY_TO", "").strip(),
    }


def is_email_enabled():
    """True when a sender address and app password are both present."""
    cfg = _config()
    return bool(cfg["sender"] and cfg["password"])


def email_config_summary():
    """Masked view of the active config for diagnostics (never includes the secret)."""
    cfg = _config()
    return {
        "enabled": bool(cfg["sender"] and cfg["password"]),
        "host": cfg["host"],
        "port": cfg["port"],
        "use_ssl": cfg["use_ssl"],
        "timeout": cfg["timeout"],
        "sender": cfg["sender"],
        "password_length": len(cfg["password"]),
        "reply_to": cfg["reply_to"],
    }


def _build_message(cfg, to_email, subject, html, text):
    message = MIMEMultipart("alternative")
    message["From"] = formataddr((_APP_NAME, cfg["sender"]))
    message["To"] = to_email
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain=cfg["sender"].split("@")[-1] or None)
    if cfg["reply_to"]:
        message["Reply-To"] = cfg["reply_to"]
    message.attach(MIMEText(text, "plain", "utf-8"))
    message.attach(MIMEText(html, "html", "utf-8"))
    return message


def _deliver_once(cfg, to_email, message, use_ssl, port):
    """One SMTP attempt. Raises on failure; returns on success."""
    context = ssl.create_default_context()
    if use_ssl:
        server = smtplib.SMTP_SSL(cfg["host"], port, timeout=cfg["timeout"], context=context)
    else:
        server = smtplib.SMTP(cfg["host"], port, timeout=cfg["timeout"])
    try:
        server.ehlo()
        if not use_ssl:
            server.starttls(context=context)
            server.ehlo()
        server.login(cfg["sender"], cfg["password"])
        server.send_message(message, from_addr=cfg["sender"], to_addrs=[to_email])
    finally:
        try:
            server.quit()
        except Exception:
            pass


def _deliver(to_email, subject, html, text):
    """Attempts delivery and returns (ok, detail). Never raises."""
    cfg = _config()
    if not cfg["sender"] or not cfg["password"]:
        return False, "GMAIL_SENDER / GMAIL_APP_PASSWORD missing"
    message = _build_message(cfg, to_email, subject, html, text)

    try:
        _deliver_once(cfg, to_email, message, cfg["use_ssl"], cfg["port"])
        return True, f"sent via {cfg['host']}:{cfg['port']} (SSL={cfg['use_ssl']})"
    except smtplib.SMTPAuthenticationError as exc:
        return False, (
            f"authentication failed (SMTP {exc.smtp_code}). Check that the Gmail "
            "account has 2-Step Verification enabled and that GMAIL_APP_PASSWORD "
            "is a current 16-character App Password."
        )
    except (OSError, smtplib.SMTPConnectError) as exc:
        # Port 587 is commonly blocked by networks/cloud hosts; try implicit SSL
        # on 465 once before giving up.
        if cfg["use_ssl"] or cfg["port"] == _DEFAULT_SSL_PORT:
            return False, f"connection failed: {exc}"
        try:
            _deliver_once(cfg, to_email, message, True, _DEFAULT_SSL_PORT)
            return True, f"sent via {cfg['host']}:{_DEFAULT_SSL_PORT} (SSL=True fallback)"
        except smtplib.SMTPAuthenticationError as fallback_exc:
            return False, (
                f"authentication failed (SMTP {fallback_exc.smtp_code}). Check "
                "GMAIL_SENDER / GMAIL_APP_PASSWORD and Gmail 2-Step Verification."
            )
        except Exception as fallback_exc:
            return False, (
                f"connection failed on {cfg['host']}:{cfg['port']} ({exc}); "
                f"SSL fallback on :{_DEFAULT_SSL_PORT} also failed ({fallback_exc})"
            )
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def _send(to_email, subject, html, text):
    """Attempt delivery. Never raises in the caller.

    Production sends synchronously so the API can reflect delivery failure.
    Development keeps the thread so local requests stay snappy; delivery
    failures are logged asynchronously.
    """
    def deliver():
        ok, detail = _deliver(to_email, subject, html, text)
        if ok:
            print(f"[Email] {detail} -> {to_email} ({subject})", flush=True)
        else:
            print(f"[Email] Delivery failed for {to_email} ({subject}): {detail}", flush=True)
        return ok, detail

    if IS_PRODUCTION:
        return deliver()

    threading.Thread(target=deliver, daemon=True).start()
    return True, "queued"


def send_test_email(to_email):
    """Synchronously sends a test message. Returns (ok, detail) for diagnostics."""
    subject = f"{_APP_NAME} SMTP test"
    text = (
        f"This is a test message from {_APP_NAME}.\n\n"
        "If you received this, SMTP delivery is configured correctly."
    )
    html = _otp_html_no_code(
        "SMTP test successful",
        "Your StudyLens AI mailer is configured correctly and can reach this inbox.",
    )
    return _deliver(to_email, subject, html, text)


def send_otp_email(to_email, purpose, code, expires_minutes=None):
    """Sends a 6-digit one-time code email.

    purpose is one of "verify", "reset", or "2fa". Returns True when delivery
    was queued, False when email delivery is not configured or the purpose is
    unknown.
    """
    if not is_email_enabled():
        return False
    label_and_note = _PURPOSE_LABELS.get(purpose)
    if not label_and_note:
        return False
    label, note = label_and_note
    subject = f"Your {_APP_NAME} code: {code}"
    ok, _ = _send(
        to_email,
        subject,
        _otp_html(label, note, code, expires_minutes),
        _otp_text(subject, note, code, expires_minutes),
    )
    return ok


def _expiry_line(expires_minutes):
    if not expires_minutes:
        return ""
    return (
        f'<p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.55;">'
        f"This code expires in <strong style=\"color:#94a3b8;\">{expires_minutes} "
        f"minute{'s' if expires_minutes != 1 else ''}</strong>.</p>"
    )


def _otp_html_no_code(heading, note):
    return f"""\
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td align="center" style="padding:32px 32px 8px;">
              <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.5px;color:#f1f5f9;">StudyLens <span style="color:#38bdf8;">AI</span></p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 32px 32px;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#f1f5f9;text-align:center;">{heading}</h1>
              <p style="margin:0;color:#94a3b8;font-size:15px;line-height:1.55;text-align:center;">{note}</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#475569;font-size:12px;">&copy; {_APP_NAME} &middot; University of Cebu</p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _otp_html(label, note, code, expires_minutes):
    return f"""\
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td align="center" style="padding:32px 32px 8px;">
              <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.5px;color:#f1f5f9;">StudyLens <span style="color:#38bdf8;">AI</span></p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 32px 0;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#f1f5f9;text-align:center;">{label.capitalize()}</h1>
              <p style="margin:0;color:#94a3b8;font-size:15px;line-height:1.55;text-align:center;">{note}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <span style="display:inline-block;background:#0f172a;border:1px solid #38bdf8;border-radius:12px;padding:18px 36px;font-size:34px;font-weight:800;letter-spacing:10px;color:#38bdf8;">{code}</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 0;">
              {_expiry_line(expires_minutes)}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 28px;">
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55;text-align:center;">If you didn&rsquo;t request this code, you can safely ignore this email. Never share your code with anyone.</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#475569;font-size:12px;">&copy; {_APP_NAME} &middot; University of Cebu</p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _otp_text(subject, note, code, expires_minutes):
    expiry = (
        f" This code expires in {expires_minutes} minute"
        + ("s" if expires_minutes != 1 else "")
        + "."
        if expires_minutes
        else ""
    )
    return (
        f"{subject}\n\n"
        f"{note}\n\n"
        f"Your code: {code}\n{expiry.strip()}\n\n"
        f"If you didn't request this code, you can safely ignore this email. "
        f"Never share your code with anyone.\n\n"
        f"---\n{_APP_NAME} - University of Cebu"
    )
