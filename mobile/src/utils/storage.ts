import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  theme: 'studylens_mobile_theme',
  session: 'studylens_mobile_session',
  pendingEmailVerification: 'studylens_mobile_pending_email_verification',
  forgotReset: 'studylens_mobile_forgot_reset',
  apiBaseUrl: 'studylens_api_base',
  downloadedMaterials: 'studylens_downloaded_materials',
  readNotifications: (userId: string) => `studylens_read_notifications_${userId}`,
  readAnnouncements: (userId: string) => `studylens_read_announcements_${userId}`,
  adminUsers: 'studylens_admin_users',
  localAnnouncements: 'studylens_local_announcements',
  profileEdits: (userId: string) => `studylens_profile_edit_${userId}`,
  deckRatings: (userId: string) => `studylens_deck_ratings_${userId}`,
  quizProgressPrefix: (userId: string) => `studylens_quiz_progress_${userId}_`,
  quizProgress: (userId: string, quizId: string) => `studylens_quiz_progress_${userId}_${quizId}`,
  attempts: (userId: string) => `studylens_quiz_attempts_${userId}`,
};

export const getItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

export const setItem = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore persistence failures
  }
};

export const removeItem = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const getJSON = async <T>(key: string): Promise<T | null> => {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const setJSON = async (key: string, value: unknown): Promise<void> => {
  await setItem(key, JSON.stringify(value));
};

// ----------------------------------------------------------------
// STRING SETS (e.g. downloaded material ids, read notification ids)
// ----------------------------------------------------------------
export const getStringSet = async (key: string): Promise<Set<string>> => {
  const list = await getJSON<string[]>(key);
  return new Set(list || []);
};

export const addToStringSet = async (key: string, id: string): Promise<void> => {
  const set = await getStringSet(key);
  set.add(id);
  await setJSON(key, Array.from(set));
};

export const removeFromStringSet = async (key: string, id: string): Promise<void> => {
  const set = await getStringSet(key);
  set.delete(id);
  await setJSON(key, Array.from(set));
};

// ----------------------------------------------------------------
// QUIZ PROGRESS (mirrors web localStorage prefix behaviour)
// ----------------------------------------------------------------
export interface SavedQuizProgress {
  quizId: string;
  quizTitle: string;
  subjectName: string;
  currentQIndex: number;
  userAnswers: Record<string, unknown>;
  timeLeft: number;
  totalQuestions: number;
  lastUpdated: string;
  savedQuiz: unknown;
}

export const getQuizProgresses = async (userId: string): Promise<SavedQuizProgress[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = STORAGE_KEYS.quizProgressPrefix(userId);
    const progressKeys = keys.filter((k) => k.startsWith(prefix));
    const results = await AsyncStorage.multiGet(progressKeys);
    const progresses: SavedQuizProgress[] = [];
    results.forEach(([key, value]) => {
      if (value) {
        try {
          progresses.push({ ...JSON.parse(value), _key: key });
        } catch {
          // skip corrupt
        }
      }
    });
    return progresses;
  } catch {
    return [];
  }
};

export const saveQuizProgress = async (userId: string, progress: SavedQuizProgress): Promise<void> => {
  const { _key, ...rest } = progress as any;
  await setJSON(STORAGE_KEYS.quizProgress(userId, progress.quizId), rest);
};

export const removeQuizProgress = async (userId: string, quizId: string): Promise<void> => {
  await removeItem(STORAGE_KEYS.quizProgress(userId, quizId));
};

// ----------------------------------------------------------------
// QUIZ ATTEMPTS (local progress tracking)
// ----------------------------------------------------------------
export interface LocalAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  subjectName: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  weakTopics: string[];
  strongTopics: string[];
  completedAt: string;
}

export const getAttempts = async (userId: string): Promise<LocalAttempt[]> => {
  return (await getJSON<LocalAttempt[]>(STORAGE_KEYS.attempts(userId))) || [];
};

export const addAttempt = async (userId: string, attempt: LocalAttempt): Promise<void> => {
  const attempts = await getAttempts(userId);
  attempts.unshift(attempt);
  await setJSON(STORAGE_KEYS.attempts(userId), attempts);
};

export const clearAttempts = async (userId: string): Promise<void> => {
  await removeItem(STORAGE_KEYS.attempts(userId));
};