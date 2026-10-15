import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trash2,
  RotateCcw,
  Play,
  RotateCw,
  Plus,
  User,
  GraduationCap,
  X,
  Pencil,
  Check,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/authFetch";
import type { Quiz, QuizQuestion, QuizAttempt, Subject, QuizFeedbackItem, QuestionType } from "../../types";
import { Pagination, slicePage } from "../../components/Pagination";

const AI_DEFAULT_QUIZ_DESCRIPTION = "Automated Bloom's Taxonomy Quiz generated via Groq Inference (GPT-OSS-120B).";

// Editor styling used to mark the correct answer as the selected option card.
const CORRECT_ANSWER_CARD_CLASS =
  "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-xs ring-1 ring-green-500";
const CORRECT_ANSWER_CHIP_CLASS = "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400";

// Fixed assessment parameters (not editable by users).
const FIXED_PASS_PERCENTAGE = 75;
const FIXED_DIFFICULTY = "medium";

// ISO timestamp -> value usable by <input type="datetime-local"> in local time.
function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isQuizOverdue(quiz: Pick<Quiz, "deadline">): boolean {
  if (!quiz.deadline) return false;
  const d = new Date(quiz.deadline);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function feedbackCorrectText(fb: QuizFeedbackItem): string | null {
  const correct = fb.correctAnswer;
  if (correct === undefined || correct === null) return null;
  const options = fb.options || [];
  const resolve = (v: string | number): string => {
    if (typeof v === "number" && options[v] !== undefined) return String(options[v]);
    if (typeof v === "string") {
      const direct = options.indexOf(v);
      if (direct >= 0) return v;
      const letterIdx = "ABCD".indexOf(v.toUpperCase());
      if (letterIdx >= 0 && options[letterIdx] !== undefined) return String(options[letterIdx]);
      return v;
    }
    return String(v);
  };
  return Array.isArray(correct) ? correct.map(resolve).join(", ") : resolve(correct);
}

function feedbackUserAnswerText(fb: QuizFeedbackItem, question?: QuizQuestion): string {
  const value = fb.userAnswer;
  if (value === undefined || value === null) return "No answer";
  if (typeof value === "string" && value.trim() === "") return "No answer";
  const options =
    fb.options && fb.options.length > 0
      ? fb.options
      : ((question?.options as (string | number)[] | undefined) || []);
  const resolve = (v: string | number): string => {
    if (typeof v === "number" && options[v] !== undefined) return String(options[v]);
    if (typeof v === "string") {
      const direct = options.indexOf(v);
      if (direct >= 0) return v;
      const letterIdx = "ABCD".indexOf(v.toUpperCase());
      if (letterIdx >= 0 && options[letterIdx] !== undefined) return String(options[letterIdx]);
      return v;
    }
    return String(v);
  };
  const parts = Array.isArray(value) ? value.map(resolve).filter(Boolean) : [resolve(value)];
  return parts.length > 0 ? parts.join(", ") : "No answer";
}

function cleanQuizDescription(desc: string): string {
  return desc.replace(AI_DEFAULT_QUIZ_DESCRIPTION, "").trim();
}

// Canonicalizes a question's type, honoring producer aliases (the backend stamps the
// same canonicalization on read) and falling back to shape inference when the type
// field is missing or unknown.
function canonicalQuestionType(q: Pick<QuizQuestion, "type" | "options">): QuestionType {
  const t = (q.type || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (t === "mc" || t === "multiplechoice" || t === "multiple_choice") return "multiple_choice";
  if (t === "tf" || t === "truefalse" || t === "true_false") return "true_false";
  if (t === "identify" || t === "identifications" || t === "shortanswer" || t === "short_answer" || t === "identification")
    return "identification";
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length === 2) {
    const normalized = new Set(options.map((o) => String(o).trim().toLowerCase()));
    if (normalized.size === 2 && normalized.has("true") && normalized.has("false")) return "true_false";
  }
  if (options.length >= 2) return "multiple_choice";
  return "identification";
}

// Human-readable type label for a question, robust to missing/aliased type fields.
function questionTypeLabel(q: Pick<QuizQuestion, "type" | "correctAnswer" | "options">): string {
  const type = canonicalQuestionType(q);
  if (type === "true_false") return "True / False";
  if (type === "multiple_choice") return Array.isArray(q.correctAnswer) ? "Multiple Select" : "Multiple Choice";
  return "Identification";
}

// Resolves a single stored answer value (integer, digit-string, letter "A"-"D", or
// exact option text) into a valid option index, or -1 when it cannot be matched.
function resolveOptionIndex(value: string | number, options: (string | number)[]): number {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0 && value < options.length) return value;
    if (!Number.isNaN(value) && Math.floor(value) >= 0 && Math.floor(value) < options.length)
      return Math.floor(value);
    return -1;
  }
  const trimmed = value.trim();
  if (trimmed === "") return -1;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n >= 0 && n < options.length) return n;
    return -1;
  }
  const letterIdx = "ABCD".indexOf(trimmed.toUpperCase());
  if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
  const textIdx = options.findIndex((o) => o !== undefined && String(o).trim().toLowerCase() === trimmed.toLowerCase());
  if (textIdx >= 0) return textIdx;
  return -1;
}

// Returns the option index currently marked correct for a multiple-choice question,
// or -1 when the question is multi-answer / has no selectable answer.
function resolveMCIndex(q: QuizQuestion): number {
  if (q.type !== "multiple_choice") return -1;
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length === 0) return -1;
  const correct = q.correctAnswer;
  if (Array.isArray(correct)) return -1;
  if (typeof correct === "string" && correct.trim() === "") return -1;
  return resolveOptionIndex(correct as string | number, options);
}

// Normalizes a question before editing so answer state is ALWAYS a valid, visibly
// selectable value regardless of the encoding (index, letter, text, null) it came in
// with. Correct answers are never left "blank" in the editor.
function normalizeQuestionForEdit(q: QuizQuestion): QuizQuestion {
  const type = canonicalQuestionType(q);
  const base = { ...q, type };
  if (type === "multiple_choice") {
    const options = Array.isArray(base.options) && base.options.length > 0 ? base.options : ["Option A", "Option B"];
    const normalized = { ...base, options };
    if (Array.isArray(base.correctAnswer)) {
      const resolved = base.correctAnswer
        .map((v) => resolveOptionIndex(v as string | number, options))
        .filter((idx) => idx >= 0);
      return { ...normalized, correctAnswer: resolved.length > 0 ? resolved : [0] };
    }
    const idx = resolveMCIndex(normalized);
    return { ...normalized, correctAnswer: idx >= 0 ? idx : 0 };
  }
  if (type === "true_false") {
    const tf = Number(base.correctAnswer);
    return { ...base, correctAnswer: Number.isNaN(tf) ? 0 : tf === 1 ? 1 : 0, options: ["True", "False"] };
  }
  if (type === "identification") {
    return { ...base, options: [], correctAnswer: typeof base.correctAnswer === "string" ? base.correctAnswer : String(base.correctAnswer ?? "") };
  }
  return base;
}

interface AssessmentPageProps {
  onNavigate: (tab: string) => void;
}

export interface SavedQuizProgress {
  quizId: string;
  quizTitle: string;
  subjectName: string;
  currentQIndex: number;
  userAnswers: Record<string, unknown>;
  timeLeft: number;
  targetEndTime: number; // Absolute timestamp (ms) when timer expires
  totalQuestions: number;
  lastUpdated: number;
  savedQuiz: Quiz;
}

