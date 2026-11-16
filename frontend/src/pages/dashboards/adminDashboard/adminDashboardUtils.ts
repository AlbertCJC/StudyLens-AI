export const LOG_PAGE_SIZE = 10;

export const MODERATION_FILTER = "__moderation__";

export const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "User logged in",
  USER_REGISTER: "New account registered",
  USER_CREATED: "User account created",
  USER_UPDATED: "User profile updated",
  USER_STATUS_CHANGED: "Account status changed",
  USER_DELETED: "User account deleted",
  PASSWORD_RESET: "Password reset",
  RESET_OTP_REQUESTED: "Password reset requested",
  PASSWORD_CHANGED: "Password changed",
  LOGIN_FAILED: "Failed login attempt",
  MATERIAL_UPLOAD: "Material uploaded",
  MATERIAL_UPDATE: "Material updated",
  MATERIAL_DELETE: "Material deleted",
  MATERIAL_AI_SAVE: "AI material saved",
  MATERIAL_FLAG: "Material flagged for review",
  MATERIAL_FLAG_RESOLVED: "Material flag resolved",
  QUIZ_CREATE: "Quiz created",
  QUIZ_UPDATE: "Quiz updated",
  QUIZ_DELETE: "Quiz deleted",
  QUIZ_PUBLISH: "Quiz published",
  QUIZ_UNPUBLISH: "Quiz unpublished",
  QUIZ_SUBMIT: "Quiz submitted",
  ANNOUNCEMENT_POSTED: "Announcement posted",
  ANNOUNCEMENT_DELETED: "Announcement deleted",
  SETTINGS_UPDATED: "Settings updated",
  SYSTEM_BOOT: "System boot",
  SUBJECT_CREATE: "Subject created",
  SUBJECT_UPDATE: "Subject updated",
  SUBJECT_DELETE: "Subject deleted",
  SUBJECT_ENROLL: "Students assigned to subject",
  SUBJECT_UNENROLL: "Students removed from subject",
  AI_QUIZ_GENERATE: "AI quiz generated",
  AI_SUMMARY_GENERATE: "AI summary generated",
  AI_REVIEWER_GENERATE: "AI reviewer generated",
  AI_FLASHCARDS_GENERATE: "AI flashcards generated",
  AI_RESOURCE_GENERATE: "AI resource generated",
  AI_RESOURCE_SAVE: "AI resource saved",
  AI_SERVICE_DOWN: "AI service unavailable",
  FLASHCARD_UPDATE: "Flashcard deck updated",
  FLASHCARD_DELETE: "Flashcard deck deleted",
  SUMMARY_UPDATE: "Summary updated",
  SUMMARY_DELETE: "Summary deleted",
  REVIEWER_UPDATE: "Reviewer updated",
  REVIEWER_DELETE: "Reviewer deleted",
  REPORT_GENERATE: "Report generated",
  LOGS_CLEARED: "Activity logs cleared",
  DIAGNOSTIC_CHECK: "System diagnostic run",
};

export const ACTION_CATEGORY: Record<string, { group: string; badge: string }> = {
  USER_LOGIN: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_REGISTER: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_CREATED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_UPDATED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_STATUS_CHANGED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_DELETED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PASSWORD_RESET: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  RESET_OTP_REQUESTED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PASSWORD_CHANGED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LOGIN_FAILED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  MATERIAL_UPLOAD: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_UPDATE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_DELETE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_AI_SAVE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_FLAG: { group: "Learning Materials", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  MATERIAL_FLAG_RESOLVED: { group: "Learning Materials", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  QUIZ_CREATE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_UPDATE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_DELETE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_PUBLISH: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_UNPUBLISH: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_SUBMIT: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  SUBJECT_CREATE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_UPDATE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_DELETE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_ENROLL: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_UNENROLL: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  AI_QUIZ_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_SUMMARY_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_REVIEWER_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_FLASHCARDS_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_RESOURCE_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_RESOURCE_SAVE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_SERVICE_DOWN: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  FLASHCARD_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  FLASHCARD_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  SUMMARY_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  SUMMARY_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEWER_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEWER_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ANNOUNCEMENT_POSTED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ANNOUNCEMENT_DELETED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  SETTINGS_UPDATED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  SYSTEM_BOOT: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  REPORT_GENERATE: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  LOGS_CLEARED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  DIAGNOSTIC_CHECK: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

export const ACTION_GROUPS: { group: string; codes: string[] }[] = [
  {
    group: "Accounts & Authentication",
    codes: ["USER_LOGIN", "USER_REGISTER", "USER_CREATED", "USER_UPDATED", "USER_STATUS_CHANGED", "USER_DELETED", "PASSWORD_CHANGED", "PASSWORD_RESET", "RESET_OTP_REQUESTED", "LOGIN_FAILED"],
  },
  {
    group: "Learning Materials",
    codes: ["MATERIAL_UPLOAD", "MATERIAL_UPDATE", "MATERIAL_DELETE", "MATERIAL_AI_SAVE", "MATERIAL_FLAG", "MATERIAL_FLAG_RESOLVED"],
  },
  {
    group: "Quizzes & Assessments",
    codes: ["QUIZ_CREATE", "QUIZ_UPDATE", "QUIZ_DELETE", "QUIZ_PUBLISH", "QUIZ_UNPUBLISH", "QUIZ_SUBMIT"],
  },
  {
    group: "Subjects & Enrollments",
    codes: ["SUBJECT_CREATE", "SUBJECT_UPDATE", "SUBJECT_DELETE", "SUBJECT_ENROLL", "SUBJECT_UNENROLL"],
  },
  {
    group: "AI Generation & Resources",
    codes: ["AI_QUIZ_GENERATE", "AI_SUMMARY_GENERATE", "AI_REVIEWER_GENERATE", "AI_FLASHCARDS_GENERATE", "AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE", "AI_SERVICE_DOWN", "FLASHCARD_UPDATE", "FLASHCARD_DELETE", "SUMMARY_UPDATE", "SUMMARY_DELETE", "REVIEWER_UPDATE", "REVIEWER_DELETE"],
  },
  {
    group: "System & Announcements",
    codes: ["ANNOUNCEMENT_POSTED", "ANNOUNCEMENT_DELETED", "SETTINGS_UPDATED", "SYSTEM_BOOT", "REPORT_GENERATE", "LOGS_CLEARED", "DIAGNOSTIC_CHECK"],
  },
];

export const actionLabel = (code: string): string => ACTION_LABELS[code] || code;

export const actionCategory = (code: string): { group: string; badge: string } =>
  ACTION_CATEGORY[code] || { group: "Other", badge: "bg-muted text-muted-foreground" };

export const DEFAULT_SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];

export const DEFAULT_COURSES = ["BSIT", "BSCS", "BSIS", "BSCPE"];
