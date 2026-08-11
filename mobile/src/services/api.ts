import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const API_BASE_URL = `http://${DEV_HOST}:5000/api`;

export type UserRole = 'student' | 'teacher';
export type AssessmentType = 'multiple_choice' | 'true_false' | 'identification' | 'short_answer';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  roleId?: number;
  department?: string;
  studentId?: string;
  status?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  teacherId: string;
  teacherName: string;
  semester?: string;
  course?: string;
  schoolYear?: string;
  studentCount: number;
  materialCount: number;
  createdAt: string;
}

export interface Material {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName?: string;
  fileType: string;
  fileUrl?: string;
  fileSize?: string;
  extractedText?: string;
  uploadedBy: string;
  uploaderRole: string;
  uploaderId?: string;
  materialType?: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: AssessmentType;
  options?: string[];
  correctAnswer: number | string;
  explanation?: string;
  bloomsLevel?: string;
  difficulty: DifficultyLevel;
  topicTag?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
  createdByName: string;
  quizType?: string;
  questions: QuizQuestion[];
  isPublished: boolean;
  timeLimitMinutes?: number;
  passPercentage: number;
  difficulty: DifficultyLevel;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topicTag?: string;
  difficulty: DifficultyLevel;
}

export interface FlashcardDeck {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  cards: Flashcard[];
  isPublished: boolean;
  createdById: string;
  createdAt: string;
}

export interface StudySummary {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  executiveSummary: string;
  keyTakeaways: string[];
  bulletPoints: string[];
  createdById: string;
  createdAt: string;
}

export interface ReviewerTopic {
  topic: string;
  overview: string;
  keyConcepts: string[];
}

export interface Reviewer {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  overview: string;
  topics: ReviewerTopic[];
  createdById: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  targetAudience: string;
  priority: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface SystemInfo {
  platformName: string;
  institution: string;
  degree: string;
  version: string;
  techStack: Record<string, string>;
  sdgs: string[];
  capstoneTeam: Record<string, string>;
}

export interface SystemSettings {
  aiModel: string;
  maxTokens: number;
  temperature: number;
  require2FA: boolean;
  maintenanceMode: boolean;
  sessionTimeoutMins: number;
  autoAuditArchiving: boolean;
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

export type Fallback<T> = T | (() => T);

function resolveFallback<T>(fallback: Fallback<T>): T {
  return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
}

async function getJSON<T>(path: string, fallback: Fallback<T>): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: buildHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) return resolveFallback(fallback);
      return data;
    }
  } catch (err) {
    console.warn(`[Mobile] API offline at ${API_BASE_URL}${path}, using local demo data`);
  }
  return resolveFallback(fallback);
}

async function postJSON<T>(path: string, body: unknown, fallback: Fallback<T>): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      if (data === null || data === undefined) return resolveFallback(fallback);
      return data;
    }
  } catch (err) {
    console.warn(`[Mobile] API offline at ${API_BASE_URL}${path}, using local demo data`);
  }
  return resolveFallback(fallback);
}

async function postForm<T>(path: string, form: FormData, fallback: Fallback<T>): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      if (data === null || data === undefined) return resolveFallback(fallback);
      return data;
    }
  } catch (err) {
    console.warn(`[Mobile] Upload API offline at ${API_BASE_URL}${path}, using local demo data`);
  }
  return resolveFallback(fallback);
}