export const AssessmentPage: React.FC<AssessmentPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const canManageCourseQuizzes = currentUser?.role === "teacher";
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuizId = searchParams.get("quizId");
  const returnTo = searchParams.get("returnTo");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Filter Tab & Subject State
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [quizPage, setQuizPage] = useState(1);

  useEffect(() => {
    setQuizPage(1);
  }, [selectedSubjectFilter]);

  // Create Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizSubjectId, setNewQuizSubjectId] = useState("");
  const [newQuizTopic, setNewQuizTopic] = useState("");
  const [newQuizType, setNewQuizType] = useState<"teacher" | "student">("teacher");
  const [newQuizTimeLimit, setNewQuizTimeLimit] = useState<number>(15);
  const [newQuizLimitAttempts, setNewQuizLimitAttempts] = useState(false);
  const [newQuizAttempts, setNewQuizAttempts] = useState<number>(3);
  const [newQuizRevealAnswers, setNewQuizRevealAnswers] = useState(true);
  const [newQuizDeadline, setNewQuizDeadline] = useState<string>("");
  const [newQuizQuestions, setNewQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);

  // Manual Question Entry State (for Create/Edit)
  const [manualQType, setManualQType] = useState<QuestionType>("multiple_choice");
  const [manualQText, setManualQText] = useState("");
  const [manualQOpt0, setManualQOpt0] = useState("");
  const [manualQOpt1, setManualQOpt1] = useState("");
  const [manualQOpt2, setManualQOpt2] = useState("");
  const [manualQOpt3, setManualQOpt3] = useState("");
  const [manualQCorrect, setManualQCorrect] = useState<number>(0);
  const [manualQMulti, setManualQMulti] = useState(false);
  const [manualQMultiCorrect, setManualQMultiCorrect] = useState<number[]>([]);
  const [manualQIdentAnswer, setManualQIdentAnswer] = useState("");
  const [manualQExplanation, setManualQExplanation] = useState("");

  // Quiz Deletion Modal
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  // Quiz Preview Modal (read-only view of a quiz's contents)
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  // Assign Subject Modal State (teacher quizzes, mirroring Upload & Manage Materials)
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignQuizSubjectId, setAssignQuizSubjectId] = useState("");
  const [isAssigningQuizSubject, setIsAssigningQuizSubject] = useState(false);
  const [assignQuizMsg, setAssignQuizMsg] = useState<string | null>(null);

  // Edit Quiz Modal
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editQuizType, setEditQuizType] = useState<"teacher" | "student">("teacher");
  const [editTimeLimit, setEditTimeLimit] = useState<number>(15);
  const [editLimitAttempts, setEditLimitAttempts] = useState(false);
  const [editAttempts, setEditAttempts] = useState<number>(3);
  const [editRevealAnswers, setEditRevealAnswers] = useState(true);
  const [editDeadline, setEditDeadline] = useState<string>("");
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const editQuestionListRef = useRef<HTMLDivElement>(null);
  const editPromptRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [editScrollTick, setEditScrollTick] = useState(0);

  // When a question is added via "Add Question", scroll the list to the new card and
  // focus its prompt so the next one can be typed immediately.
  useEffect(() => {
    if (editScrollTick === 0) return;
    const el = editQuestionListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    const prompts = editPromptRefs.current;
    prompts[prompts.length - 1]?.focus();
  }, [editScrollTick]);

  // Active Quiz Taking State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, unknown>>({});
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 mins in seconds
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);

  // Saved Progresses Map (quizId -> SavedQuizProgress) initialized lazily from localStorage
  const [savedProgresses, setSavedProgresses] = useState<Record<string, SavedQuizProgress>>(() => {
    if (typeof window === "undefined") return {};
    const userId = currentUser?.id || "guest";
    const map: Record<string, SavedQuizProgress> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`studylens_quiz_progress_${userId}_`)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item) as SavedQuizProgress;
            map[parsed.quizId] = parsed;
          }
        } catch (e) {
          console.error("Error reading quiz progress from localStorage:", e);
        }
      }
    }
    return map;
  });

  // Completed Attempt State
  const [completedAttempt, setCompletedAttempt] = useState<QuizAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Quizzes and Subjects
  useEffect(() => {
    let isSubscribed = true;
    const fetchCatalogData = async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          authFetch(`/api/quizzes?studentId=${currentUser?.id || ""}&userRole=${currentUser?.role || ""}`),
          authFetch("/api/subjects"),
        ]);
        if (qRes.ok && isSubscribed) {
          const qData = await qRes.json();
          setQuizzes(qData);
          if (initialQuizId) {
            const target = qData.find((q: Quiz) => q.id === initialQuizId);
            if (target) {
              // Route through the same entry path as a manual open so the real
              // time limit applies and the countdown actually starts.
              handleStartQuiz(target);
            }
          }
        }
        if (sRes.ok && isSubscribed) {
          const sData = await sRes.json();
          setSubjects(sData);
          if (sData.length > 0) setNewQuizSubjectId(sData[0].id);
        }
      } catch (err) {
        console.error("Fetch catalog data error:", err);
      }
    };

    fetchCatalogData();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id, currentUser?.role, initialQuizId]);

  // Submit Quiz Handler
  const handleSubmitQuiz = useCallback(async () => {
    if (!activeQuiz) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const answersPayload = Object.entries(userAnswers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    try {
      const res = await authFetch(`/api/quizzes/${activeQuiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: currentUser?.id,
          studentName: currentUser?.name,
          answers: answersPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSubmitError(
          `Could not submit your assessment. ${data?.error || `Server returned status ${res.status}`}`
        );
        if (res.status === 409) {
          setQuizzes((prev) =>
            prev.map((q) =>
              q.id === activeQuiz.id
                ? { ...q, attemptsUsed: data?.attemptsUsed ?? q.attemptsUsed, attemptsAllowed: data?.attemptsAllowed ?? q.attemptsAllowed }
                : q
            )
          );
        }
        return;
      }

      const data = await res.json();

      // RESET / CLEAR SAVED PROGRESS FOR THIS QUIZ UPON COMPLETION
      const userId = currentUser?.id || "guest";
      const storageKey = `studylens_quiz_progress_${userId}_${activeQuiz.id}`;
      localStorage.removeItem(storageKey);
      setSavedProgresses((prev) => {
        const copy = { ...prev };
        delete copy[activeQuiz.id];
        return copy;
      });

      setCompletedAttempt(data.attempt);
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === activeQuiz.id
            ? {
                ...q,
                attemptsUsed: (q.attemptsUsed || 0) + 1,
                lastScoreRaw: data.attempt?.score ?? q.lastScoreRaw,
                lastMaxScore: data.attempt?.maxScore ?? data.attempt?.totalPoints ?? q.lastMaxScore,
                lastScore: data.attempt?.percentage ?? q.lastScore,
              }
            : q
        )
      );
    } catch (err) {
      console.error("Submit quiz error:", err);
      setSubmitError(`Could not submit your assessment. ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeQuiz, currentUser, userAnswers]);

  // Timer effect: remaining seconds are computed against targetEndTime so the
  // countdown keeps running even if the component re-renders.
  useEffect(() => {
    if (!activeQuiz || completedAttempt || !targetEndTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((targetEndTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        // Auto submit quiz when timer reaches 0
        handleSubmitQuiz();
      }
    };

    updateTimer(); // Run calculation immediately
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeQuiz, completedAttempt, targetEndTime, handleSubmitQuiz]);

  // Auto-Save Quiz Progress to localStorage whenever state changes while taking active quiz
  useEffect(() => {
    if (activeQuiz && !completedAttempt && targetEndTime) {
      const userId = currentUser?.id || "guest";
      const storageKey = `studylens_quiz_progress_${userId}_${activeQuiz.id}`;
      const progressData: SavedQuizProgress = {
        quizId: activeQuiz.id,
        quizTitle: activeQuiz.title,
        subjectName: activeQuiz.subjectName,
        currentQIndex,
        userAnswers,
        timeLeft,
        targetEndTime,
        totalQuestions: activeQuiz.questions.length,
        lastUpdated: Date.now(),
        savedQuiz: activeQuiz,
      };
      localStorage.setItem(storageKey, JSON.stringify(progressData));
    }
  }, [activeQuiz, currentQIndex, userAnswers, timeLeft, targetEndTime, completedAttempt, currentUser?.id]);

  const handleStartQuiz = (quiz: Quiz, resume = false) => {
    if (!resume && currentUser?.role !== "teacher" && currentUser?.role !== "admin" && quiz.isPublished === false) {
      showToast("This quiz has not been published yet and is not available to students.", "info");
      return;
    }
    const quizAttemptsAllowed = quiz.attemptsAllowed || 0;
    if (quiz.quizType !== "student" && quizAttemptsAllowed > 0 && (quiz.attemptsUsed || 0) >= quizAttemptsAllowed) {
      showToast("You have reached the maximum number of attempts allowed for this quiz.", "error");
      return;
    }
    if (currentUser?.role === "student" && isQuizOverdue(quiz)) {
      showToast("The deadline for this quiz has passed. It has been recorded as Missing.", "error");
      return;
    }
    const userId = currentUser?.id || "guest";
    const storageKey = `studylens_quiz_progress_${userId}_${quiz.id}`;
    const saved = savedProgresses[quiz.id];

    if (resume && saved) {
      setActiveQuiz(saved.savedQuiz || quiz);
      setCurrentQIndex(saved.currentQIndex || 0);
      setUserAnswers(saved.userAnswers || {});

      let endTime = saved.targetEndTime;
      if (!endTime) {
        endTime = Date.now() + (saved.timeLeft ?? (quiz.timeLimitMinutes || 15) * 60) * 1000;
      }

      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTargetEndTime(endTime);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        showToast("The time limit for this quiz has expired while away! Automatically calculating your score now...", "info");
      }
    } else {
      // Starting fresh - clear previous saved progress for this quiz
      localStorage.removeItem(storageKey);
      setSavedProgresses((prev) => {
        const copy = { ...prev };
        delete copy[quiz.id];
        return copy;
      });

      const durationSeconds = (quiz.timeLimitMinutes || 15) * 60;
      const endTime = Date.now() + durationSeconds * 1000;

      setActiveQuiz(quiz);
      setCurrentQIndex(0);
      setUserAnswers({});
      setTargetEndTime(endTime);
      setTimeLeft(durationSeconds);
    }

    setCompletedAttempt(null);
    setHint(null);
    setSubmitError(null);
  };

  const handleDiscardProgress = (quizId: string) => {
    const userId = currentUser?.id || "guest";
    const storageKey = `studylens_quiz_progress_${userId}_${quizId}`;
    localStorage.removeItem(storageKey);
    setSavedProgresses((prev) => {
      const copy = { ...prev };
      delete copy[quizId];
      return copy;
    });
  };

  const handleSelectAnswer = (qId: string, answer: unknown) => {
    setHint(null);
    setUserAnswers({ ...userAnswers, [qId]: answer });
  };

  const handleFetchHint = async (question: QuizQuestion) => {
    setLoadingHint(true);
    setHint(null);
    try {
      const res = await authFetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.question,
          options: question.options,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHint(data.hint);
      }
    } catch (err) {
      console.error("Fetch hint error:", err);
    } finally {
      setLoadingHint(false);
    }
  };

  const handleAddManualQuestion = () => {
    if (!manualQText.trim()) return;

    let newQ: QuizQuestion;
    if (manualQType === "identification") {
      newQ = {
        id: `manual-q-${Date.now()}`,
        question: manualQText.trim(),
        type: "identification",
        options: [],
        correctAnswer: manualQIdentAnswer.trim(),
        explanation: manualQExplanation.trim() || `Correct key term: "${manualQIdentAnswer.trim()}"`,
        bloomsLevel: "Remembering",
        difficulty: FIXED_DIFFICULTY,
        topicTag: newQuizTopic || "Identification",
      };
    } else if (manualQType === "true_false") {
      newQ = {
        id: `manual-q-${Date.now()}`,
        question: manualQText.trim(),
        type: "true_false",
        options: ["True", "False"],
        correctAnswer: manualQCorrect,
        explanation: manualQExplanation.trim() || "Standard answer explanation.",
        bloomsLevel: "Understanding",
        difficulty: FIXED_DIFFICULTY,
        topicTag: newQuizTopic || "True/False",
      };
    } else {
      newQ = {
        id: `manual-q-${Date.now()}`,
        question: manualQText.trim(),
        type: "multiple_choice",
        options: [
          manualQOpt0 || "Option A",
          manualQOpt1 || "Option B",
          manualQOpt2 || "Option C",
          manualQOpt3 || "Option D",
        ],
        correctAnswer: manualQMulti ? manualQMultiCorrect : manualQCorrect,
        explanation: manualQExplanation.trim() || "Standard answer explanation.",
        bloomsLevel: "Understanding",
        difficulty: FIXED_DIFFICULTY,
        topicTag: newQuizTopic || "Core Concepts",
      };
    }

    setNewQuizQuestions((prev) => [...prev, newQ]);
    setManualQText("");
    setManualQOpt0("");
    setManualQOpt1("");
    setManualQOpt2("");
    setManualQOpt3("");
    setManualQIdentAnswer("");
    setManualQExplanation("");
    setManualQMulti(false);
    setManualQMultiCorrect([]);
  };

  const handleCreatePersonalQuiz = async () => {
    if (!newQuizTitle.trim()) return;
    setIsCreatingQuiz(true);
    try {
      const selectedSubject = newQuizSubjectId
        ? subjects.find((s) => s.id === newQuizSubjectId)
        : undefined;
      const isTeacher = currentUser?.role === "teacher";
      
      const shuffleMcOptions = (q: QuizQuestion): QuizQuestion => {
        if (q.type !== "multiple_choice" || !q.options || q.options.length < 2) return q;
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        if (Array.isArray(q.correctAnswer)) {
          const correctTexts = q.correctAnswer
            .map((i) => q.options![Number(i)])
            .filter((t): t is string => typeof t === "string");
          return {
            ...q,
            options: shuffled,
            correctAnswer: correctTexts.map((t) => shuffled.indexOf(t)).filter((i) => i >= 0),
          };
        }
        const correctIndex = Number(q.correctAnswer) || 0;
        const correctText = q.options[correctIndex];
        return { ...q, options: shuffled, correctAnswer: shuffled.indexOf(correctText) };
      };

      const defaultQuestions: QuizQuestion[] = [
        {
          id: `q-${Date.now()}-1`,
          question: `Question 1 (${newQuizTopic || newQuizTitle}): Which algorithm strategy minimizes step complexity?`,
          type: "multiple_choice",
          options: ["Divide and Conquer", "Greedy Approach", "Dynamic Programming", "Brute Force Search"],
          correctAnswer: 0,
          explanation: "Divide and conquer divides large problems into smaller independent subproblems.",
          bloomsLevel: "Understanding",
          difficulty: FIXED_DIFFICULTY,
          topicTag: newQuizTopic || "Core Concepts",
        },
        {
          id: `q-${Date.now()}-2`,
          question: `Question 2 (${newQuizTopic || newQuizTitle}): True or False: Space complexity analysis accounts for auxiliary memory used during execution.`,
          type: "true_false",
          options: ["True", "False"],
          correctAnswer: 0,
          explanation: "True. Auxiliary space measures memory required by the algorithm excluding input size.",
          bloomsLevel: "Remembering",
          difficulty: FIXED_DIFFICULTY,
          topicTag: newQuizTopic || "Core Concepts",
        },
        {
          id: `q-${Date.now()}-3`,
          question: `Question 3 (${newQuizTopic || newQuizTitle}): What is the primary benefit of modular decomposition in course material study?`,
          type: "multiple_choice",
          options: ["Reduces cognitive load", "Eliminates variable scope", "Increases runtime latency", "Suppresses compiler warnings"],
          correctAnswer: 0,
          explanation: "Modularizing material allows focused mastery of individual concept blocks.",
          bloomsLevel: "Analyzing",
          difficulty: FIXED_DIFFICULTY,
          topicTag: newQuizTopic || "Core Concepts",
        },
      ].map(shuffleMcOptions);

      const finalQuestions = newQuizQuestions.length > 0 ? newQuizQuestions : defaultQuestions;

      const quizRes = await authFetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newQuizTitle,
          description: isTeacher
            ? `Official Course Assessment on ${newQuizTopic || newQuizTitle}`
            : `Self-study practice quiz on ${newQuizTopic || newQuizTitle}`,
          subjectId: selectedSubject ? selectedSubject.id : (isTeacher ? "" : "personal"),
          questions: finalQuestions,
          createdById: currentUser?.id || (isTeacher ? "usr-teacher-1" : ""),
          createdByName: currentUser?.name || (isTeacher ? "Faculty Instructor" : "Student User"),
          quizType: newQuizType,
          uploaderRole: currentUser?.role || "student",
          isPublished: newQuizType === "teacher" ? !!selectedSubject : true,
          timeLimitMinutes: newQuizTimeLimit,
          passPercentage: FIXED_PASS_PERCENTAGE,
          difficulty: FIXED_DIFFICULTY,
          attemptsAllowed: newQuizLimitAttempts ? newQuizAttempts : 0,
          revealAnswers: newQuizRevealAnswers,
          deadline: newQuizDeadline ? new Date(newQuizDeadline).toISOString() : null,
        }),
      });

      if (quizRes.ok) {
        const created = await quizRes.json();
        setQuizzes((prev) => [created, ...prev]);
        setShowCreateModal(false);
        setNewQuizTitle("");
        setNewQuizTopic("");
        setNewQuizQuestions([]);
        setNewQuizLimitAttempts(false);
        setNewQuizAttempts(3);
      } else {
        const body = await quizRes.json().catch(() => null);
        showToast(typeof body?.error === "string" ? body.error : "Could not create the quiz. Please try again.", "error");
      }
    } catch (err) {
      console.error("Create quiz error:", err);
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const handleOpenEditModal = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setEditTitle(quiz.title);
    setEditDescription(quiz.description || "");
    // Personal practice drills stay subjectless: never silently assign one.
    setEditSubjectId(quiz.quizType === "student" ? quiz.subjectId || "" : quiz.subjectId || (subjects[0] ? subjects[0].id : "sub-101"));
    setEditQuizType(quiz.quizType || "teacher");
    setEditTimeLimit(quiz.timeLimitMinutes || 15);
    setEditLimitAttempts((quiz.attemptsAllowed || 0) > 0);
    setEditAttempts(quiz.attemptsAllowed || 3);
    setEditRevealAnswers(quiz.revealAnswers !== false);
    setEditDeadline(toLocalInputValue(quiz.deadline));
    setEditQuestions((quiz.questions || []).map(normalizeQuestionForEdit));
  };

  const handleSaveEditQuiz = async () => {
    if (!editingQuiz) return;
    try {
      // Practice drills cannot move subjects or change scope: omit those keys
      // entirely so the backend ownership guard accepts the update.
      const isPractice = editingQuiz.quizType === "student";
      const selectedSubject = subjects.find((s) => s.id === editSubjectId);
      const res = await authFetch(`/api/quizzes/${editingQuiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          ...(isPractice
            ? {}
            : {
                subjectId: editSubjectId,
                subjectName: selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : editingQuiz.subjectName,
                quizType: editQuizType,
              }),
          timeLimitMinutes: editTimeLimit,
          passPercentage: FIXED_PASS_PERCENTAGE,
          difficulty: FIXED_DIFFICULTY,
          attemptsAllowed: editLimitAttempts ? editAttempts : 0,
          revealAnswers: editRevealAnswers,
          deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
          questions: editQuestions,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setQuizzes((prev) => prev.map((q) => (q.id === editingQuiz.id ? updated : q)));
        setEditingQuiz(null);
      } else {
        const body = await res.json().catch(() => null);
        showToast(typeof body?.error === "string" ? body.error : "Could not save the quiz changes. Please try again.", "error");
      }
    } catch (err) {
      console.error("Save edit quiz error:", err);
    }
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    const publish = !quiz.isPublished;
    if (publish && !quiz.subjectId) {
      openAssignQuizSubject(quiz, "Assign this quiz to a subject before publishing it.");
      return;
    }
    try {
      const res = await authFetch(`/api/quizzes/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: publish }),
      });
      if (res.ok) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quiz.id ? { ...q, isPublished: publish } : q))
        );
        showToast(publish ? "Quiz published." : "Quiz unpublished.");
      } else {
        const body = await res.json().catch(() => null);
        showToast(typeof body?.error === "string" ? body.error : "Could not update the quiz.", "error");
      }
    } catch (err) {
      console.error("Toggle publish error:", err);
    }
  };

  const openAssignQuizSubject = (quiz: Quiz, msg?: string | null) => {
    setAssignQuiz(quiz);
    setAssignQuizSubjectId(quiz.subjectId && quiz.subjectId !== "" && quiz.subjectId !== "personal" ? quiz.subjectId : "");
    setAssignQuizMsg(msg ?? null);
  };

  const handleAssignQuizSubject = async () => {
    if (!assignQuiz || !assignQuizSubjectId) {
      setAssignQuizMsg("Please select an assigned subject.");
      return;
    }
    setIsAssigningQuizSubject(true);
    setAssignQuizMsg(null);
    try {
      const selectedSubject = subjects.find((s) => s.id === assignQuizSubjectId);
      const res = await authFetch(`/api/quizzes/${assignQuiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: assignQuizSubjectId,
          subjectName: selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : assignQuiz.subjectName,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuizzes((prev) => prev.map((q) => (q.id === assignQuiz.id ? updated : q)));
        setAssignQuiz(null);
        showToast("Subject assigned to quiz.");
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(typeof body?.error === "string" ? body.error : "Could not assign the subject. Please try again.", "error");
      }
    } catch {
      showToast("Could not assign the subject. Please try again.", "error");
    } finally {
      setIsAssigningQuizSubject(false);
    }
  };

  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    try {
      const res = await authFetch(`/api/quizzes/${quizToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizToDelete.id));
        const userId = currentUser?.id || "guest";
        localStorage.removeItem(`studylens_quiz_progress_${userId}_${quizToDelete.id}`);
        setSavedProgresses((prev) => {
          const copy = { ...prev };
          delete copy[quizToDelete.id];
          return copy;
        });
        showToast("Quiz deleted.");
      }
    } catch (err) {
      console.error("Delete quiz error:", err);
    } finally {
      setQuizToDelete(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Filter Quizzes according to Privacy Rule and Subject selection
  const visibleQuizzes = quizzes.filter((q) => {
    // Unpublished quizzes are hidden from students entirely (staff still see them).
    if (q.isPublished === false && currentUser?.role !== "teacher" && currentUser?.role !== "admin") return false;
    if (selectedSubjectFilter !== "all" && q.subjectId !== selectedSubjectFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* 1. ACTIVE QUIZ TAKING INTERFACE */}
      {activeQuiz && !completedAttempt && (() => {
        const isTeacherQuiz = (activeQuiz.quizType || (activeQuiz.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";

        return (
          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden space-y-0">
            {/* Top Header Bar */}
            <div className="bg-card border-b border-border p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold uppercase tracking-wider">
                    {activeQuiz.subjectName}
                  </span>
                </div>
                <h2 className="text-lg font-bold mt-1 text-foreground">{activeQuiz.title}</h2>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl font-mono text-base font-bold border border-amber-500/30">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>
            </div>

            {/* Question Stepper Progress Bar */}
            <div className="w-full bg-muted h-1.5">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{
                  width: `${((currentQIndex + 1) / activeQuiz.questions.length) * 100}%`,
                }}
              ></div>
            </div>

            {/* Active Question Body */}
            <div className="p-6 space-y-6">
              {activeQuiz.questions[currentQIndex] && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">
                      Question {currentQIndex + 1} of {activeQuiz.questions.length}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground">
                    {activeQuiz.questions[currentQIndex].question}
                  </h3>

                  {/* Question Options */}
                  {Array.isArray(activeQuiz.questions[currentQIndex].correctAnswer) && (
                    <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center space-x-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Select all correct answers that apply.</span>
                    </p>
                  )}
                  {activeQuiz.questions[currentQIndex].options &&
                  activeQuiz.questions[currentQIndex].options!.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {activeQuiz.questions[currentQIndex].options!.map((opt, oIdx) => {
                        const q = activeQuiz.questions[currentQIndex];
                        const isMulti = Array.isArray(q.correctAnswer);
                        const saved = userAnswers[q.id];
                        const isSelected = isMulti
                          ? Array.isArray(saved) && (saved as number[]).includes(oIdx)
                          : saved === oIdx;
                        return (
                          <button
                            key={oIdx}
                            onClick={() => {
                              if (isMulti) {
                                const current = Array.isArray(saved) ? (saved as number[]) : [];
                                setUserAnswers({
                                  ...userAnswers,
                                  [q.id]: current.includes(oIdx)
                                    ? current.filter((i) => i !== oIdx)
                                    : [...current, oIdx],
                                });
                              } else {
                                handleSelectAnswer(q.id, oIdx);
                              }
                            }}
                            className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? CORRECT_ANSWER_CARD_CLASS
                                : "bg-muted/40 border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            <span>
                              <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                              {opt}
                            </span>
                            {isSelected &&
                              (isMulti ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ))}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pt-2">
                      <textarea
                        rows={3}
                        value={(userAnswers[activeQuiz.questions[currentQIndex].id] as string) || ""}
                        onChange={(e) =>
                          handleSelectAnswer(activeQuiz.questions[currentQIndex].id, e.target.value)
                        }
                        placeholder="Type your open answer here..."
                        className="w-full p-3 border border-border bg-muted/30 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Study Hint Section - DISABLED FOR TEACHER QUIZZES */}
                  <div className="pt-2">
                    {!isTeacherQuiz && hint ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
                        <span className="font-bold flex items-center justify-between gap-2 text-amber-600 dark:text-amber-400">
                          <span>Study Hint</span>
                          <button
                            type="button"
                            onClick={() => setHint(null)}
                            aria-label="Dismiss hint"
                            className="p-0.5 rounded hover:bg-amber-500/20 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                        <p className="leading-relaxed">{hint}</p>
                      </div>
                    ) : !isTeacherQuiz ? (
                      <button
                        onClick={() => handleFetchHint(activeQuiz.questions[currentQIndex])}
                        disabled={loadingHint}
                        className="px-3 py-1.5 bg-muted hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <span>{loadingHint ? "Fetching hint..." : "Get a hint"}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              {submitError && (
                <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
                  {submitError}
                </div>
              )}

              {/* Stepper Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setHint(null);
                    setCurrentQIndex((prev) => Math.max(0, prev - 1));
                  }}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2 border border-border text-foreground rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>

                {currentQIndex < activeQuiz.questions.length - 1 ? (
                  <button
                    onClick={() => {
                      setHint(null);
                      setCurrentQIndex((prev) => prev + 1);
                    }}
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Assessment"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. COMPLETED ATTEMPT RESULTS VIEW */}
      {completedAttempt && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="text-center space-y-2 border-b border-border pb-4">
            <h2 className="text-2xl font-black text-foreground">
              Assessment Completed
            </h2>
            <p className="text-base font-bold text-primary">
              Your Score: {completedAttempt.score} / {completedAttempt.totalPoints} (
              {completedAttempt.percentage}%)
            </p>
            <p className="text-xs text-muted-foreground">
              Submitted on {new Date(completedAttempt.submittedAt).toLocaleString()}
</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">Question Feedback & Explanations</h3>
            {completedAttempt.feedback?.map((fb, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border space-y-2 text-xs ${
                  fb.isCorrect
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-rose-500/10 border-rose-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Question {idx + 1}</span>
                  {fb.isCorrect ? (
                    <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> <span>Correct (+1)</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-bold">
                      <XCircle className="w-4 h-4" /> <span>Incorrect</span>
                    </span>
                  )}
                </div>
                <p className="font-semibold text-foreground">{fb.question}</p>
                {fb.userAnswer !== undefined && fb.userAnswer !== null && (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Your answer:</strong>{" "}
                    {feedbackUserAnswerText(fb, activeQuiz.questions[idx])}
                  </p>
                )}
                {feedbackCorrectText(fb) && (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Correct answer:</strong>{" "}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{feedbackCorrectText(fb)}</span>
                  </p>
                )}
                {fb.explanation && (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Explanation:</strong> {fb.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                if (returnTo) {
                  navigate(decodeURIComponent(returnTo));
                  return;
                }
                setActiveQuiz(null);
                setCompletedAttempt(null);
                setSubmitError(null);
              }}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer"
            >
              {returnTo ? "Back to Subject Quizzes" : "Back to Assessments Catalog"}
            </button>
          </div>
        </div>
      )}

      {/* 3. CATALOG OF QUIZZES & ASSESSMENT TYPES */}
      {!activeQuiz && (
        <div className="space-y-6">
          {/* Slim toolbar */}
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => {
                    if (!canManageCourseQuizzes) {
                      setNewQuizType("student");
                    }
                    setNewQuizDeadline("");
                    setShowCreateModal(true);
                  }}
                className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Quiz</span>
              </button>

              <button
                onClick={() => onNavigate("ai-assistant")}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI Quiz Generator</span>
              </button>
            </div>
          </div>

          {/* Unfinished Quiz Resume Alert Banner */}
          {Object.keys(savedProgresses).length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {Object.values(savedProgresses)[0].quizTitle} ({Object.values(savedProgresses)[0].subjectName})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Stopped at Question {Object.values(savedProgresses)[0].currentQIndex + 1} of {Object.values(savedProgresses)[0].totalQuestions} ({Object.keys(Object.values(savedProgresses)[0].userAnswers || {}).length} answered)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-center">
                <button
                  onClick={() => {
                    const firstSaved = Object.values(savedProgresses)[0];
                    const foundQuiz = quizzes.find((q) => q.id === firstSaved.quizId) || firstSaved.savedQuiz;
                    if (foundQuiz) handleStartQuiz(foundQuiz, true);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Quiz</span>
                </button>
                <button
                  onClick={() => handleDiscardProgress(Object.values(savedProgresses)[0].quizId)}
                  className="px-3 py-2 bg-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Quiz Type Tabs & Subject Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border w-fit max-w-full overflow-x-auto shrink-0">
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-card text-foreground shadow-xs border border-border">
                  All Quizzes ({quizzes.length})
                </span>
              </div>

              {/* Subject Filter Dropdown */}
              <div className="flex items-center space-x-1 pl-2 border-l border-border">
                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Subject:</span>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Subjects Filter</option>
                  {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} - {sub.name}
                          </option>
                        ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quizzes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleQuizzes.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-card border border-border rounded-2xl p-6">
                <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                <h3 className="text-sm font-bold text-foreground">No assessments match your criteria</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Try switching subject filters or quiz tabs, or create a new assessment above.
                </p>
              </div>
            ) : (
              slicePage(visibleQuizzes, quizPage).map((quiz) => {
                const saved = savedProgresses[quiz.id];
                const canManage = currentUser?.role === "teacher" || (quiz.createdById === currentUser?.id && currentUser?.role !== "admin");
                const canPublish = currentUser?.role === "teacher";
                const quizAttemptsAllowed = quiz.attemptsAllowed || 0;
                const cleanDesc = cleanQuizDescription(quiz.description || "");

                return (
                  <div
                    key={quiz.id}
                    onClick={() => setPreviewQuiz(quiz)}
                    className={`bg-card p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 cursor-pointer ${
                      saved
                        ? "border-amber-500/50 shadow-md ring-1 ring-amber-500/20"
                        : "border-border shadow-xs hover:border-primary/50"
                    }`}
                    title="Click to view this quiz"
                  >
                    <div className="space-y-3">
                      {/* Header Badges */}
                      <div className="flex items-center justify-between gap-2">
                        {quiz.subjectName ? (
                          <span className="px-2.5 py-1 bg-primary/10 text-primary font-mono text-[11px] font-bold rounded-lg uppercase truncate max-w-[200px]">
                            {quiz.subjectName}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 font-mono text-[11px] font-bold rounded-lg uppercase tracking-wider truncate max-w-[200px] border border-amber-500/30">
                            Unassigned
                          </span>
                        )}
                        {(quiz.attemptsUsed ?? 0) > 0 && (
                          <span className="text-base font-bold text-primary shrink-0 tabular-nums">
                            {quiz.lastScoreRaw ?? 0}/{quiz.lastMaxScore ?? 0}
                          </span>
                        )}
                      </div>

                      {/* Quiz Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-foreground leading-snug">{quiz.title}</h3>
                        {cleanDesc && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{cleanDesc}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{quiz.questions?.length || 0} Questions</span>
                        {quiz.quizType === "teacher" && (
                          <span
                            className={
                              quizAttemptsAllowed > 0 && (quiz.attemptsUsed || 0) >= quizAttemptsAllowed
                                ? "text-rose-600 font-semibold"
                                : ""
                            }
                          >
                            {quizAttemptsAllowed > 0
                              ? `${quiz.attemptsUsed || 0}/${quizAttemptsAllowed} attempts`
                              : "Unlimited attempts"}
                          </span>
                        )}
                      </div>

                      {quiz.deadline && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className={isQuizOverdue(quiz) && (quiz.attemptsUsed || 0) === 0 ? "text-rose-600 font-bold" : "text-muted-foreground"}>
                            Due {new Date(quiz.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            {isQuizOverdue(quiz) && (quiz.attemptsUsed || 0) === 0 && " · Missing"}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        {canPublish && quiz.subjectId && quiz.subjectId !== "personal" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePublish(quiz);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              quiz.isPublished
                                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            }`}
                            title={quiz.isPublished ? "Unpublish Quiz" : "Publish Quiz"}
                          >
                            {quiz.isPublished ? "Unpublish" : "Publish"}
                          </button>
                        )}

                        {canPublish && quiz.quizType === "teacher" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssignQuizSubject(quiz);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                              quiz.subjectId
                                ? "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20"
                                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                            }`}
                            title={quiz.subjectId ? "Change the assigned subject" : "Assign this quiz to an assigned subject"}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>{quiz.subjectId ? "Change Subject" : "Assign Subject"}</span>
                          </button>
                        )}

                        {canManage && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(quiz);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                              title="Edit Quiz details & questions"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuizToDelete(quiz);
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                              title="Delete Quiz"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {saved ? (
                          <div className="flex items-center space-x-1.5 ml-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartQuiz(quiz, false);
                              }}
                              className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              title="Start quiz from Question 1"
                            >
                              <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                              <span>Restart</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartQuiz(quiz, true);
                              }}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Resume</span>
                            </button>
                          </div>
                        ) : (quiz.attemptsAllowed || 0) > 0 &&
                          (quiz.attemptsUsed ?? 0) >= (quiz.attemptsAllowed || 0) ? (
                          <span
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground ml-auto"
                            title="Attempt limit reached for this quiz"
                          >
                            Attempts Exceeded
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartQuiz(quiz, false);
                            }}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 ml-auto cursor-pointer"
                          >
                            <span>{(quiz.attemptsUsed ?? 0) > 0 ? "Retake Quiz" : "Take Quiz"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Pagination
            page={quizPage}
            total={visibleQuizzes.length}
            onPageChange={setQuizPage}
          />
        </div>
      )}

      {/* QUIZ PREVIEW MODAL (read-only view of a quiz's contents) */}
      {previewQuiz && (() => {
        const pq = previewQuiz;
        const isTeacherQuiz = (pq.quizType || (pq.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";
        const pqCanManage = canManageCourseQuizzes || (pq.createdById === currentUser?.id && currentUser?.role !== "admin");
        const pqSaved = savedProgresses[pq.id];
        const pqAttemptsAllowed = pq.attemptsAllowed || 0;
        const pqExhausted =
          isTeacherQuiz && pqAttemptsAllowed > 0 && (pq.attemptsUsed || 0) >= pqAttemptsAllowed;
        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewQuiz(null);
            }}
          >
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full shadow-xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-border p-5 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      {pq.subjectName ? (
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-mono text-[10px] font-bold rounded-md uppercase tracking-wider">
                          {pq.subjectName}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 font-mono text-[10px] font-bold rounded-md uppercase tracking-wider border border-amber-500/30">
                          Unassigned
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground font-mono text-[10px] font-bold rounded-md uppercase tracking-wider">
                        {isTeacherQuiz ? "Course Quiz" : "Practice Quiz"}
                      </span>
                      {isQuizOverdue(pq) && (
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 font-mono text-[10px] font-bold rounded-md uppercase tracking-wider border border-rose-500/30">
                          Deadline Passed
                        </span>
                      )}
                      {(pq.attemptsUsed ?? 0) > 0 && (
                        <span className="text-base font-bold text-primary ml-auto shrink-0 tabular-nums">
                          {pq.lastScoreRaw ?? 0}/{pq.lastMaxScore ?? 0}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-1">{pq.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {pq.questions?.length || 0} Questions · {pq.timeLimitMinutes || 15} min · Pass {pq.passPercentage || 70}% · {pq.difficulty || "medium"}
                      {pq.deadline && ` · Due ${new Date(pq.deadline).toLocaleString()}`}
                      {isTeacherQuiz && (
                        <span className={pqExhausted ? " text-rose-600 font-semibold" : ""}>
                          {" · "}
                          {pqAttemptsAllowed > 0
                            ? `${pq.attemptsUsed || 0}/${pqAttemptsAllowed} attempts`
                            : "Unlimited attempts"}                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewQuiz(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pq.description && cleanQuizDescription(pq.description) && (
                <div className="px-5">
                  <p className="text-xs text-muted-foreground leading-relaxed">{cleanQuizDescription(pq.description)}</p>
                </div>
              )}

              <div className="px-5 overflow-y-auto space-y-3 pr-3 flex-1">
                {pqCanManage && (
                  pq.questions && pq.questions.length > 0 ? (
                    pq.questions.map((q, idx) => (
                    <div key={q.id || idx} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground text-xs">Question {idx + 1}</span>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold rounded uppercase tracking-wider">
                          {questionTypeLabel(q)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{q.question}</p>
                      {q.type === "multiple_choice" && q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-start space-x-1.5 text-xs text-muted-foreground">
                              <span className="font-bold text-foreground">{String.fromCharCode(65 + oIdx)}.</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === "true_false" && (
                        <div className="text-xs text-muted-foreground flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-bold">True</span>
                          <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-bold">False</span>
                        </div>
                      )}
                      {q.topicTag && (
                        <div className="flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase tracking-wider">{q.topicTag}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center space-y-2">
                    <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                    <p className="text-sm font-semibold text-foreground">Questions hidden until you start</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      The questions and answer choices for this quiz are revealed only when you take it.
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-border p-5 pt-3 flex-wrap">
                <div className="flex items-center space-x-2 flex-wrap">
                  {(canManageCourseQuizzes) && pq.subjectId && pq.subjectId !== "personal" && (
                    <button
                      onClick={() => {
                        handleTogglePublish(pq);
                        setPreviewQuiz(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        pq.isPublished
                          ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      }`}
                      title={pq.isPublished ? "Unpublish Quiz" : "Publish Quiz"}
                    >
                      {pq.isPublished ? "Unpublish" : "Publish"}
                    </button>
                  )}

                  {(canManageCourseQuizzes) && isTeacherQuiz && (
                    <button
                      onClick={() => {
                        openAssignQuizSubject(pq);
                        setPreviewQuiz(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                        pq.subjectId
                          ? "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20"
                          : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                      }`}
                      title={pq.subjectId ? "Change the assigned subject" : "Assign this quiz to an assigned subject"}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{pq.subjectId ? "Change Subject" : "Assign Subject"}</span>
                    </button>
                  )}

                  {pqCanManage && (
                    <>
                      <button
                        onClick={() => {
                          handleOpenEditModal(pq);
                          setPreviewQuiz(null);
                        }}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                        title="Edit Quiz details & questions"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => {
                          setQuizToDelete(pq);
                          setPreviewQuiz(null);
                        }}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {pqExhausted ? (
                    <span className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold cursor-not-allowed">
                      Attempts exhausted
                    </span>
                  ) : pqSaved ? (
                    <>
                      <button
                        onClick={() => {
                          setPreviewQuiz(null);
                          handleStartQuiz(pq, false);
                        }}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        title="Start quiz from Question 1"
                      >
                        <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                        <span>Restart</span>
                      </button>
                      <button
                        onClick={() => {
                          setPreviewQuiz(null);
                          handleStartQuiz(pq, true);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume</span>
                      </button>
                    </>
                  ) : (pqAttemptsAllowed || 0) > 0 &&
                    (pq.attemptsUsed ?? 0) >= (pq.attemptsAllowed || 0) ? (
                    <span
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground"
                      title="Attempt limit reached for this quiz"
                    >
                      Attempts Exceeded
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setPreviewQuiz(null);
                        handleStartQuiz(pq, false);
                      }}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{(pq.attemptsUsed ?? 0) > 0 ? "Retake Quiz" : "Take Quiz"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ASSIGN SUBJECT MODAL */}
      {assignQuiz && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAssignQuiz(null);
          }}
        >
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Assign Subject</h3>
                  <p className="text-[11px] text-muted-foreground">Publish this quiz to students of the selected subject.</p>
                </div>
              </div>
              <button
                onClick={() => setAssignQuiz(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-0.5">
              <p className="text-xs font-bold text-foreground">{assignQuiz.title}</p>
              <p className="text-[11px] text-muted-foreground">{assignQuiz.questions?.length || 0} Questions</p>
            </div>

            {assignQuizMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold">
                {assignQuizMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Assigned Course Subject</label>
              <select
                value={assignQuizSubjectId}
                onChange={(e) => setAssignQuizSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select a subject —</option>
                {subjects
                  .filter((sub) => currentUser?.role !== "teacher" || sub.teacherId === currentUser.id)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} — {sub.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                The quiz is published to students of the selected subject.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                onClick={() => setAssignQuiz(null)}
                className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignQuizSubject}
                disabled={isAssigningQuizSubject}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isAssigningQuizSubject ? "Assigning..." : "Assign Subject"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {quizToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuizToDelete(null);
          }}
        >
          <div className="bg-card border border-border p-6 rounded-2xl max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirm Assessment Deletion</h3>
                <p className="text-xs text-muted-foreground">Are you sure you want to delete this learning material?</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-foreground space-y-1">
              <p className="font-bold">{quizToDelete.title}</p>
              <p className="text-[11px] text-muted-foreground">{quizToDelete.subjectName} • {quizToDelete.questions.length} Questions</p>
            </div>

            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
              Warning: Deleting this quiz will remove it from the course catalog and clear any active saved progress. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
              <button
                onClick={() => setQuizToDelete(null)}
                className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteQuiz}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Assessment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT QUIZ MODAL */}
      {editingQuiz && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingQuiz(null);
          }}
        >
          <div className="bg-card border border-border p-6 rounded-2xl max-w-5xl w-full shadow-xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Edit Quiz / Assessment</h3>
                  <p className="text-xs text-muted-foreground">Modify title, scope, subject association, and questions</p>
                </div>
              </div>
              <button
                onClick={() => setEditingQuiz(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5 lg:items-start space-y-4 lg:space-y-0 text-xs">
              {/* Settings column */}
              <div className="space-y-4 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
              {/* Row 1: Quiz Scope */}
              <div>
                <label className="block font-bold text-foreground mb-1">Quiz Scope</label>
                {editingQuiz.quizType === "student" ? (
                  <p className="p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                    Personal Practice Drill (Private to Yourself) — scope and subject cannot change.
                  </p>
                ) : (
                <select
                  value={editQuizType}
                  onChange={(e) => setEditQuizType(e.target.value as "teacher" | "student")}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="teacher">Course Subject Quiz (For Enrolled Class Students)</option>
                  <option value="student">Personal Practice Drill (Private to Yourself)</option>
                </select>
                )}
              </div>

              {/* Row 2: Title and (Conditional) Associated Course Subject */}
              <div className={`grid gap-3 ${editQuizType === "teacher" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <label className="block font-bold text-foreground mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {editQuizType === "teacher" && (
                  <div className="animate-in fade-in zoom-in-95">
                    <label className="block font-bold text-foreground mb-1">Associated Course Subject</label>
                    <select
                      value={editSubjectId}
                      onChange={(e) => setEditSubjectId(e.target.value)}
                      className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {subjects
                        .filter((sub) => currentUser?.role !== "teacher" || sub.teacherId === currentUser.id)
                        .map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} - {sub.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Description / Guidelines</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Time Limit (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    value={editTimeLimit}
                    onChange={(e) => setEditTimeLimit(Number(e.target.value))}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block font-bold text-foreground mb-1">Assessment Settings</label>
                  <p className="p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                    Passing score: {FIXED_PASS_PERCENTAGE}% · Difficulty: {FIXED_DIFFICULTY}
                  </p>
                </div>
              </div>

              {editQuizType === "teacher" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-limit-attempts"
                    checked={editLimitAttempts}
                    onChange={(e) => setEditLimitAttempts(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="edit-limit-attempts" className="font-bold text-foreground text-xs cursor-pointer">
                    Limit attempts per student
                  </label>
                </div>
                {editLimitAttempts && (
                  <div className="animate-in fade-in zoom-in-95">
                    <label className="block font-bold text-foreground mb-1">Max Attempts</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editAttempts}
                      onChange={(e) => setEditAttempts(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                      className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-reveal-answers"
                    checked={editRevealAnswers}
                    onChange={(e) => setEditRevealAnswers(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="edit-reveal-answers" className="font-bold text-foreground text-xs cursor-pointer">
                    Students can see correct answers after submitting
                  </label>
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    After this date students can no longer submit. Unattempted quizzes are marked Missing (0%) in grades.
                  </p>
                </div>
              </div>
              )}

              </div>

              {/* Questions List Editor */}
              <div className="space-y-3 pt-3 lg:pt-0 border-t border-border lg:border-t-0 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span>Quiz Questions List ({editQuestions.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newQ: QuizQuestion = {
                        id: `eq-${Date.now()}`,
                        question: "New Custom Quiz Question",
                        type: "multiple_choice",
                        options: ["Option A", "Option B", "Option C", "Option D"],
                        correctAnswer: 0,
                        explanation: "Explanation of the correct answer.",
                        bloomsLevel: "Understanding",
                        difficulty: "medium",
                        topicTag: "General Topic",
                      };
                      setEditQuestions([...editQuestions, newQ]);
                      setEditScrollTick((t) => t + 1);
                    }}
                    className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                <div ref={editQuestionListRef} className="space-y-3 max-h-60 lg:max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
                  {editQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="p-3 bg-muted/30 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground text-xs">Question {idx + 1}</span>
                        <div className="flex items-center space-x-2">
                          <select
                            value={q.type || "multiple_choice"}
                            onChange={(e) => {
                              const updated = [...editQuestions];
                              const newType = e.target.value as QuestionType;
                              updated[idx] = {
                                ...updated[idx],
                                type: newType,
                                options: newType === "multiple_choice" ? (updated[idx].options?.length ? updated[idx].options : ["Option A", "Option B", "Option C", "Option D"]) : newType === "true_false" ? ["True", "False"] : [],
                                correctAnswer:
                                  newType === "identification"
                                    ? (typeof updated[idx].correctAnswer === "string" ? updated[idx].correctAnswer : "")
                                    : 0,
                              };
                              setEditQuestions(updated);
                            }}
                            className="p-1 bg-card border border-border rounded text-[11px] font-semibold"
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="identification">Identification</option>
                            <option value="true_false">True / False</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setEditQuestions(editQuestions.filter((_, i) => i !== idx))}
                            className="text-rose-600 hover:text-rose-700 text-xs cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <input
                        ref={(el) => {
                          editPromptRefs.current[idx] = el;
                        }}
                        type="text"
                        value={q.question}
                        onChange={(e) => {
                          const updated = [...editQuestions];
                          updated[idx] = { ...updated[idx], question: e.target.value };
                          setEditQuestions(updated);
                        }}
                        placeholder="Enter question prompt..."
                        className="w-full text-xs font-bold text-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:outline-none pb-1"
                      />

                      {q.type === "identification" ? (
                        <div>
                          <label className="text-[10px] font-bold text-primary">Exact Identification Answer:</label>
                          <input
                            type="text"
                            value={String(q.correctAnswer || "")}
                            onChange={(e) => {
                              const updated = [...editQuestions];
                              updated[idx] = { ...updated[idx], correctAnswer: e.target.value };
                              setEditQuestions(updated);
                            }}
                            placeholder="Type exact key term..."
                            className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      ) : q.type === "true_false" ? (
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground">Correct Answer:</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {["True", "False"].map((tf, tfIdx) => {
                              const tfCorrect = Number(q.correctAnswer) === tfIdx;
                              return (
                                <button
                                  key={tf}
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editQuestions];
                                    updated[idx] = { ...updated[idx], correctAnswer: tfIdx };
                                    setEditQuestions(updated);
                                  }}
                                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                    tfCorrect
                                      ? CORRECT_ANSWER_CARD_CLASS
                                      : "bg-muted/40 border-border text-foreground hover:bg-muted"
                                  }`}
                                >
                                  <span>
                                    <span className="font-bold mr-2">{tfIdx === 0 ? "A." : "B."}</span>
                                    {tf}
                                  </span>
                                  {tfCorrect && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 text-[10px] font-bold text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(q.correctAnswer)}
                              onChange={(e) => {
                                const updated = [...editQuestions];
                                updated[idx] = {
                                  ...updated[idx],
                                  correctAnswer: e.target.checked ? [0] : 0,
                                };
                                setEditQuestions(updated);
                              }}
                              className="accent-primary"
                            />
                            <span>Multiple correct answers (select all that apply)</span>
                          </label>
                          <p className="text-[10px] text-muted-foreground">Click an option to set it as the correct answer. Click its text to edit it.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(q.options || ["Option 1", "Option 2", "Option 3", "Option 4"]).map((opt, optIdx) => {
                              const isMulti = Array.isArray(q.correctAnswer);
                              const isCorrect = isMulti
                                ? (q.correctAnswer as number[]).includes(optIdx)
                                : resolveMCIndex(q) === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    const updated = [...editQuestions];
                                    if (isMulti) {
                                      const cur = Array.isArray(updated[idx].correctAnswer)
                                        ? (updated[idx].correctAnswer as number[])
                                        : [];
                                      updated[idx] = {
                                        ...updated[idx],
                                        correctAnswer: cur.includes(optIdx)
                                          ? cur.filter((i) => i !== optIdx)
                                          : [...cur, optIdx],
                                      };
                                    } else {
                                      updated[idx] = { ...updated[idx], correctAnswer: optIdx };
                                    }
                                    setEditQuestions(updated);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}
                                  className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                                    isCorrect
                                      ? CORRECT_ANSWER_CARD_CLASS
                                      : "bg-muted/40 border-border text-foreground hover:bg-muted"
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full ${CORRECT_ANSWER_CHIP_CLASS} text-[10px] font-bold flex items-center justify-center shrink-0`}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const updated = [...editQuestions];
                                      const opts = [...(updated[idx].options || [])];
                                      opts[optIdx] = e.target.value;
                                      updated[idx] = { ...updated[idx], options: opts };
                                      setEditQuestions(updated);
                                    }}
                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                    className="flex-1 min-w-0 bg-transparent focus:outline-none text-foreground"
                                  />
                                  {isCorrect &&
                                    (isMulti ? (
                                      <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                    ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground">Explanation / Solution Notes</label>
                        <input
                          type="text"
                          value={String(q.explanation || "")}
                          onChange={(e) => {
                            const updated = [...editQuestions];
                            updated[idx] = { ...updated[idx], explanation: e.target.value };
                            setEditQuestions(updated);
                          }}
                          placeholder="Brief explanation for why this answer is correct..."
                          className="w-full p-1.5 bg-card border border-border rounded text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
              <button
                onClick={() => setEditingQuiz(null)}
                className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditQuiz}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE QUIZ MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className="bg-card border border-border p-6 rounded-2xl max-w-5xl w-full shadow-xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-xl ${
                  canManageCourseQuizzes
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                }`}>
                  {canManageCourseQuizzes ? (
                    <GraduationCap className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {canManageCourseQuizzes
                      ? "Create Course Quiz / Examination"
                      : "Create Student Practice Quiz"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {canManageCourseQuizzes
                      ? "Faculty Assessment Portal - Manual or Generated Questions"
                      : "Private self-study practice assessment"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5 lg:items-start space-y-4 lg:space-y-0 text-xs">
              {/* Settings column */}
              <div className="space-y-4 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
              {/* Row 1: Quiz Scope (staff only — students always create personal drills) */}
              {canManageCourseQuizzes ? (
                <div>
                  <label className="block font-bold text-foreground mb-1">Quiz Scope</label>
                  <select
                    value={newQuizType}
                    onChange={(e) => setNewQuizType(e.target.value as "teacher" | "student")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                  >
                    <option value="teacher">Course Subject Quiz (For Enrolled Class Students)</option>
                    <option value="student">Personal Practice Drill (Private to Yourself)</option>
                  </select>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-xl p-3">
                  This quiz will be saved as a <strong className="text-foreground">Personal Practice Drill</strong> that
                  only you can see and take.
                </p>
              )}

              {/* Row 2: Title and (Conditional) Associated Subject */}
              <div className={`grid gap-3 ${newQuizType === "teacher" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <label className="block font-bold text-foreground mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                    placeholder={
                      newQuizType === "teacher"
                        ? "e.g. Data Structures Midterm Examination"
                        : "e.g. Graph Algorithms Self-Test"
                    }
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {newQuizType === "teacher" && (
                  <div className="animate-in fade-in zoom-in-95">
                    <label className="block font-bold text-foreground mb-1">Associated Course Subject</label>
                    <select
                      value={newQuizSubjectId}
                      onChange={(e) => setNewQuizSubjectId(e.target.value)}
                      className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a subject (optional)</option>
                      {subjects
                        .filter((sub) => currentUser?.role !== "teacher" || sub.teacherId === currentUser.id)
                        .map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} - {sub.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Row 3: Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Time (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    value={newQuizTimeLimit}
                    onChange={(e) => setNewQuizTimeLimit(Number(e.target.value))}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Topic Tag</label>
                  <input
                    type="text"
                    value={newQuizTopic}
                    onChange={(e) => setNewQuizTopic(e.target.value)}
                    placeholder="e.g. Core Concepts"
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Row 3b: Attempt Limit */}
              {newQuizType === "teacher" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-limit-attempts"
                    checked={newQuizLimitAttempts}
                    onChange={(e) => setNewQuizLimitAttempts(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="create-limit-attempts" className="font-bold text-foreground text-xs cursor-pointer">
                    Limit attempts per student
                  </label>
                </div>
                {newQuizLimitAttempts && (
                  <div className="animate-in fade-in zoom-in-95">
                    <label className="block font-bold text-foreground mb-1">Max Attempts</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={newQuizAttempts}
                      onChange={(e) => setNewQuizAttempts(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                      className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-reveal-answers"
                    checked={newQuizRevealAnswers}
                    onChange={(e) => setNewQuizRevealAnswers(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="create-reveal-answers" className="font-bold text-foreground text-xs cursor-pointer">
                    Students can see correct answers after submitting
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-foreground mb-1">Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    value={newQuizDeadline}
                    onChange={(e) => setNewQuizDeadline(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    After this date students can no longer submit. Unattempted quizzes are marked Missing (0%) in grades.
                  </p>
                </div>
              </div>
              )}

              </div>

              {/* Manual Question Builder */}
              <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div>
                    <h4 className="font-bold text-foreground text-xs">Manual Question Builder</h4>
                    <p className="text-[11px] text-muted-foreground">{newQuizQuestions.length} Question(s) Added</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualQuestion}
                    className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">Question Prompt</label>
                      <input
                        type="text"
                        value={manualQText}
                        onChange={(e) => setManualQText(e.target.value)}
                        placeholder="e.g. What algorithm traverses a graph level by level?"
                        className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">Question Type</label>
                      <select
                        value={manualQType}
                        onChange={(e) => setManualQType(e.target.value as QuestionType)}
                        className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="identification">Identification / Direct Answer</option>
                        <option value="true_false">True / False</option>
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Options/Answers Input based on Question Type */}
                  {manualQType === "identification" ? (
                    <div className="p-3 bg-card border border-border rounded-xl space-y-1.5">
                      <label className="block text-[11px] font-bold text-primary">Exact Identification Answer / Key Term:</label>
                      <input
                        type="text"
                        value={manualQIdentAnswer}
                        onChange={(e) => setManualQIdentAnswer(e.target.value)}
                        placeholder="e.g. Breadth-First Search (case-insensitive grading)"
                        className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                      />
                      <p className="text-[10px] text-muted-foreground">Students will be asked to type this key term during assessment.</p>
                    </div>
                  ) : manualQType === "true_false" ? (
                    <div className="p-3 bg-card border border-border rounded-xl space-y-1.5">
                      <label className="block text-[11px] font-bold text-primary">Correct True/False Answer:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {["True", "False"].map((tf, tfIdx) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setManualQCorrect(tfIdx)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              manualQCorrect === tfIdx
                                ? CORRECT_ANSWER_CARD_CLASS
                                : "bg-muted/40 border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            <span>
                              <span className="font-bold mr-2">{tfIdx === 0 ? "A." : "B."}</span>
                              {tf}
                            </span>
                            {manualQCorrect === tfIdx && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 text-[11px] font-bold text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualQMulti}
                          onChange={(e) => {
                            setManualQMulti(e.target.checked);
                            setManualQMultiCorrect(e.target.checked ? [0] : []);
                          }}
                          className="accent-primary"
                        />
                        <span>Multiple correct answers (students select all that apply)</span>
                      </label>
                      <label className="block text-[11px] font-bold text-muted-foreground">Multiple Choice Options:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={manualQOpt0}
                          onChange={(e) => setManualQOpt0(e.target.value)}
                          placeholder="Option A"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={manualQOpt1}
                          onChange={(e) => setManualQOpt1(e.target.value)}
                          placeholder="Option B"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={manualQOpt2}
                          onChange={(e) => setManualQOpt2(e.target.value)}
                          placeholder="Option C"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={manualQOpt3}
                          onChange={(e) => setManualQOpt3(e.target.value)}
                          placeholder="Option D"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                      </div>
                      {manualQMulti ? (
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground">Correct Answers (select all):</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {[
                              { label: "Option A", value: manualQOpt0, idx: 0 },
                              { label: "Option B", value: manualQOpt1, idx: 1 },
                              { label: "Option C", value: manualQOpt2, idx: 2 },
                              { label: "Option D", value: manualQOpt3, idx: 3 },
                            ].map((opt) => {
                              const isCorrect = manualQMultiCorrect.includes(opt.idx);
                              return (
                                <div
                                  key={opt.idx}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    setManualQMultiCorrect((prev) =>
                                      prev.includes(opt.idx)
                                        ? prev.filter((i) => i !== opt.idx)
                                        : [...prev, opt.idx]
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}
                                  className={`flex items-center p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                    isCorrect
                                      ? CORRECT_ANSWER_CARD_CLASS
                                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full ${CORRECT_ANSWER_CHIP_CLASS} text-[10px] font-bold flex items-center justify-center shrink-0 mr-2`}>
                                    {String.fromCharCode(65 + opt.idx)}
                                  </span>
                                  <span className="truncate flex-1">{opt.value || opt.label}</span>
                                  {isCorrect && <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground">Correct Answer Option:</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {[
                              { label: "Option A", value: manualQOpt0, idx: 0 },
                              { label: "Option B", value: manualQOpt1, idx: 1 },
                              { label: "Option C", value: manualQOpt2, idx: 2 },
                              { label: "Option D", value: manualQOpt3, idx: 3 },
                            ].map((opt) => {
                              const isCorrect = manualQCorrect === opt.idx;
                              return (
                                <div
                                  key={opt.idx}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setManualQCorrect(opt.idx)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}
                                  className={`flex items-center p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                    isCorrect
                                      ? CORRECT_ANSWER_CARD_CLASS
                                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full ${CORRECT_ANSWER_CHIP_CLASS} text-[10px] font-bold flex items-center justify-center shrink-0 mr-2`}>
                                    {String.fromCharCode(65 + opt.idx)}
                                  </span>
                                  <span className="truncate flex-1">{opt.value || opt.label}</span>
                                  {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">Explanation / Solution Notes</label>
                    <input
                      type="text"
                      value={manualQExplanation}
                      onChange={(e) => setManualQExplanation(e.target.value)}
                      placeholder="Brief explanation for why this answer is correct..."
                      className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                {/* Added Questions List */}
                {newQuizQuestions.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <p className="text-[11px] font-bold text-foreground">Questions Included in Quiz:</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {newQuizQuestions.map((q, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-card border border-border rounded-xl text-xs">
                          <div className="flex items-center space-x-2 truncate pr-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">
                              {questionTypeLabel(q)}
                            </span>
                            <span className="truncate font-medium">{i + 1}. {q.question}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewQuizQuestions(newQuizQuestions.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePersonalQuiz}
                disabled={isCreatingQuiz || !newQuizTitle.trim()}
                className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                {isCreatingQuiz ? (
                  <span>Saving Quiz...</span>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create & Save Quiz</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
