"""Shared Flask extension instances.

Keeping the ORM handle here (instead of creating it in ``app.py``) lets models,
services and blueprints import the same instance without importing the Flask
application and creating circular dependencies.
"""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
