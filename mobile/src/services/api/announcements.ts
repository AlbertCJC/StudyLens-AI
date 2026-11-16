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
// ANNOUNCEMENTS (read-only)
// ----------------------------------------------------------------
export const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Welcome to StudyLens AI Platform!',
    content: 'Utilize AI-generated flashcards, reviewers, and adaptive Bloom\'s Taxonomy quizzes powered by Groq GPT-OSS-120B.',
    authorName: 'Neil A. Basabe, DIT (Dean)',
    targetAudience: 'all',
    priority: 'high',
    createdAt: '2024-02-01T08:00:00.000Z',
  },
  {
    id: 'ann-2',
    title: 'New Materials Uploaded for CS 301 & DB 204',
    content: 'Christian C. Barral, MIT uploaded lecture notes on Graph Algorithms and MySQL Normalization.',
    authorName: 'Christian C. Barral, MIT',
    targetAudience: 'students',
    priority: 'medium',
    createdAt: '2024-02-06T09:30:00.000Z',
  },
];

const mapAnnouncement = (a: any): Announcement => ({
  ...a,
  authorId: a?.authorId || a?.teacherId || undefined,
});

export const fetchAnnouncements = (userId?: string, userRole?: string): Promise<Announcement[]> => {
  // Offline fallback: non-admin accounts get no demo announcements (real
  // visibility is enforced by the API; fresh accounts must see an empty board).
  const offlineFallback = !userRole || userRole === 'admin' ? FALLBACK_ANNOUNCEMENTS : [];
  return getJSON(`/announcements?userId=${encodeURIComponent(userId || '')}&userRole=${encodeURIComponent(userRole || '')}`, offlineFallback)
    .then((list) => (Array.isArray(list) ? list.map(mapAnnouncement) : []));
};

export const createAnnouncement = (ann: Omit<Announcement, 'id' | 'createdAt'> & { createdAt?: string }): Promise<Announcement> =>
  mutateJSON('/announcements', 'POST', { ...ann, authorName: ann.authorName || 'Administrator' });

export const deleteAnnouncement = (announcementId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/announcements/${encodeURIComponent(announcementId)}`, 'DELETE');

export const updateAnnouncement = (announcementId: string, patch: Partial<Omit<Announcement, 'id' | 'createdAt'>>): Promise<Announcement> =>
  mutateJSON(`/announcements/${encodeURIComponent(announcementId)}`, 'PUT', patch);
