import { STORAGE_KEYS, getJSON as storageGetJSON, setJSON } from '../../utils/storage';
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

export interface AdminUserInput {
  name: string;
  email: string;
  role: UserRole | 'admin';
  avatar?: string | null;
  department?: string;
  status?: string;
}

export const fetchAdminUsers = async (): Promise<User[]> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/users`, { headers: buildHeaders() });
    if (handleUnauthorized(res)) return [];
    if (res.ok) {
      const data = (await res.json()) as User[];
      setJSON(STORAGE_KEYS.adminUsers, data);
      return data;
    }
  } catch {
    // fall back to cached directory below
  }
  return (await storageGetJSON<User[]>(STORAGE_KEYS.adminUsers)) || [];
};

export const createUser = (input: AdminUserInput): Promise<User> => mutateJSON('/users', 'POST', input);

export const updateUser = (userId: string, patch: Partial<AdminUserInput>): Promise<User> =>
  mutateJSON(`/users/${encodeURIComponent(userId)}`, 'PUT', patch);

export const deleteUser = (userId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/users/${encodeURIComponent(userId)}`, 'DELETE');

export async function uploadAvatar(userId: string, uri: string, name: string, mimeType: string): Promise<User> {
  const form = new FormData();
  form.append('file', { uri, name, type: mimeType } as any);
  const res = await fetch(`${getApiBaseUrl()}/users/${encodeURIComponent(userId)}/avatar`, {
    method: 'POST',
    headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
    body: form,
  });
  if (handleUnauthorized(res)) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error || 'Could not upload the profile photo.');
  }
  return (await res.json()) as User;
}
