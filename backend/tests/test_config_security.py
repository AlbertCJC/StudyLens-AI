"""Configuration fail-fast and OTP disclosure tests (P1-03, P1-11)."""

import os
import subprocess
import sys
from pathlib import Path

import lib.constants as constants


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _run_config(extra_env):
    env = os.environ.copy()
    env.update({
        "JWT_SECRET": "test-secret-key-for-config-checks-0123456789",
        "FLASK_ENV": "development",
        "OTP_DEV_REVEAL": "false",
        "MYSQL_DATABASE_URL": "",
        "MYSQL_HOST": "",
        "ALLOW_SQLITE_FALLBACK": "false",
    })
    env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-c", "import config; print(config.DB_TARGET)"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_otp_reveal_disabled_when_flag_false(monkeypatch):
    monkeypatch.setattr(constants, "OTP_DEV_REVEAL", False)
    monkeypatch.setattr(constants, "IS_PRODUCTION", False)
    monkeypatch.setenv("FLASK_ENV", "development")
    assert constants.otp_reveal_enabled() is False


def test_otp_reveal_disabled_in_production_even_when_flag_true(monkeypatch):
    monkeypatch.setattr(constants, "OTP_DEV_REVEAL", True)
    monkeypatch.setattr(constants, "IS_PRODUCTION", True)
    monkeypatch.setenv("FLASK_ENV", "production")
    assert constants.otp_reveal_enabled() is False


def test_otp_reveal_enabled_in_development(monkeypatch):
    monkeypatch.setattr(constants, "OTP_DEV_REVEAL", True)
    monkeypatch.setattr(constants, "IS_PRODUCTION", False)
    monkeypatch.setenv("FLASK_ENV", "development")
    assert constants.otp_reveal_enabled() is True


def test_production_startup_rejects_otp_reveal_flag():
    result = _run_config({"FLASK_ENV": "production", "OTP_DEV_REVEAL": "true"})
    assert result.returncode != 0
    assert "OTP_DEV_REVEAL" in (result.stderr + result.stdout)


def test_production_requires_mysql_target():
    result = _run_config({"FLASK_ENV": "production"})
    assert result.returncode != 0
    assert "MYSQL_DATABASE_URL" in (result.stderr + result.stdout)


def test_production_mysql_failure_raises_even_with_fallback():
    result = _run_config({
        "FLASK_ENV": "production",
        "MYSQL_DATABASE_URL": "mysql+pymysql://u:p@127.0.0.1:9/db",
        "ALLOW_SQLITE_FALLBACK": "true",
    })
    assert result.returncode != 0
    assert "unreachable" in (result.stderr + result.stdout).lower()


def test_development_fallback_requires_flag():
    result = _run_config({
        "FLASK_ENV": "development",
        "MYSQL_DATABASE_URL": "mysql+pymysql://u:p@127.0.0.1:9/db",
        "ALLOW_SQLITE_FALLBACK": "false",
    })
    assert result.returncode != 0


def test_development_fallback_allowed_when_flag_true():
    result = _run_config({
        "FLASK_ENV": "development",
        "MYSQL_DATABASE_URL": "mysql+pymysql://u:p@127.0.0.1:9/db",
        "ALLOW_SQLITE_FALLBACK": "true",
    })
    assert result.returncode == 0, result.stderr
    assert "sqlite" in result.stdout.lower()


def test_health_reports_database_target(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status"] == "ok"
    assert body["databaseBackend"] in ("sqlite", "mysql")
    assert body["databaseReady"] is True