// ----------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------
export async function apiLogin(email: string, role?: string, user?: Partial<User>): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, user }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Login failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function apiRegister(
  name: string,
  email: string,
  role: UserRole,
  department?: string
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, role, department }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Registration failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

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
  aiModel: 'gpt-oss-120b (Groq Inference)',
  maxTokens: 4096,
  temperature: 0.7,
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
// SUBJECTS
// ----------------------------------------------------------------
export const FALLBACK_SUBJECTS: Subject[] = [
  {
    id: 'sub-101',
    code: 'CS 301',
    name: 'Data Structures & Algorithms',
    description: 'Fundamental data structures, search trees, graphs, sorting algorithms.',
    teacherId: 'usr-teacher-1',
    teacherName: 'Christian C. Barral, MIT',
    semester: '1st Semester',
    course: 'BSIT',
    schoolYear: '2026-2027',
    studentCount: 51,
    materialCount: 2,
    createdAt: '2024-01-10T08:00:00.000Z',
  },
  {
    id: 'sub-102',
    code: 'AI 402',
    name: 'Artificial Intelligence & Neural Networks',
    description: 'Machine learning, Groq GPT-OSS-120B inference, and deep learning.',
    teacherId: 'usr-teacher-1',
    teacherName: 'Christian C. Barral, MIT',
    semester: '1st Semester',
    course: 'BSIT',
    schoolYear: '2026-2027',
    studentCount: 45,
    materialCount: 1,
    createdAt: '2024-01-12T08:00:00.000Z',
  },
  {
    id: 'sub-103',
    code: 'DB 204',
    name: 'Database Systems & Architecture',
    description: 'Relational database design, MySQL querying, 1NF to 3NF normalization.',
    teacherId: 'usr-teacher-1',
    teacherName: 'Christian C. Barral, MIT',
    semester: '1st Semester',
    course: 'BSIT',
    schoolYear: '2026-2027',
    studentCount: 55,
    materialCount: 1,
    createdAt: '2024-01-14T08:00:00.000Z',
  },
];

export const fetchSubjects = (): Promise<Subject[]> => getJSON('/subjects', FALLBACK_SUBJECTS);

// ----------------------------------------------------------------
// MATERIALS
// ----------------------------------------------------------------
export const FALLBACK_MATERIALS: Material[] = [
  {
    id: 'mat-1720',
    title: 'Module 4: Relational Algebra & Normalization',
    description: 'MySQL normalization techniques from 1NF to 3NF with ERD examples.',
    subjectId: 'sub-103',
    subjectName: 'DB 204 - Database Systems & Architecture',
    fileType: 'pdf',
    fileUrl: '/uploads/module4.pdf',
    fileSize: '420 KB',
    extractedText:
      'Uploaded PDF document: Module 4: Relational Algebra & Normalization. Focus on graph algorithms and MySQL normalization. Normalization removes redundancy through 1NF, 2NF, 3NF decomposition.',
    uploadedBy: 'Christian C. Barral, MIT',
    uploaderRole: 'teacher',
    uploaderId: 'usr-teacher-1',
    materialType: 'course',
    createdAt: '2024-02-06T09:30:00.000Z',
  },
  {
    id: 'mat-1719',
    title: 'Graph Traversal Lecture: BFS & DFS',
    description: 'Lecture notes on Breadth-First and Depth-First search algorithms.',
    subjectId: 'sub-101',
    subjectName: 'CS 301 - Data Structures & Algorithms',
    fileType: 'pdf',
    fileUrl: '/uploads/graphs.pdf',
    fileSize: '1.2 MB',
    extractedText:
      'Uploaded PDF document: Graph Traversal Lecture. BFS traverses level-by-level using a FIFO Queue with O(V + E). DFS traverses deep using a Stack/Recursion with O(V + E).',
    uploadedBy: 'Christian C. Barral, MIT',
    uploaderRole: 'teacher',
    uploaderId: 'usr-teacher-1',
    materialType: 'course',
    createdAt: '2024-01-28T14:00:00.000Z',
  },
];

export const fetchMaterials = (): Promise<Material[]> => getJSON('/materials', FALLBACK_MATERIALS);

export interface UploadMaterialPayload {
  uri: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  subjectId: string;
  uploadedBy: string;
  uploaderRole: string;
  uploaderId: string;
}

