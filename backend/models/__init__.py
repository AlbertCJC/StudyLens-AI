"""ORM models grouped by domain."""

from models.audit import (
    ActivityLogArchiveModel,
    ActivityLogModel,
    SystemSettingModel,
)
from models.communication import AnnouncementModel, NotificationModel
from models.material import (
    AIGeneratedContentModel,
    MaterialFlagModel,
    MaterialModel,
)
from models.progress import StudentProgressModel
from models.quiz import QuizAttemptModel, QuizModel, QuizQuestionModel
from models.report import ReportModel
from models.subject import StudentSubjectModel, SubjectModel
from models.user import RoleModel, UserModel

__all__ = [
    "AIGeneratedContentModel",
    "ActivityLogArchiveModel",
    "ActivityLogModel",
    "AnnouncementModel",
    "MaterialFlagModel",
    "MaterialModel",
    "NotificationModel",
    "QuizAttemptModel",
    "QuizModel",
    "QuizQuestionModel",
    "ReportModel",
    "RoleModel",
    "StudentProgressModel",
    "StudentSubjectModel",
    "SubjectModel",
    "SystemSettingModel",
    "UserModel",
]
