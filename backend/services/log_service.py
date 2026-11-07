"""Activity/audit log persistence."""

import datetime

from flask import request

from extensions import db
from models import ActivityLogModel

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
