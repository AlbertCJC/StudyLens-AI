"""Production WSGI entrypoint for StudyLens AI backend.

Gunicorn (Linux) or Waitress (Windows) loads the Flask ``app`` object from this
module. Configuration is read entirely from the environment via ``backend/.env``
and ``backend/config.py``; no secrets are baked into the image.
"""

from app import app

if __name__ == "__main__":
    # Only used for local `python wsgi.py`; production uses gunicorn/waitress.
    app.run()
