import {
  getApiBaseUrl,
  getAuthToken,
  setAuthToken,
  buildHeaders,
  handleUnauthorized,
  invalidateApiCache,
  getJSON,
  postJSON,
  postForm,
  mutateJSON,
  offlineError,
} from './client';
import type {
  UserRole,
  AssessmentType,
  DifficultyLevel,
  User,
  Subject,
  Material,
  QuizQuestion,
  Quiz,
  Flashcard,
  FlashcardDeck,
  StudySummary,
  ReviewerTopic,
  Reviewer,
  Announcement,
  ActivityLog,
  SystemInfo,
  SystemSettings,
} from './client';

// ----------------------------------------------------------------
// REPORTS & ANALYTICS
// ----------------------------------------------------------------
export type ReportType = 'Student Performance' | 'Quiz Analytics' | 'Subject Summary' | 'AI Usage';

export interface GeneratedReport {
  id: string;
  generatedBy: string;
  reportType: ReportType;
  generatedAt: string;
  title: string;
  targetId?: string | null;
  summary?: Record<string, unknown> | null;
}

export const FALLBACK_REPORTS: GeneratedReport[] = [];

export const fetchReports = (): Promise<GeneratedReport[]> => getJSON('/reports', FALLBACK_REPORTS);

export const generateReport = (input: {
  reportType: ReportType;
  title: string;
  targetId?: string;
  generatedBy?: string;
}): Promise<GeneratedReport> => postJSON('/reports', input, { success: false } as unknown as GeneratedReport);

export const deleteReport = (reportId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/reports/${encodeURIComponent(reportId)}`, 'DELETE');

// ----------------------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------------------
export const FALLBACK_LOGS: ActivityLog[] = [];

export const fetchLogs = async (): Promise<ActivityLog[]> => {
  const data = await getJSON<unknown>('/logs', FALLBACK_LOGS);
  if (Array.isArray(data)) return data as ActivityLog[];
  if (data && typeof data === 'object' && Array.isArray((data as { logs?: unknown }).logs)) {
    return (data as { logs: ActivityLog[] }).logs;
  }
  return FALLBACK_LOGS;
};

export interface LogInput {
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details?: string;
}

export const postLog = (input: LogInput): Promise<{ success: boolean }> =>
  postJSON('/logs', input, { success: true });

export const clearLogs = (): Promise<{ success: boolean }> => mutateJSON('/logs', 'DELETE');
