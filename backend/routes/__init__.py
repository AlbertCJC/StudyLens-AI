"""Blueprint registration for the StudyLens HTTP surface."""

from routes.analytics_routes import bp as analytics_bp
from routes.ai_routes import bp as ai_bp
from routes.announcements_routes import bp as announcements_bp
from routes.auth_routes import bp as auth_bp
from routes.files_routes import bp as files_bp
from routes.logs_routes import bp as logs_bp
from routes.materials_routes import bp as materials_bp
from routes.notifications_routes import bp as notifications_bp
from routes.quizzes_routes import bp as quizzes_bp
from routes.resources_routes import bp as resources_bp
from routes.reports_routes import bp as reports_bp
from routes.subjects_routes import bp as subjects_bp
from routes.system_routes import bp as system_bp
from routes.users_routes import bp as users_bp


def register_blueprints(app):
    app.register_blueprint(analytics_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(announcements_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(materials_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(quizzes_bp)
    app.register_blueprint(resources_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(users_bp)
