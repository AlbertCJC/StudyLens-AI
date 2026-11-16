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
// SYSTEM
// ----------------------------------------------------------------
const FALLBACK_SYSTEM_INFO: SystemInfo = {
  platformName: 'StudyLens AI: Adaptive Learning & Automated Assessment Generation Platform',
  institution: 'University of Cebu - Main Campus, College of Computer Studies (UC CCS)',
  degree: 'Bachelor of Science in Information Technology (BSIT)',
  version: '2.0.0 (Groq GPT-OSS-120B Edition)',
  techStack: { webFrontend: 'Vite + Tailwind', mobileApp: 'React Native (Expo)', backend: 'Python Flask', database: 'MySQL' },
  sdgs: ['SDG 4: Quality Education', 'SDG 9: Industry, Innovation, and Infrastructure'],
  capstoneTeam: { adviser: 'Christian C. Barral, MIT' },
};

const FALLBACK_SETTINGS: SystemSettings = {
  require2FA: false,
  maintenanceMode: false,
  sessionTimeoutMins: 60,
  autoAuditArchiving: true,
};

export const fetchSystemInfo = (): Promise<SystemInfo> => getJSON('/system/info', FALLBACK_SYSTEM_INFO);
export const fetchSystemSettings = (): Promise<SystemSettings> => getJSON('/system/settings', FALLBACK_SETTINGS);
export const saveSystemSettings = (settings: Partial<SystemSettings>): Promise<SystemSettings> =>
  postJSON('/system/settings', settings, FALLBACK_SETTINGS);

// ----------------------------------------------------------------
// LOCAL SESSION AUTH TOKEN FROM AUTHORIZATION
// ----------------------------------------------------------------
export const isOnline = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/system/info`, { headers: buildHeaders() });
    return res.ok;
  } catch {
    return false;
  }
};

export const fetchSystemBackup = (): Promise<any> => getJSON('/system/backup', {});
