import os
import secrets

# Extensions we are willing to persist and serve. Anything outside this set is
# rejected at the upload layer (app.ALLOWED_MATERIAL_EXTENSIONS); this list is
# the storage-layer backstop. html/htm/svg are deliberately absent: they would be
# served as active content and enable stored XSS via an uploaded web page.
SAFE_LOCAL_EXTENSIONS = {
    "pdf", "doc", "docx", "pptx", "txt", "md", "csv", "json", "rtf", "log",
    "jpg", "jpeg", "png", "gif", "webp", "bmp",
}

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
    Falls back to local persistent upload directory if cloud service keys are absent.

    ``filename`` is only a cosmetic extension hint; the persisted object always
    uses a server-generated random name so clients can never influence the stored
    path (blocks path traversal and overwriting existing cloud objects).
    """
    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    safe_name = _safe_upload_name(filename)

    # 1. Try Cloudinary Upload
    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(cloudinary_url=cloudinary_url)
            result = cloudinary.uploader.upload(
                file_bytes,
                resource_type="auto",
                folder="studylens_materials",
                public_id=os.path.splitext(safe_name)[0]
            )
            secure_url = result.get("secure_url") or result.get("url")
            if secure_url:
                print(f"[Cloud Storage] Uploaded file {safe_name} to Cloudinary successfully.")
                return secure_url
        except Exception as err:
            print(f"[Cloud Storage Error] Cloudinary upload failed: {err}")

    # 2. Try Firebase Storage Upload
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
            blob = bucket.blob(f"lecture_materials/{safe_name}")
            blob.upload_from_string(file_bytes, content_type=content_type)
            blob.make_public()
            print(f"[Cloud Storage] Uploaded file {safe_name} to Firebase Storage.")
            return blob.public_url
        except Exception as err:
            print(f"[Cloud Storage Error] Firebase upload failed: {err}")

    # 3. Persistent Local Uploads Fallback
    # Path-independent: resolves to the backend/uploads folder next to this file,
    # regardless of which directory the Flask process is launched from.
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    print(f"[Cloud Storage] Saved file {safe_name} to local storage fallback.")
    return f"/uploads/{safe_name}"
