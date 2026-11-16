# Production Dockerfile for the StudyLens AI backend.
# Build:  docker build -t studylens-ai-backend .
# Run:    docker run --env-file backend/.env -p 5000:5000 studylens-ai-backend
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps (minimal; no build tools needed for wheel-only deps).
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies.
COPY backend/requirements.txt backend/requirements-dev.txt ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Application code.
COPY backend/ ./

# Non-root runtime user.
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# Production WSGI server (gunicorn). Override CMD via docker-compose/env as needed.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "wsgi:app"]
