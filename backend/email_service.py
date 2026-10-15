"""Gmail SMTP delivery for StudyLens AI one-time codes.

Keeps mailer logic out of auth code paths. When GMAIL_APP_PASSWORD is set, OTP
codes (email verification, password reset, staff 2FA) are delivered by email
through Gmail SMTP (smtp.gmail.com). When it is unset the module is inert, so
the existing development fallback (OTP_DEV_REVEAL / console codes) keeps
working unchanged.

Delivery never blocks the request: sends run on a daemon thread and every
failure is logged (never raised), so a mailer outage cannot break sign-in.
"""

import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

_SMTP_HOST = "smtp.gmail.com"
_SMTP_PORT = 587

_APP_NAME = "StudyLens AI"

_PURPOSE_LABELS = {
    "verify": ("verify your email", "Enter this code to activate your StudyLens AI account."),
    "reset": ("reset your password", "Enter this code to set a new password. It can only be used once."),
    "2fa": ("confirm your sign-in", "Enter this code to finish signing in to your account."),
}


def is_email_enabled():
    """True when a Gmail app password is present and delivery should be attempted."""
    return bool(os.getenv("GMAIL_APP_PASSWORD", "").strip())


def _from_address():
    return os.getenv("GMAIL_SENDER", "").strip() or ""


def _send(to_email, subject, html, text):
    """Attempts delivery inside a daemon thread. Never raises in the caller."""
    def deliver():
        try:
            gmail = os.getenv("GMAIL_SENDER", "").strip()
            app_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
            if not gmail or not app_password:
                print("[Email] GMAIL_SENDER / GMAIL_APP_PASSWORD missing, not sending.")
                return
            message = MIMEMultipart("alternative")
            message["From"] = gmail
            message["To"] = to_email
            message["Subject"] = subject
            message.attach(MIMEText(text, "plain"))
            message.attach(MIMEText(html, "html"))
            with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(gmail, app_password)
                server.sendmail(gmail, [to_email], message.as_string())
        except Exception as e:
            print(f"[Email] Gmail delivery failed for {to_email} ({subject}): {e}")

    threading.Thread(target=deliver, daemon=True).start()


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
    _send(
        to_email,
        subject,
        _otp_html(label, note, code, expires_minutes),
        _otp_text(subject, note, code, expires_minutes),
    )
    return True


def _expiry_line(expires_minutes):
    if not expires_minutes:
        return ""
    return (
        f'<p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.55;">'
        f"This code expires in <strong style=\"color:#94a3b8;\">{expires_minutes} "
        f"minute{'s' if expires_minutes != 1 else ''}</strong>.</p>"
    )


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