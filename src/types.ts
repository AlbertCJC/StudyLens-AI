export type UserRole = "student" | "teacher" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  studentId?: string;
  status?: "active" | "suspended";
  createdAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  materialCount: number;
  createdAt: string;
}

export interface LearningMaterial {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  fileType: "pdf" | "docx" | "pptx" | "txt";
  fileUrl?: string;
  fileSize?: string;
  extractedText: string;
  uploadedBy: string;
  uploaderRole: UserRole;
  uploaderId?: string;
  materialType?: "course" | "personal";
  createdAt: string;
}

export type BloomsTaxonomy =
  | "Remembering"
  | "Understanding"
  | "Applying"
  | "Analyzing"
  | "Evaluating"
  | "Creating";

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "identification"
  | "short_answer";

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string | number; // index or text string
  explanation: string;
  bloomsLevel: BloomsTaxonomy;
  difficulty: DifficultyLevel;
  topicTag: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
  createdByName: string;
  quizType?: "teacher" | "student";
  questions: QuizQuestion[];
  isPublished: boolean;
  timeLimitMinutes?: number;
  passPercentage: number;
  difficulty: DifficultyLevel;
  createdAt: string;
}

export interface QuizAnswerSubmission {
  questionId: string;
  userAnswer: string | number;
  isCorrect: boolean;
}

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
  answers: QuizAnswerSubmission[];
  weakTopics: string[];
  strongTopics: string[];
  completedAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topicTag: string;
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

export interface Summary {
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
  formulasOrRules?: string[];
  sampleQuestions: { question: string; answer: string }[];
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

export interface TopicPerformance {
  topic: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracyPercentage: number;
}

export interface StudentProgress {
  studentId: string;
  totalQuizzesTaken: number;
  averageScore: number;
  totalMaterialsUploaded: number;
  completedFlashcardDecks: number;
  topicPerformances: TopicPerformance[];
  weakTopics: string[];
  strongTopics: string[];
  recentQuizAttempts: QuizAttempt[];
}

export interface Recommendation {
  id: string;
  studentId: string;
  weakTopic: string;
  recommendationType: "reviewer" | "flashcard" | "quiz" | "summary";
  title: string;
  description: string;
  targetId: string; // quizId or reviewerId or deckId
  difficultyTarget: DifficultyLevel;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  targetAudience: "all" | "students" | "teachers";
  priority: "low" | "medium" | "high";
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}
