import os
import secrets
from datetime import datetime, timedelta

from config import ALLOW_LOCAL_FALLBACK, IS_PRODUCTION, _UPLOADS_DIR

# Extensions we are willing to persist and serve. Anything outside this set is
# rejected at the upload layer (app.ALLOWED_MATERIAL_EXTENSIONS); this list is
# the storage-layer backstop. html/htm/svg are deliberately absent: they would be
# served as active content and enable stored XSS via an uploaded web page.
SAFE_LOCAL_EXTENSIONS = {
    "pdf", "doc", "docx", "pptx", "txt", "md", "csv", "json", "rtf", "log",
    "jpg", "jpeg", "png", "gif", "webp", "bmp",
}

# Document types Cloudinary stores as "raw" resources. Their public_id must keep
# the extension so the delivered URL ends in .docx/.pptx/etc. - Microsoft's Office
# viewer (used for inline Word/PowerPoint previews) identifies the format from the
# URL path and fails with "File Not Found" when the extension is missing.
RAW_DOCUMENT_EXTENSIONS = {
    "doc", "docx", "ppt", "pptx", "txt", "md", "csv", "json", "rtf", "log",
}

# Signed URL expiry for Cloudinary private resources (seconds).
CLOUDINARY_SIGNED_URL_EXPIRY_SECONDS = 300  # 5 minutes


def _safe_upload_name(original_filename):
    """Derives a server-controlled filename from a client-provided one.

    The client's name is never used as a filesystem path: ``os.path.basename``
    strips any directory components (path traversal), and the extension must be
    on the allowlist before it is persisted (XSS via html/svg).
    """
    ext = os.path.splitext(os.path.basename(original_filename or ""))[1].replace(".", "").lower()
    if ext not in SAFE_LOCAL_EXTENSIONS:
        ext = "bin"
    token = secrets.token_hex(10)
    return f"{token}.{ext}"


def upload_file_to_cloud(file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> str:
    """
    Uploads file to Cloudinary or Firebase Storage based on configuration.
    Falls back to local persistent upload directory only when no cloud target is
    configured, or when ALLOW_LOCAL_FALLBACK=true is explicitly set.

    ``filename`` is only a cosmetic extension hint; the persisted object always
    uses a server-generated random name so clients can never influence the stored
    path (blocks path traversal and overwriting existing cloud objects).

    Returns a storage key (Cloudinary public_id, Firebase blob name, or local
    filename) that can be passed to ``get_signed_download_url`` to obtain a
    short-lived signed URL for download.

    Raises RuntimeError when a cloud target is configured, every cloud attempt
    fails, and ALLOW_LOCAL_FALLBACK is not enabled -- so production never
    silently writes to ephemeral local disk instead of cloud storage.
    """
    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    cloud_configured = bool(cloudinary_url) or bool(firebase_creds)
    safe_name = _safe_upload_name(filename)
    safe_ext = os.path.splitext(safe_name)[1].lstrip(".").lower()
    # Keep the extension for raw documents (public preview relies on it); images
    # and other resources use an extension-less public_id as before.
    public_id = safe_name if safe_ext in RAW_DOCUMENT_EXTENSIONS else os.path.splitext(safe_name)[0]

    last_error = None

    # 1. Try Cloudinary Upload (private resource - not publicly accessible)
    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(cloudinary_url=cloudinary_url)
            result = cloudinary.uploader.upload(
                file_bytes,
                resource_type="raw",
                folder="studylens_materials",
                public_id=public_id,
                access_mode="authenticated",  # Private resource - requires signed URL
            )
            public_id = result.get("public_id") or public_id
            if public_id:
                print(f"[Cloud Storage] Uploaded file {safe_name} to Cloudinary (private).")
                return public_id
        except Exception as err:
            last_error = err
            print(f"[Cloud Storage Error] Cloudinary upload failed: {err}")

    # 2. Try Firebase Storage Upload (private by default)
    if firebase_creds and os.path.exists(firebase_creds):
        try:
            import firebase_admin
            from firebase_admin import credentials, storage

            if not firebase_admin._apps:
                cred = credentials.Certificate(firebase_creds)
                firebase_admin.initialize_app(cred, {
                    'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET", "studylens-ai.appspot.com")
                })

            bucket = storage.bucket()
            blob_name = f"lecture_materials/{safe_name}"
            blob = bucket.blob(blob_name)
            blob.upload_from_string(file_bytes, content_type=content_type)
            # Objects are private by default; callers must gate access through an
            # authenticated path rather than relying on a public URL.
            print(f"[Cloud Storage] Uploaded file {safe_name} to Firebase Storage (private).")
            return blob_name
        except Exception as err:
            last_error = err
            print(f"[Cloud Storage Error] Firebase upload failed: {err}")

    # 3. Local uploads fallback
    if not cloud_configured:
        if IS_PRODUCTION:
            raise RuntimeError(
                "No cloud storage configured. Local uploads are ephemeral and "
                "not shared between serverless instances; set CLOUDINARY_URL "
                "(or Firebase credentials) in production."
            )
        # No cloud target configured: local disk is the expected dev store.
        print("[Cloud Storage] No cloud target configured; using local storage fallback.")
        return _save_local(safe_name, file_bytes)

    # A cloud target was configured but every attempt failed. Silently falling
    # back to local disk would hide the failure and write to ephemeral storage.
    if ALLOW_LOCAL_FALLBACK:
        print(f"[Cloud Storage] Cloud upload failed ({last_error}); ALLOW_LOCAL_FALLBACK=true, using local storage fallback.")
        return _save_local(safe_name, file_bytes)

    raise RuntimeError(
        "Cloud storage upload failed and ALLOW_LOCAL_FALLBACK is disabled. "
        "Configure cloud credentials, enable ALLOW_LOCAL_FALLBACK=true only for "
        f"local development, or fix the cloud error: {last_error}"
    )


def upload_avatar_to_cloud(file_bytes: bytes, filename: str, content_type: str = "image/png") -> str:
    """Upload a profile image and return a directly renderable public URL.

    Material uploads are intentionally private and return storage keys that need
    short-lived signed URLs. Avatars are different: they are rendered by ``<img>``
    tags across the app, so they must be public images with stable URLs. Legacy
    avatar values that are storage keys are treated as non-renderable by the
    frontend and fall back to initials until uploaded again.
    """
    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    cloud_configured = bool(cloudinary_url) or bool(firebase_creds)
    safe_name = _safe_upload_name(filename)
    public_id = os.path.splitext(safe_name)[0]
    last_error = None

    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(cloudinary_url=cloudinary_url)
            result = cloudinary.uploader.upload(
                file_bytes,
                resource_type="image",
                folder="studylens_avatars",
                public_id=public_id,
                overwrite=False,
            )
            avatar_url = result.get("secure_url") or result.get("url")
            if avatar_url:
                print(f"[Cloud Storage] Uploaded avatar {safe_name} to Cloudinary (public image).")
                return avatar_url
            raise RuntimeError("Cloudinary avatar upload returned no URL.")
        except Exception as err:
            last_error = err
            print(f"[Cloud Storage Error] Cloudinary avatar upload failed: {err}")

    if firebase_creds and os.path.exists(firebase_creds):
        try:
            import firebase_admin
            from firebase_admin import credentials, storage

            if not firebase_admin._apps:
                cred = credentials.Certificate(firebase_creds)
                firebase_admin.initialize_app(cred, {
                    'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET", "studylens-ai.appspot.com")
                })

            bucket = storage.bucket()
            blob = bucket.blob(f"avatars/{safe_name}")
            blob.upload_from_string(file_bytes, content_type=content_type)
            blob.make_public()
            print(f"[Cloud Storage] Uploaded avatar {safe_name} to Firebase Storage (public).")
            return blob.public_url
        except Exception as err:
            last_error = err
            print(f"[Cloud Storage Error] Firebase avatar upload failed: {err}")

    if not cloud_configured or ALLOW_LOCAL_FALLBACK:
        print(f"[Cloud Storage] Using local avatar storage fallback ({last_error or 'no cloud target'}).")
        return _save_local(safe_name, file_bytes)

    raise RuntimeError(
        "Cloud avatar upload failed and ALLOW_LOCAL_FALLBACK is disabled. "
        "Configure cloud credentials, enable ALLOW_LOCAL_FALLBACK=true only for "
        f"local development, or fix the cloud error: {last_error}"
    )


def _save_local(name: str, file_bytes: bytes) -> str:
    """Persist bytes to the configured local uploads fallback directory."""
    upload_dir = _UPLOADS_DIR
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, name)
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    print(f"[Cloud Storage] Saved file {name} to local storage fallback.")
    return f"/uploads/{name}"


