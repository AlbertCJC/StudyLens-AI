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
];

export const fetchSubjects = (): Promise<Subject[]> => getJSON('/subjects', FALLBACK_SUBJECTS);

export interface AtRiskStudent {
  id: string;
  name: string;
  averageScore: number;
}

export interface TeacherSubjectAnalytics {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherName?: string;
  studentCount: number;
  quizCount: number;
  attempts: number;
  averageScore: number;
  passRate: number;
  weakTopics: string[];
  atRiskStudents: AtRiskStudent[];
}

export interface TeacherAnalytics {
  teacherId: string;
  subjects: TeacherSubjectAnalytics[];
  totals: {
    subjectCount: number;
    studentCount: number;
    attempts: number;
    averageScore: number;
    passRate: number;
    atRiskCount: number;
  };
}

const EMPTY_TEACHER_ANALYTICS = (teacherId: string): TeacherAnalytics => ({
  teacherId,
  subjects: [],
  totals: { subjectCount: 0, studentCount: 0, attempts: 0, averageScore: 0, passRate: 0, atRiskCount: 0 },
});

export const fetchTeacherAnalytics = (teacherId: string): Promise<TeacherAnalytics> =>
  getJSON(`/analytics/teacher?teacherId=${encodeURIComponent(teacherId)}`, EMPTY_TEACHER_ANALYTICS(teacherId));

export interface TopicPerformance {
  topic: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracyPercentage: number;
}

export interface MasteredTopic {
  topic: string;
  currentAccuracy: number;
  improvedFrom?: number | null;
}

export interface StudentProgress {
  studentId: string;
  totalQuizzesTaken: number;
  averageScore: number;
  totalPersonalMaterialsUploaded: number;
  totalFlashcardDecksGenerated: number;
  topicPerformances: TopicPerformance[];
  weakTopics: string[];
  strongTopics: string[];
  masteredTopics?: MasteredTopic[];
  recentQuizAttempts: QuizAttempt[];
  recentQuizAttemptsHasMore: boolean;
}

export const EMPTY_STUDENT_PROGRESS = (studentId: string): StudentProgress => ({
  studentId,
  totalQuizzesTaken: 0,
  averageScore: 0,
  totalPersonalMaterialsUploaded: 0,
  totalFlashcardDecksGenerated: 0,
  topicPerformances: [],
  weakTopics: [],
  strongTopics: [],
  recentQuizAttempts: [],
  recentQuizAttemptsHasMore: false,
});

export const fetchStudentProgress = (studentId: string): Promise<StudentProgress> =>
  getJSON(`/progress/${encodeURIComponent(studentId)}`, () => EMPTY_STUDENT_PROGRESS(studentId));

export interface SubjectStudent {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  dateEnrolled?: string;
}

export const fetchSubjectStudents = (subjectId: string): Promise<SubjectStudent[]> =>
  getJSON(`/subjects/${encodeURIComponent(subjectId)}/students`, []);

export const assignStudentsToSubject = (subjectId: string, studentIds: string[]): Promise<{ students: SubjectStudent[]; added: number }> =>
  postJSON(`/subjects/${encodeURIComponent(subjectId)}/students`, { studentIds }, () => ({ students: [], added: 0 }));

export const removeStudentsFromSubject = (subjectId: string, studentIds: string[]): Promise<{ students: SubjectStudent[]; removed: number }> =>
  mutateJSON(`/subjects/${encodeURIComponent(subjectId)}/students`, 'DELETE', { studentIds });

export interface SubjectInput {
  code: string;
  name: string;
  description?: string;
  teacherId?: string;
  semester?: string;
  course?: string;
  schoolYear?: string;
}

export const createSubject = (input: SubjectInput): Promise<Subject> => mutateJSON('/subjects', 'POST', input);

export const updateSubject = (subjectId: string, patch: Partial<SubjectInput>): Promise<Subject> =>
  mutateJSON(`/subjects/${encodeURIComponent(subjectId)}`, 'PUT', patch);

export const deleteSubject = (subjectId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/subjects/${encodeURIComponent(subjectId)}`, 'DELETE');

export const resetUserPassword = (userId: string, password: string): Promise<User> =>
  mutateJSON(`/users/${encodeURIComponent(userId)}`, 'PUT', { password });

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answers: Array<Record<string, unknown>>;
  weakTopics: string[];
  strongTopics: string[];
  completedAt: string;
  submittedAt?: string;
}

export interface SubjectStudentGrade {
  studentId: string;
  studentName: string;
  attemptCount: number;
  averagePercentage: number;
  attempts: QuizAttempt[];
}

export interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  studentId?: string;
  studentName?: string;
  attemptCount?: number;
  averagePercentage?: number;
  attempts?: QuizAttempt[];
  students?: SubjectStudentGrade[];
}

export const fetchSubjectGrades = (subjectId: string): Promise<SubjectGrades> =>
  getJSON(`/subjects/${encodeURIComponent(subjectId)}/grades`, () => ({
    subjectId,
    subjectName: '',
    attemptCount: 0,
    averagePercentage: 0,
    attempts: [],
  }));

export const submitQuizAttempt = (
  quizId: string,
  input: { studentId: string; studentName: string; answers: { questionId: string; selectedAnswer: number | string | number[] }[]; timeTaken?: number }
): Promise<QuizAttempt> =>
  postJSON(`/quizzes/${encodeURIComponent(quizId)}/submit`, input, () => ({
    id: `att-local-${Date.now()}`,
    quizId,
    quizTitle: '',
    studentId: input.studentId,
    studentName: input.studentName,
    subjectId: '',
    subjectName: '',
    score: 0,
    maxScore: input.answers.length,
    percentage: 0,
    passed: false,
    answers: [],
    weakTopics: [],
    strongTopics: [],
    completedAt: new Date().toISOString(),
  }));

export interface QuizHintResponse {
  hint: string;
}

export const fetchQuizHint = (
  question: string,
  options: string[] = [],
  questionType?: string,
  topicTag?: string
): Promise<QuizHintResponse> =>
  postJSON(
    '/hint',
    { question, options, questionType, topicTag },
    () => ({ hint: '' })
  );

// Resolve a material's file URL to an absolute URL the device can open.
// Relative /uploads/... paths are prefixed with the backend base URL; cloud
// URLs (Cloudinary/Firebase) are returned unchanged.
export function resolveMaterialFileUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  if (/^(https?:)?\/\//i.test(rawUrl)) return rawUrl;
  const base = getApiBaseUrl().replace(/\/api\/?$/, '');
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl.replace(/^\.?\//, '')}`;
  return `${base}${path}`;
}
