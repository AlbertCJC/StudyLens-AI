"""Uploaded-file handling: text extraction and local-file cleanup."""

import io
import os

from config import MAX_EXTRACT_PAGES, _UPLOADS_DIR
from groq_service import IMAGE_EXTENSIONS, describe_image_with_groq

def _clean_extracted_text(text):
    """Normalizes and trims extracted document text for AI consumption."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    text = "\n".join(lines)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text[:12000].strip()


def _delete_local_upload(file_url):
    """Best-effort removal of a locally stored upload when its record is deleted.

    Only ever touches files under the uploads root; the URL's basename is reused
    exactly as the file was stored (randomized server-side). Failures are logged
    but never allowed to break the delete request.
    """
    if not file_url or not str(file_url).startswith("/uploads/"):
        return
    name = os.path.basename(str(file_url).replace("\\", "/"))
    if name in ("", ".", ".."):
        return
    full = os.path.join(_UPLOADS_DIR, name)
    try:
        if os.path.realpath(full).startswith(os.path.realpath(_UPLOADS_DIR).rstrip("\\/") + os.sep) and os.path.isfile(full):
            os.remove(full)
    except Exception as e:
        print(f"[Storage] Could not remove local file {full}: {e}")


def _extract_text_from_file(file_bytes, ext):
    """Extracts readable text from an uploaded document (best-effort)."""
    ext = (ext or "").lower()
    try:
        if ext == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = []
            for page in reader.pages[:MAX_EXTRACT_PAGES]:
                try:
                    pages.append(page.extract_text() or "")
                except Exception:
                    continue
            return _clean_extracted_text("\n".join(pages))
        if ext in ("docx", "doc"):
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            return _clean_extracted_text("\n".join(p.text for p in doc.paragraphs))
        if ext == "pptx":
            from pptx import Presentation
            prs = Presentation(io.BytesIO(file_bytes))
            lines = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text") and getattr(shape, "text", "").strip():
                        lines.append(shape.text)
            return _clean_extracted_text("\n".join(lines))
        if ext in ("txt", "md", "csv", "json", "rtf", "log", "html", "htm"):
            for enc in ("utf-8-sig", "utf-8", "latin-1"):
                try:
                    return _clean_extracted_text(file_bytes.decode(enc))
                except (UnicodeDecodeError, ValueError):
                    continue
            return _clean_extracted_text(file_bytes.decode("utf-8", errors="ignore"))
        if f".{ext}" in IMAGE_EXTENSIONS:
            import base64
            mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp", "bmp": "image/bmp"}
            mime = mime_map.get(ext, f"image/{ext}")
            image_b64 = base64.b64encode(file_bytes).decode("ascii")
            vision_text = describe_image_with_groq(image_b64, mime)
            if vision_text:
                return _clean_extracted_text(vision_text)
            print(f"[Upload] Vision extraction returned no text for .{ext}; using fallback.")
    except Exception as e:
        print(f"[Upload] Text extraction failed for extension .{ext}: {e}")
    return ""