def get_signed_download_url(storage_key: str, ext: str = "bin") -> str:
    """
    Generate a short-lived signed URL for downloading a privately stored file.

    For Cloudinary resources, generates a signed download URL valid for
    ``CLOUDINARY_SIGNED_URL_EXPIRY_SECONDS``. For Firebase resources, generates
    a signed download URL. For local files, returns the local /uploads/ path
    (already protected by authentication middleware).

    ``ext`` is the file extension used to set the correct filename in the
    signed URL.
    """
    # Local file path - already protected by auth middleware
    if storage_key.startswith("/uploads/"):
        return storage_key

    # Reject any URL that looks like a client-supplied URL (http://, https://,
    # ftp://, file://) - these are not valid storage keys and should have been
    # rejected earlier in the request pipeline.
    if storage_key.startswith(("http://", "https://", "ftp://", "file://")):
        raise ValueError(f"Invalid storage key (not a cloud storage key): {storage_key}")

    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.utils

            cloudinary.config(cloudinary_url=cloudinary_url)
            signed_url = cloudinary.utils.private_download_url(
                storage_key,
                ext,
                resource_type="raw",
                type="upload",
                expire=CLOUDINARY_SIGNED_URL_EXPIRY_SECONDS,
            )
            return signed_url
        except Exception as err:
            print(f"[Cloud Storage] Signed URL generation failed: {err}")

    firebase_creds = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    if firebase_creds and os.path.exists(firebase_creds):
        try:
            import firebase_admin
            from firebase_admin import credentials, storage

            if not firebase_admin._apps:
                cred = credentials.Certificate(firebase_creds)
                firebase_admin.initialize_app(cred, {
                    'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET", "studylens-ai.appspot.com")
                })

            bucket = storage.bucket()
            blob = bucket.blob(storage_key)
            signed_url = blob.generate_signed_url(
                expiration=datetime.utcnow() + timedelta(seconds=CLOUDINARY_SIGNED_URL_EXPIRY_SECONDS),
                method="GET",
            )
            return signed_url
        except Exception as err:
            print(f"[Cloud Storage] Firebase signed URL generation failed: {err}")

    # Local file: return the local path (already protected by auth middleware)
    if storage_key.startswith("/uploads/"):
        return storage_key

    raise ValueError(f"Cannot generate signed URL for unknown storage key: {storage_key}")
