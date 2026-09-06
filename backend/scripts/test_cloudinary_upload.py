import os
import sys
import time
import urllib.parse
import urllib.request

from dotenv import load_dotenv

import cloudinary
import cloudinary.uploader

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def config_from_url(cloudinary_url):
    parts = urllib.parse.urlsplit(cloudinary_url)
    cloudinary.config(
        cloud_name=parts.hostname,
        api_key=parts.username,
        api_secret=parts.password,
    )


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python test_cloudinary_upload.py <path-to-image>")
    path = sys.argv[1]
    if not os.path.isfile(path):
        sys.exit(f"File not found: {path}")
    ext = os.path.splitext(path)[1].lower()
    if ext not in IMAGE_EXT:
        sys.exit(f"Not an image ({ext}); supported: {sorted(IMAGE_EXT)}")

    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    if not cloudinary_url:
        sys.exit("CLOUDINARY_URL not set in backend/.env")
    config_from_url(cloudinary_url)

    public_id = f"test_upload_{int(time.time())}"
    result = cloudinary.uploader.upload(
        path,
        resource_type="image",
        folder="studylens_test",
        public_id=public_id,
        overwrite=False,
    )
    url = result.get("secure_url") or result.get("url")
    print(f"secure_url : {url}")
    print(f"public_id  : {result.get('public_id')}")
    print(f"format     : {result.get('format')}  width: {result.get('width')}  height: {result.get('height')}  bytes: {result.get('bytes')}")

    status = urllib.request.urlopen(url).status
    print(f"HEAD {url} -> HTTP {status}")
    print("PASS: upload verified" if status == 200 else "FAIL: URL not reachable")


if __name__ == "__main__":
    main()