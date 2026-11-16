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
// NOTIFICATIONS (DB-backed, shown in the header bell alongside announcements)
// ----------------------------------------------------------------
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  target?: string | null;
}

const mapNotification = (n: any): Notification => ({
  id: n?.id || '',
  userId: n?.userId || '',
  title: n?.title || '',
  message: n?.message || n?.content || '',
  isRead: !!n?.isRead,
  createdAt: n?.createdAt || '',
  target: n?.target || null,
});

export const fetchNotifications = (): Promise<Notification[]> =>
  getJSON('/notifications', []).then((list) => (Array.isArray(list) ? list.map(mapNotification) : []));

export const markNotificationRead = (id: string): Promise<Notification> =>
  mutateJSON(`/notifications/${encodeURIComponent(id)}/read`, 'PUT');

export const markAllNotificationsRead = (): Promise<{ success: boolean }> =>
  mutateJSON('/notifications/read-all', 'PUT');

