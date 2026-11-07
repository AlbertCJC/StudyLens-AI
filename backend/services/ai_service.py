"""AI-generated content persistence helpers."""

import datetime
import json

from db.session import _commit_or_warn
from extensions import db
from models import AIGeneratedContentModel

def _save_ai_generated_content(generated_by, material_id, title, content_type, result):
    """Stores explain/recommendation outputs in the ai_generated_content table (best-effort)."""
    entry = AIGeneratedContentModel(
        content_id=f"ai-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        material_id=material_id,
        generated_by=generated_by,
        title=title,
        content_type=content_type,
        generated_text=json.dumps(result),
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    db.session.add(entry)
    _commit_or_warn(f"AI {content_type} content")
