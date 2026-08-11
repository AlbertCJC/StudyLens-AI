import os
import shutil

def upload_file_to_cloud(file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> str:
    """
    Uploads file to Cloudinary or Firebase Storage based on configuration.
    Falls back to local persistent upload directory if cloud service keys are absent.
    """
    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS", "").strip()
    
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
                public_id=os.path.splitext(filename)[0]
            )
            secure_url = result.get("secure_url") or result.get("url")
            if secure_url:
                print(f"[Cloud Storage] Uploaded file {filename} to Cloudinary successfully.")
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
            blob = bucket.blob(f"lecture_materials/{filename}")
            blob.upload_from_string(file_bytes, content_type=content_type)
            blob.make_public()
            print(f"[Cloud Storage] Uploaded file {filename} to Firebase Storage.")
            return blob.public_url
        except Exception as err:
            print(f"[Cloud Storage Error] Firebase upload failed: {err}")

    # 3. Persistent Local Uploads Fallback
    # Path-independent: resolves to the backend/uploads folder next to this file,
    # regardless of which directory the Flask process is launched from.
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    
    print(f"[Cloud Storage] Saved file {filename} to local storage fallback.")
    return f"/uploads/{filename}"
