"""Structured logging + request ID (P2-14)."""

import json
import logging

from lib.logging_config import (
    _RedactingFormatter,
    configure_logging,
    get_request_id,
    request_id_middleware,
)


def test_configure_logging_sets_json_in_production(app_instance, monkeypatch):
    """LOG_FORMAT=json selects the JSON redacting formatter."""
    monkeypatch.setenv("LOG_FORMAT", "json")
    app = app_instance
    configure_logging(app)
    root = logging.getLogger()
    assert any(isinstance(h.formatter, _RedactingFormatter) for h in root.handlers)


def test_request_id_echoed_in_response(client):
    """X-Request-ID is echoed back in the response header."""
    resp = client.get("/api/health", headers={"X-Request-ID": "req-test-1234"})
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-ID") == "req-test-1234"


def test_request_id_generated_when_absent(client):
    """A request ID is generated when the client does not supply one."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    rid = resp.headers.get("X-Request-ID")
    assert rid is not None and rid.startswith("req-")


def test_get_request_id_outside_request():
    """get_request_id returns None outside a request context."""
    assert get_request_id() is None
