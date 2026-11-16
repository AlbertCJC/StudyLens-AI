"""Cloud storage silent-local-fallback behavior (P2-16)."""

import os
import glob

import cloud_storage


def _no_cloud(monkeypatch):
    monkeypatch.setenv("CLOUDINARY_URL", "")
    monkeypatch.setenv("FIREBASE_CREDENTIALS", "")


def test_no_cloud_configured_uses_local_fallback(monkeypatch, tmp_path):
    """With no cloud target configured, upload falls back to local disk."""
    _no_cloud(monkeypatch)
    monkeypatch.setattr(cloud_storage, "__file__", str(tmp_path / "cloud_storage.py"))
    url = cloud_storage.upload_file_to_cloud(b"data", "report.pdf", "application/pdf")
    assert url.startswith("/uploads/") and url.endswith(".pdf")
    saved = glob.glob(str(tmp_path / "uploads" / "*.pdf"))
    assert len(saved) == 1


def test_cloud_configured_but_fails_raises_when_fallback_disabled(monkeypatch):
    """Configured cloud that fails must raise, not silently use local disk."""
    monkeypatch.setenv("CLOUDINARY_URL", "cloudinary://key:secret@cloud")
    monkeypatch.setenv("FIREBASE_CREDENTIALS", "")
    cloud_storage.ALLOW_LOCAL_FALLBACK = False
    try:
        try:
            cloud_storage.upload_file_to_cloud(b"data", "report.pdf", "application/pdf")
            assert False, "expected RuntimeError"
        except RuntimeError as exc:
            assert "ALLOW_LOCAL_FALLBACK" in str(exc)
    finally:
        cloud_storage.ALLOW_LOCAL_FALLBACK = False


def test_cloud_configured_but_fails_falls_back_when_flag_true(monkeypatch, tmp_path):
    """Configured cloud that fails falls back to local only when flag is true."""
    monkeypatch.setenv("CLOUDINARY_URL", "cloudinary://key:secret@cloud")
    monkeypatch.setenv("FIREBASE_CREDENTIALS", "")
    cloud_storage.ALLOW_LOCAL_FALLBACK = True
    monkeypatch.setattr(cloud_storage, "__file__", str(tmp_path / "cloud_storage.py"))
    try:
        url = cloud_storage.upload_file_to_cloud(b"data", "report.pdf", "application/pdf")
        assert url.startswith("/uploads/") and url.endswith(".pdf")
    finally:
        cloud_storage.ALLOW_LOCAL_FALLBACK = False
