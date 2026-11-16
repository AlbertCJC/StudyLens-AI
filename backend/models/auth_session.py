"""Server-side auth session records for session revocation (P1-02).

Each issued access/refresh token gets a ``jti`` that is stored here. The
session row is marked revoked on logout, password change, or suspension, and
``lib.auth`` rejects any token whose jti is revoked or missing.
"""

import datetime

from extensions import db
from sqlalchemy import DateTime


class AuthSessionModel(db.Model):
    __tablename__ = "auth_sessions"

    session_id = db.Column(db.String(64), primary_key=True)  # the token jti
    user_id = db.Column(
        db.String(64), db.ForeignKey("users.user_id"), nullable=False, index=True
    )
    created_at = db.Column(db.String(64), nullable=False)
    created_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    last_seen_at = db.Column(db.String(64), nullable=True)
    last_seen_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    revoked_at = db.Column(db.String(64), nullable=True)
    revoked_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)

    def to_dict(self):
        return {
            "sessionId": self.session_id,
            "userId": self.user_id,
            "createdAt": self.created_at_dt.isoformat().replace("+00:00", "Z") if self.created_at_dt else (self.created_at or ""),
            "lastSeenAt": self.last_seen_at_dt.isoformat().replace("+00:00", "Z") if self.last_seen_at_dt else (self.last_seen_at or ""),
            "revokedAt": self.revoked_at_dt.isoformat().replace("+00:00", "Z") if self.revoked_at_dt else (self.revoked_at or ""),
            "userAgent": self.user_agent,
            "ipAddress": self.ip_address,
        }