export async function uploadMaterial(payload: UploadMaterialPayload): Promise<Material> {
  const fallbackMaterial: Material = {
    id: `mat-local-${Date.now()}`,
    title: payload.title || payload.name,
    description: payload.description || 'Uploaded lecture material',
    subjectId: payload.subjectId,
    subjectName: 'Uploaded Material',
    fileType: payload.name.split('.').pop() || 'pdf',
    fileSize: 'Local File',
    extractedText: `Uploaded ${payload.type} document: ${payload.title || payload.name}.`,
    uploadedBy: payload.uploadedBy,
    uploaderRole: payload.uploaderRole,
    uploaderId: payload.uploaderId,
    materialType: 'course',
    createdAt: new Date().toISOString(),
  };

  try {
    const form = new FormData();
    form.append('file', { uri: payload.uri, name: payload.name, type: payload.type } as any);
    form.append('title', payload.title || payload.name);
    form.append('description', payload.description || 'Uploaded lecture material');
    form.append('subjectId', payload.subjectId);
    form.append('uploadedBy', payload.uploadedBy);
    form.append('uploaderRole', payload.uploaderRole);
    form.append('uploaderId', payload.uploaderId);
    const res = await fetch(`${API_BASE_URL}/materials/upload`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
    return fallbackMaterial;
  } catch (err) {
    console.warn('[Mobile] Material upload failed, using local material record');
    return fallbackMaterial;
  }
}

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

export const fetchQuizzes = (): Promise<Quiz[]> => getJSON('/quizzes', FALLBACK_QUIZZES);

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
  description: 'Automated Bloom\'s Taxonomy Quiz generated via Groq Inference (GPT-OSS-120B).',
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
  postJSON('/quizzes/generate', input, () => buildQuizFallback(input));

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

export const fetchFlashcards = (): Promise<FlashcardDeck[]> => getJSON('/flashcards', FALLBACK_DECKS);

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
  postJSON('/flashcards/generate', input, () => buildDeckFallback(input));

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
  postJSON('/summaries/generate', input, () => buildSummaryFallback(input));

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

// ----------------------------------------------------------------
// NOTIFICATIONS
// ----------------------------------------------------------------
const FALLBACK_NOTIFICATIONS: Notification[] = [
  { id: 'notif-1', userId: 'usr-student-1', title: 'New Quiz Assigned', message: 'Data Structures midterm quiz is now published.', isRead: false, createdAt: '2024-02-10T08:00:00.000Z' },
  { id: 'notif-2', userId: 'usr-student-1', title: 'AI Reviewer Ready', message: 'Your Groq GPT-OSS-120B reviewer has been synthesized.', isRead: false, createdAt: '2024-02-12T08:00:00.000Z' },
];

export const fetchNotifications = (userId: string): Promise<Notification[]> =>
  getJSON(`/notifications?userId=${userId}`, FALLBACK_NOTIFICATIONS);

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

export const fetchAnnouncements = (userId?: string): Promise<Announcement[]> =>
  getJSON(`/announcements?userId=${encodeURIComponent(userId || '')}`, FALLBACK_ANNOUNCEMENTS);

export const markAnnouncementRead = (announcementId: string, userId: string): Promise<{ success: boolean }> =>
  postJSON(`/announcements/${announcementId}/read`, { userId }, { success: true });

export const markAnnouncementUnread = (announcementId: string, userId: string): Promise<{ success: boolean }> =>
  postJSON(`/announcements/${announcementId}/unread`, { userId }, { success: true });

// ----------------------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------------------
export const FALLBACK_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    userId: 'usr-student-1',
    userName: 'John Wendyl Sanchez',
    userRole: 'student',
    action: 'USER_LOGIN',
    details: 'User logged in with JWT token',
    ipAddress: '127.0.0.1',
    timestamp: '2024-02-12T10:00:00.000Z',
  },
];

export const fetchLogs = (): Promise<ActivityLog[]> => getJSON('/logs', FALLBACK_LOGS);

export interface LogInput {
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details?: string;
}

export const postLog = (input: LogInput): Promise<{ success: boolean }> =>
  postJSON('/logs', input, { success: true });

// ----------------------------------------------------------------
// LOCAL SESSION AUTH TOKEN FROM AUTHORIZATION
// ----------------------------------------------------------------
export const isOnline = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/system/info`, { headers: buildHeaders() });
    return res.ok;
  } catch {
    return false;
  }
};