import { uint8ToBase64 } from '../../utils/base64';
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
// QUIZZES
// ----------------------------------------------------------------
export const FALLBACK_QUIZZES: Quiz[] = [
  {
    id: 'm-q1',
    title: 'Mobile Quick Quiz: Data Structures & Groq AI',
    description: 'Auto-generated practice quiz for graph algorithms.',
    subjectId: 'sub-101',
    subjectName: 'CS 301 - Data Structures & Algorithms',
    createdById: 'usr-teacher-1',
    createdByName: 'Christian C. Barral, MIT',
    quizType: 'teacher',
    isPublished: true,
    timeLimitMinutes: 15,
    passPercentage: 70,
    difficulty: 'medium',
    createdAt: '2024-02-10T08:00:00.000Z',
    questions: [
      {
        id: 'mq1',
        question: 'Which queue property does BFS use when traversing a graph?',
        type: 'multiple_choice',
        options: ['FIFO', 'LIFO', 'Random', 'None'],
        correctAnswer: 0,
        explanation: 'Breadth-First Search uses a Queue that follows the First-In-First-Out (FIFO) principle.',
        bloomsLevel: 'Remembering',
        difficulty: 'easy',
        topicTag: 'Graphs',
      },
      {
        id: 'mq2',
        question: 'Which AI inference engine powers the StudyLens AI generator?',
        type: 'multiple_choice',
        options: ['Groq Inference', 'Gemini 1.0', 'Legacy Bot', 'Basic Rule Engine'],
        correctAnswer: 0,
        explanation: 'StudyLens AI uses fast Groq Inference with the GPT-OSS-120B model.',
        bloomsLevel: 'Understanding',
        difficulty: 'medium',
        topicTag: 'AI Fundamentals',
      },
      {
        id: 'mq3',
        question: 'A Tree is a special type of connected acyclic graph.',
        type: 'true_false',
        options: ['True', 'False'],
        correctAnswer: 0,
        explanation: 'A tree is an undirected, connected graph with no cycles.',
        bloomsLevel: 'Applying',
        difficulty: 'medium',
        topicTag: 'Graphs',
      },
    ],
  },
];

/**
 * Reorders the options of every multiple-choice question and re-points the
 * correct answer to wherever the correct option moved. Removes the "all correct
 * answers in position A" bias for both server responses and local demo data.
 */
export function shuffleQuizAnswers(quiz: Quiz): Quiz {
  const questions = (quiz.questions || []).map((q) => {
    if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length >= 2) {
      const raw = q.correctAnswer;
      const idx =
        typeof raw === 'string' && /^[A-Da-d]$/.test(raw.trim())
          ? 'ABCD'.indexOf(raw.trim().toUpperCase())
          : Number(raw);
      const valid = Number.isInteger(idx) && idx >= 0 && idx < q.options.length;
      const correctText = q.options[valid ? idx : 0];
      const shuffled = [...q.options];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...q, options: shuffled, correctAnswer: shuffled.indexOf(correctText) };
    }
    return q;
  });
  return { ...quiz, questions };
}

export const fetchQuizzes = (userRole?: string, userId?: string): Promise<Quiz[]> => {
  const params: string[] = [];
  if (userRole) params.push(`userRole=${encodeURIComponent(userRole)}`);
  if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
  // Offline fallback: non-admin accounts get no demo quizzes (real data comes
  // from the API; fresh accounts must not see seeded sample assessments).
  const offlineFallback = !userRole || userRole === 'admin' ? FALLBACK_QUIZZES : [];
  return getJSON(`/quizzes${params.length ? `?${params.join('&')}` : ''}`, offlineFallback).then((list) => list.map((q) => shuffleQuizAnswers(q)));
};

export const downloadQuizPdf = async (quizId: string): Promise<Uint8Array> => {
  const res = await fetch(`${getApiBaseUrl()}/quizzes/${encodeURIComponent(quizId)}/download-pdf`, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (handleUnauthorized(res)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let msg = 'Could not download the quiz.';
    try {
      const body = JSON.parse(raw);
      if (body && typeof body.error === 'string') msg = body.error;
    } catch {
      // Non-JSON error page (e.g. a 404 HTML page when the route is missing)
    }
    throw new Error(msg);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
};

export const downloadMaterialPdf = async (materialId: string): Promise<Uint8Array> => {
  const res = await fetch(`${getApiBaseUrl()}/materials/${encodeURIComponent(materialId)}/convert-to-pdf`, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (handleUnauthorized(res)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    let msg = 'Could not convert the document to PDF.';
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

// Fetch the original uploaded file as base64 so it can be handed to an
// in-app WebView renderer (PowerPoint/Word). Auth is enforced by the backend.
export const fetchMaterialFileBase64 = async (materialId: string): Promise<string> => {
  const res = await fetch(`${getApiBaseUrl()}/materials/${encodeURIComponent(materialId)}/download`, {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (handleUnauthorized(res)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) throw new Error('Could not load this file.');
  const buffer = await res.arrayBuffer();
  return uint8ToBase64(new Uint8Array(buffer));
};


export const updateQuiz = (quizId: string, patch: Record<string, unknown>): Promise<Quiz> =>
  mutateJSON(`/quizzes/${encodeURIComponent(quizId)}`, 'PUT', patch);

export interface CreateQuizInput {
  title: string;
  description?: string;
  subjectId: string;
  subjectName?: string;
  quizType: 'teacher' | 'student';
  questions: QuizQuestion[];
  isPublished?: boolean;
  timeLimitMinutes?: number;
  passPercentage?: number;
  difficulty?: DifficultyLevel;
  attemptsAllowed?: number;
  revealAnswers?: boolean;
  topicTag?: string;
  deadline?: string | null;
  userRole?: UserRole;
  createdById?: string;
  createdByName?: string;
}

export const createQuiz = async (input: CreateQuizInput): Promise<Quiz> => {
  const created = (await postJSON('/quizzes', input, () => offlineError('/quizzes'))) as unknown as Quiz;
  invalidateApiCache();
  return created;
};


export const deleteQuiz = (quizId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/quizzes/${encodeURIComponent(quizId)}`, 'DELETE');
