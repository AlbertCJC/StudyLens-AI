"""Structured request logging (P2-14).

Configures the standard ``logging`` module with a JSON formatter so every log
record is machine-parseable. Adds a request-ID middleware: reads or generates
``X-Request-ID``, stores it in a context variable, includes it in every log
record and in unhandled-error responses. Redacts tokens, OTPs, passwords and
authorization headers from log output.
"""

import contextvars
import json
import logging
import os
import re
import uuid

from flask import Flask, jsonify, request

from config import IS_PRODUCTION

# Context variable holding the current request ID (set by middleware).
_request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


def get_request_id() -> str | None:
    """Returns the request ID for the current context, or None."""
    return _request_id_var.get()


class _RedactingFormatter(logging.Formatter):
    """JSON log formatter that redacts sensitive values."""

    _SECRET_PATTERNS = [
        re.compile(r"(Authorization\s*:\s*)[^\s,;]+", re.IGNORECASE),
        re.compile(r"(Bearer\s+)[^\s,;]+", re.IGNORECASE),
        re.compile(r"(password|passwd|pwd|secret|api[_-]?key|token)[^\n,;\"']{0,60}", re.IGNORECASE),
        re.compile(r"\b\d{6}\b"),  # one-time codes
    ]

    def _redact(self, message: str) -> str:
        for pattern in self._SECRET_PATTERNS:
            message = pattern.sub(lambda m: m.group(1) + "***REDACTED***", message)
        return message

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%SZ"),
            "level": record.levelname,
            "logger": record.name,
            "message": self._redact(record.getMessage()),
            "requestId": get_request_id(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # Attach optional structured fields logged via ``extra=``.
        for key in ("user_id", "route", "material_id", "latency_ms"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload, separators=(",", ":"))


def configure_logging(app: Flask) -> None:
    """Configure structured logging for the Flask application.

    In production logs are emitted as JSON; in development a plain-text
    formatter is used unless ``LOG_FORMAT=json`` is set.
    """
    log_level = logging.DEBUG if app.debug or not IS_PRODUCTION else logging.INFO
    log_format = os.getenv("LOG_FORMAT", "text" if not IS_PRODUCTION else "json")
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler()
    if log_format == "json":
        handler.setFormatter(_RedactingFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
        )
    root.addHandler(handler)
    root.setLevel(log_level)

    # Quiet noisy third-party loggers.
    for name in ("werkzeug", "urllib3", "sqlalchemy"):
        logging.getLogger(name).setLevel(logging.WARNING)

    app.logger.handlers = root.handlers
    app.logger.setLevel(log_level)
    app.logger.propagate = False


def _generate_request_id() -> str:
    return f"req-{uuid.uuid4().hex[:16]}"


def request_id_middleware(app: Flask):
    """Installs before/after request hooks that assign and propagate a request ID.

    The request ID is read from the ``X-Request-ID`` header when present, or
    generated. It is stored in a context variable so log records emitted during
    the request carry it, and echoed back in the ``X-Request-ID`` response
    header and in unhandled-error JSON bodies.
    """

    @app.before_request
    def _assign_request_id():
        request_id = request.headers.get("X-Request-ID") or _generate_request_id()
        token = _request_id_var.set(request_id)
        request.request_id = request_id
        request._request_id_token = token

    @app.after_request
    def _echo_request_id(response):
        request_id = get_request_id() or ""
        token = getattr(request, "_request_id_token", None)
        if token is not None:
            _request_id_var.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.errorhandler(Exception)
    def _handle_unhandled(err):  # type: ignore[no-redef]
        app.logger.exception("Unhandled exception during request")
        return (
            jsonify({
                "error": "Internal server error.",
                "code": "INTERNAL_ERROR",
                "requestId": get_request_id(),
            }),
            500,
        )
