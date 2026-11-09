"""Re-upload legacy material documents whose Cloudinary URLs lack a file extension.

Cloudinary raw resources uploaded before the cloud_storage fix were stored with an
extension-less public_id, so their delivery URL (e.g. .../studylens_materials/abc)
has no .docx/.pptx suffix. Microsoft's Office viewer cannot identify the format
from such a URL and reports "File Not Found".

This script fetches each affected file, re-uploads it with the correct extension,
and updates the learning_materials.file_url in place. It is safe to re-run: files
whose URL already ends in the expected extension are skipped.

Usage:
    python scripts/repair_material_file_urls.py --dry-run
    python scripts/repair_material_file_urls.py
"""

import argparse
import os
import sys
from urllib.parse import urlparse
from urllib.request import urlopen

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(BASE_DIR, ".env"))

import pymysql
from sqlalchemy.engine import make_url

from cloud_storage import upload_file_to_cloud, RAW_DOCUMENT_EXTENSIONS


def connect():
    raw_url = os.getenv("MYSQL_DATABASE_URL", "").strip()
    if raw_url:
        url = make_url(raw_url)
        return pymysql.connect(
            host=url.host,
            user=url.username,
            password=url.password or "",
            database=url.database,
            port=url.port or 3306,
            connect_timeout=5,
        )
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB", "studylens_db"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        connect_timeout=5,
    )


def url_has_extension(url: str, ext: str) -> bool:
    path = urlparse(url).path.lower()
    if path.endswith(f".{ext}"):
        return True
    # Treat equivalent Word/PowerPoint extensions as already valid.
    return (ext == "doc" and path.endswith(".docx")) or (
        ext == "ppt" and path.endswith(".pptx")
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List candidates without changing anything")
    args = parser.parse_args()

    conn = connect()
    cursor = conn.cursor()
    placeholders = ", ".join(["%s"] * len(RAW_DOCUMENT_EXTENSIONS))
    cursor.execute(
        f"SELECT material_id, title, file_type, file_url FROM learning_materials "
        f"WHERE file_type IN ({placeholders})",
        tuple(sorted(RAW_DOCUMENT_EXTENSIONS)),
    )
    rows = cursor.fetchall()

    repaired = skipped = failed = 0
    for material_id, title, file_type, file_url in rows:
        ext = (file_type or "").lower()
        if not file_url or not file_url.startswith("http"):
            skipped += 1
            continue
        if url_has_extension(file_url, ext):
            skipped += 1
            continue

        print(f"[repair] {title} ({file_type})")
        print(f"  old: {file_url}")
        if args.dry_run:
            continue

        try:
            with urlopen(file_url, timeout=30) as response:
                file_bytes = response.read()
            new_url = upload_file_to_cloud(file_bytes, f"material.{ext}")
            if not new_url or not new_url.startswith("http"):
                raise RuntimeError(f"re-upload did not return a cloud URL: {new_url}")
            cursor.execute(
                "UPDATE learning_materials SET file_url=%s WHERE material_id=%s",
                (new_url, material_id),
            )
            conn.commit()
            print(f"  new: {new_url}")
            repaired += 1
        except Exception as err:  # noqa: BLE001 - keep the script going per file
            conn.rollback()
            print(f"  failed: {err}")
            failed += 1

    cursor.close()
    conn.close()

    print(f"\nDone. repaired={repaired} skipped={skipped} failed={failed}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
