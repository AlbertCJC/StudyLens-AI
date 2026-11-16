import { shuffleQuizAnswers } from './quizzes';
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

export interface AiQuizInput {
  textContent: string;
  numQuestions: number;
  difficulty: DifficultyLevel;
  title?: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
  createdByName: string;
}

const buildQuizFallback = (input: AiQuizInput): Quiz => ({
  id: `quiz-local-${Date.now()}`,
  title: input.title || `AI Quiz: ${input.textContent.slice(0, 30)}...`,
  description: '',
  subjectId: input.subjectId,
  subjectName: input.subjectName || 'General Topic',
  materialId: input.materialId,
  createdById: input.createdById,
  createdByName: input.createdByName,
  quizType: 'teacher',
  questions: Array.from({ length: input.numQuestions }, (_, i) => ({
    id: `q-${i + 1}`,
    question: `Key Concept Evaluation Q${i + 1}: What is the primary theoretical principle of ${input.textContent.slice(0, 35)}...?`,
    type: 'multiple_choice' as AssessmentType,
    options: [
      'It establishes core theoretical principles and foundational rules.',
      'It reduces computational complexity to logarithmic scale.',
      'It serves as a fallback mechanism for exception handling.',
      'It optimizes memory allocation across distributed nodes.',
    ],
    correctAnswer: 0,
    explanation: 'Core theoretical principles form the foundation of this study material.',
    bloomsLevel: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'][i % 6],
    difficulty: input.difficulty,
    topicTag: 'Core Fundamentals',
  })),
  isPublished: true,
  timeLimitMinutes: 15,
  passPercentage: 70,
  difficulty: input.difficulty,
  createdAt: new Date().toISOString(),
});

export const generateQuiz = (input: AiQuizInput): Promise<Quiz> =>
  postJSON('/quizzes/generate', input, () => offlineError('/quizzes/generate')).then(shuffleQuizAnswers);

// ----------------------------------------------------------------
// FLASHCARDS
// ----------------------------------------------------------------
export const FALLBACK_DECKS: FlashcardDeck[] = [
  {
    id: 'm-fc1',
    title: 'Mobile Learning Deck: BFS & Graph Traversal',
    subjectId: 'sub-101',
    subjectName: 'CS 301 - Data Structures & Algorithms',
    createdById: 'usr-teacher-1',
    isPublished: true,
    createdAt: '2024-02-08T08:00:00.000Z',
    cards: [
      { id: 'c1', question: 'What is Breadth-First Search?', answer: 'Traverses graph level-by-level using a FIFO Queue.', topicTag: 'Graphs', difficulty: 'easy' },
      { id: 'c2', question: 'What is Depth-First Search?', answer: 'Traverses deep down branches using a Stack/Recursion.', topicTag: 'Graphs', difficulty: 'easy' },
      { id: 'c3', question: 'What is MySQL Normalization?', answer: 'Structuring tables into 1NF, 2NF, 3NF to eliminate redundancy.', topicTag: 'MySQL', difficulty: 'medium' },
      { id: 'c4', question: 'What is the time complexity of BFS?', answer: 'O(V + E) - every vertex and edge is visited once.', topicTag: 'Complexity', difficulty: 'medium' },
    ],
  },
];

export const fetchFlashcards = (userId?: string): Promise<FlashcardDeck[]> => {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return getJSON(`/flashcards${qs}`, FALLBACK_DECKS);
};

export interface AiDeckInput {
  textContent: string;
  cardCount: number;
  title?: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
}

const buildDeckFallback = (input: AiDeckInput): FlashcardDeck => ({
  id: `deck-local-${Date.now()}`,
  title: input.title || `Flashcards: ${input.textContent.slice(0, 25)}...`,
  subjectId: input.subjectId,
  subjectName: input.subjectName || 'General Topic',
  materialId: input.materialId,
  createdById: input.createdById,
  isPublished: true,
  createdAt: new Date().toISOString(),
  cards: Array.from({ length: input.cardCount }, (_, i) => ({
    id: `fc-${i + 1}`,
    question: `What is the key principle of Section ${i + 1} in the material?`,
    answer: `Section ${i + 1} highlights active recall, key definitions, and systematic application.`,
    topicTag: 'Key Terminology',
    difficulty: 'medium' as DifficultyLevel,
  })),
});

export const generateFlashcards = (input: AiDeckInput): Promise<FlashcardDeck> =>
  postJSON('/flashcards/generate', input, () => offlineError('/flashcards/generate'));

// ----------------------------------------------------------------
// SUMMARIES
// ----------------------------------------------------------------
export const FALLBACK_SUMMARIES: StudySummary[] = [
  {
    id: 'm-s1',
    title: 'Mobile Summary: BFS & Graph Traversal',
    subjectId: 'sub-101',
    subjectName: 'CS 301 - Data Structures & Algorithms',
    createdById: 'usr-teacher-1',
    createdAt: '2024-02-09T08:00:00.000Z',
    executiveSummary:
      'This lecture outlines the fundamental differences between Breadth-First Search (BFS) and Depth-First Search (DFS), detailing their underlying data structures, time complexities O(V + E), and practical applications like shortest path calculation and topological sorting.',
    keyTakeaways: [
      'BFS uses a Queue (FIFO) and is ideal for shortest path in unweighted graphs.',
      'DFS uses a Stack / Recursion (LIFO) and is ideal for maze solving, cycle detection, and topological sorting.',
      'Binary Search Trees maintain ordered keys where in-order traversal yields sorted elements.',
    ],
    bulletPoints: [
      'BFS Time Complexity: O(V + E) using queue data structure.',
      'DFS Time Complexity: O(V + E) using call stack / explicit stack.',
      'BST property: Left child < Node < Right child.',
      'In-order traversal of a BST yields elements in sorted order.',
    ],
  },
];

export const fetchSummaries = (): Promise<StudySummary[]> => getJSON('/summaries', FALLBACK_SUMMARIES);

export interface AiSummaryInput {
  textContent: string;
  title?: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
}

const buildSummaryFallback = (input: AiSummaryInput): StudySummary => ({
  id: `sum-local-${Date.now()}`,
  title: input.title || `Summary: ${input.textContent.slice(0, 30)}...`,
  subjectId: input.subjectId,
  subjectName: input.subjectName || 'CS 301',
  materialId: input.materialId,
  createdById: input.createdById,
  createdAt: new Date().toISOString(),
  executiveSummary: `This lecture covers key learning objectives: ${input.textContent.slice(0, 200)}...`,
  keyTakeaways: [
    'Comprehensive breakdown of core concepts and definitions.',
    'Structured methodologies for problem-solving and analysis.',
    'Practical applications and exam preparation highlights.',
  ],
  bulletPoints: [
    'Primary concept: Foundational theory and frameworks.',
    'Secondary concept: Implementation strategies and examples.',
    'Review recommendation: Focus on weak topics identified in quizzes.',
  ],
});

export const generateSummary = (input: AiSummaryInput): Promise<StudySummary> =>
  postJSON('/summaries/generate', input, () => offlineError('/summaries/generate'));

