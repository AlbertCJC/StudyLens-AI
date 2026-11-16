/**
 * StudyLens AI API Client - Unified Export
 *
 * Domain modules:
 * - client: base URL, auth token, cache, request helpers, shared types
 * - auth: login, 2FA, registration, email verification, password reset
 * - system: system info/settings/backup, connectivity
 * - subjects: subjects, rosters, analytics, progress, grades, quiz attempts
 * - materials: material CRUD, uploads, flags, file URLs
 * - quizzes: quiz CRUD and PDF downloads
 * - ai: generation, drafts, PDF export, flashcards, summaries, reviewers
 * - announcements: announcements
 * - notifications: notifications
 * - reports: reports and audit logs
 * - admin: user directory and avatars
 */
export * from './api/client';
export * from './api/auth';
export * from './api/system';
export * from './api/subjects';
export * from './api/materials';
export * from './api/quizzes';
export * from './api/ai';
export * from './api/aiGeneration';
export * from './api/announcements';
export * from './api/notifications';
export * from './api/reports';
export * from './api/admin';
