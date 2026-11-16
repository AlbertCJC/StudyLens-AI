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
// AI DRAFT GENERATION (preview first, Save/Discard later)
// ----------------------------------------------------------------
export type AiGenerationMode = 'quiz' | 'flashcards' | 'summary' | 'reviewer';

export const aiGenerateDraft = async (
  mode: AiGenerationMode,
  input: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Record<string, unknown>> => {
  const url = `${getApiBaseUrl()}/ai/generate`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ ...input, mode, save: false }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new Error(
      `Couldn't reach the StudyLens server at ${url}. Make sure the backend is running (0.0.0.0:5000) and your phone is on the same network as the computer. You can also set a Server URL on the login screen.`
    );
  }
  if (handleUnauthorized(res)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    // Surface the server's structured error (message + code) so the UI can show a
    // precise message such as the 100-question maximum or the AI limit reset time,
    // instead of a generic failure.
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
      remaining?: number;
      resetAtSeconds?: number;
    } | null;
    const error = new Error(body?.error || `Generation failed (${res.status}).`) as Error & {
      code?: string;
      resetAtSeconds?: number;
    };
    if (body?.code) error.code = body.code;
    if (typeof body?.resetAtSeconds === 'number') error.resetAtSeconds = body.resetAtSeconds;
    throw error;
  }
  invalidateApiCache();
  const data = await res.json().catch(() => null);
  if (data === null || data === undefined) throw new Error('The server returned an empty response.');
  return data as Record<string, unknown>;
};

export const aiSaveDraft = (mode: AiGenerationMode, draft: Record<string, unknown>): Promise<Record<string, unknown>> =>
  postJSON('/ai/save', { ...draft, mode }, () => offlineError('/ai/save'));

export interface AiPdfInput {
  mode: 'summary' | 'reviewer' | 'quiz' | 'flashcards';
  title: string;
  subjectName?: string;
  data: Record<string, unknown>;
}

export const exportAiPdf = async (input: AiPdfInput): Promise<Uint8Array> => {
  const res = await fetch(`${getApiBaseUrl()}/ai/export/pdf`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  if (handleUnauthorized(res)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    let msg = 'PDF export failed.';
    try {
      const body = await res.json();
      if (typeof body.error === 'string') msg = body.error;
    } catch {
      // keep default message
    }
    throw new Error(msg);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
};

export interface ConvertToPdfInput {
  title: string;
  metaLine?: string;
  content?: string;
  items?: Array<{ question?: string; answer?: string; topic?: string; overview?: string }>;
}

export const convertToPdf = async (input: ConvertToPdfInput): Promise<Uint8Array> => {
  const res = await fetch(`${getApiBaseUrl()}/convert-to-pdf`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  if (handleUnauthorized(res)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    let msg = 'PDF export failed.';
    try {
      const body = await res.json();
      if (typeof body.error === 'string') msg = body.error;
    } catch {
      // keep default message
    }
    throw new Error(msg);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
};

// ----------------------------------------------------------------
// REVIEWERS (read-only)
// ----------------------------------------------------------------
const FALLBACK_REVIEWERS: Reviewer[] = [
  {
    id: 'rev-1',
    title: 'Data Structures & Algorithms Reviewer',
    subjectId: 'sub-101',
    subjectName: 'CS 301 - Data Structures & Algorithms',
    createdById: 'usr-teacher-1',
    createdAt: '2024-02-11T08:00:00.000Z',
    overview: 'Comprehensive study reviewer covering graph traversal, BST properties, and complexity analysis.',
    topics: [
      {
        topic: 'Graph Traversal',
        overview: 'BFS and DFS algorithms and their applications.',
        keyConcepts: ['BFS uses FIFO Queue', 'DFS uses Stack/Recursion', 'Both are O(V + E)'],
      },
      {
        topic: 'Binary Search Trees',
        overview: 'Ordered key storage enabling fast search operations.',
        keyConcepts: ['Left child < Node < Right child', 'In-order yields sorted output'],
      },
    ],
  },
];

export const fetchReviewers = (): Promise<Reviewer[]> => getJSON('/reviewers', FALLBACK_REVIEWERS);


export const updateFlashcardDeck = (deckId: string, patch: Record<string, unknown>): Promise<FlashcardDeck> =>
  mutateJSON(`/flashcards/${encodeURIComponent(deckId)}`, 'PUT', patch);

export const deleteFlashcardDeck = (deckId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/flashcards/${encodeURIComponent(deckId)}`, 'DELETE');

export const updateSummary = (summaryId: string, patch: Record<string, unknown>): Promise<StudySummary> =>
  mutateJSON(`/summaries/${encodeURIComponent(summaryId)}`, 'PUT', patch);

export const updateReviewer = (reviewerId: string, patch: Record<string, unknown>): Promise<Reviewer> =>
  mutateJSON(`/reviewers/${encodeURIComponent(reviewerId)}`, 'PUT', patch);
