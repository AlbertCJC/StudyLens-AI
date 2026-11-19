"""Configuration fail-fast and OTP disclosure tests (P1-03, P1-11)."""

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

import pytest

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
        "SEED_DEMO_DATA": "false",
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


def test_published_jwt_secret_is_rejected():
    result = _run_config({"JWT_SECRET": "studylens_ai_jwt_secret_key_2026"})
    assert result.returncode != 0
    assert "placeholder" in (result.stderr + result.stdout).lower()


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


def test_component_mysql_url_encodes_password_and_tidb_port(monkeypatch):
    monkeypatch.setenv("MYSQL_HOST", "gateway01.ap-southeast-1.prod.aws.tidbcloud.com")
    monkeypatch.setenv("MYSQL_PORT", "4000")
    monkeypatch.setenv("MYSQL_USER", "3mEL1AamVGFwDez.root")
    monkeypatch.setenv("MYSQL_PASSWORD", "p@ss:w/rd#1")
    monkeypatch.setenv("MYSQL_DB", "test")

    from config import _mysql_url_from_env

    url = _mysql_url_from_env()
    assert url.startswith("mysql+pymysql://")
    assert "3mEL1AamVGFwDez.root" in url
    assert ":4000/test" in url
    assert "p%40ss%3Aw%2Frd%231" in url
    assert "charset=utf8mb4" in url
    assert "connect_timeout=10" in url


def test_ssl_mode_is_stripped_and_ca_is_appended(monkeypatch, tmp_path):
    ca = tmp_path / "tidb-ca.pem"
    ca.write_text("-----BEGIN CERTIFICATE-----\n", encoding="utf-8")
    monkeypatch.setenv("MYSQL_SSL_CA", str(ca))

    from config import _mysql_url_with_ssl

    url = _mysql_url_with_ssl(
        "mysql+pymysql://u:p@h:4000/test?ssl-mode=VERIFY_IDENTITY&charset=utf8mb4"
    )
    query_keys = {
        key.lower()
        for key, _ in parse_qsl(urlsplit(url).query, keep_blank_values=True)
    }
    assert "ssl-mode" not in query_keys
    assert "ssl_mode" not in query_keys
    assert "charset" in query_keys
    assert "ssl_ca" in query_keys
    assert "tidb-ca.pem" in url


def test_ssl_mode_verification_without_ca_fails_fast(monkeypatch):
    monkeypatch.delenv("MYSQL_SSL_CA", raising=False)

    from config import _mysql_url_with_ssl

    with pytest.raises(RuntimeError, match="MYSQL_SSL_CA"):
        _mysql_url_with_ssl(
            "mysql+pymysql://u:p@h:4000/test?ssl-mode=VERIFY_IDENTITY"
        )


def test_ssl_mode_required_without_ca_fails_fast(monkeypatch):
    monkeypatch.delenv("MYSQL_SSL_CA", raising=False)

    from config import _mysql_url_with_ssl

    with pytest.raises(RuntimeError, match="MYSQL_SSL_CA"):
        _mysql_url_with_ssl("mysql+pymysql://u:p@h:4000/test?ssl-mode=REQUIRED")


def test_ssl_mode_disabled_is_stripped_without_ca(monkeypatch):
    monkeypatch.delenv("MYSQL_SSL_CA", raising=False)

    from config import _mysql_url_with_ssl

    url = _mysql_url_with_ssl("mysql+pymysql://u:p@h:4000/test?ssl-mode=DISABLED")
    assert "ssl-mode" not in url
    assert "ssl_ca=" not in url


def test_db_pool_recycle_is_configurable():
    result = subprocess.run(
        [sys.executable, "-c", "import config; print(config.DB_POOL_RECYCLE)"],
        cwd=BACKEND_DIR,
        env={
            **os.environ,
            "JWT_SECRET": "test-secret-key-for-config-checks-0123456789",
            "FLASK_ENV": "development",
            "MYSQL_DATABASE_URL": "",
            "MYSQL_HOST": "",
            "DB_POOL_RECYCLE": "123",
        },
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip().splitlines()[-1] == "123"


def test_health_reports_database_target(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status"] == "ok"
    assert body["databaseBackend"] in ("sqlite", "mysql")
    assert body["databaseReady"] is True
