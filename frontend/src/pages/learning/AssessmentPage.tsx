import React, { useState, useEffect, useCallback } from "react";
import {
  CheckSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trash2,
  Trophy,
  RotateCcw,
  Play,
  RotateCw,
  Plus,
  UserCheck,
  User,
  GraduationCap,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ConfettiEffect } from "../../components/ConfettiEffect";
import { authFetch } from "../../utils/authFetch";
import type { Quiz, QuizQuestion, QuizAttempt, Subject } from "../../types";

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
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Filter Tab & Subject State
  const [activeQuizTab, setActiveQuizTab] = useState<"all" | "teacher" | "student">("all");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");

  // Create Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizSubjectId, setNewQuizSubjectId] = useState("");
  const [newQuizTopic, setNewQuizTopic] = useState("");
  const [newQuizType, setNewQuizType] = useState<"teacher" | "student">("teacher");
  const [newQuizTimeLimit, setNewQuizTimeLimit] = useState<number>(15);
  const [newQuizPassPercentage, setNewQuizPassPercentage] = useState<number>(70);
  const [newQuizDifficulty, setNewQuizDifficulty] = useState<"easy" | "medium" | "hard">("medium");
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
  const [manualQIdentAnswer, setManualQIdentAnswer] = useState("");
  const [manualQExplanation, setManualQExplanation] = useState("");

  // Quiz Deletion Modal
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  // Edit Quiz Modal
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editQuizType, setEditQuizType] = useState<"teacher" | "student">("teacher");
  const [editTimeLimit, setEditTimeLimit] = useState<number>(15);
  const [editPassPercentage, setEditPassPercentage] = useState<number>(70);
  const [editDifficulty, setEditDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Quizzes and Subjects
  useEffect(() => {
    let isSubscribed = true;
    const fetchCatalogData = async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          authFetch(`/api/quizzes?studentId=${currentUser?.id || ""}`),
          authFetch("/api/subjects"),
        ]);
        if (qRes.ok && isSubscribed) {
          const qData = await qRes.json();
          setQuizzes(qData);
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
  }, [currentUser?.id]);

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
      setShowConfetti(true);
    } catch (err) {
      console.error("Submit quiz error:", err);
      setSubmitError(`Could not submit your assessment. ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeQuiz, currentUser, userAnswers]);

  // CONTINUOUS REAL-TIME TIMER EFFECT
  // The timer calculates remaining seconds against targetEndTime (absolute timestamp).
  // It continues ticking continuously and cannot be paused or stopped.
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
        alert("The time limit for this quiz has expired while away! Automatically calculating your score now...");
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
    setShowConfetti(false);
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
        difficulty: newQuizDifficulty,
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
        difficulty: newQuizDifficulty,
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
        correctAnswer: manualQCorrect,
        explanation: manualQExplanation.trim() || "Standard answer explanation.",
        bloomsLevel: "Understanding",
        difficulty: newQuizDifficulty,
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
  };

  const handleCreatePersonalQuiz = async () => {
    if (!newQuizTitle.trim()) return;
    setIsCreatingQuiz(true);
    try {
      const selectedSubject = subjects.find((s) => s.id === newQuizSubjectId) || subjects[0];
      const isTeacher = currentUser?.role === "teacher" || currentUser?.role === "admin";
      
      const shuffleMcOptions = (q: QuizQuestion): QuizQuestion => {
        if (q.type !== "multiple_choice" || !q.options || q.options.length < 2) return q;
        const correctIndex = Number(q.correctAnswer) || 0;
        const correctText = q.options[correctIndex];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
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
          difficulty: newQuizDifficulty,
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
          difficulty: newQuizDifficulty,
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
          difficulty: newQuizDifficulty,
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
          subjectId: selectedSubject ? selectedSubject.id : "sub-101",
          questions: finalQuestions,
          createdById: currentUser?.id || (isTeacher ? "usr-teacher-1" : "usr-student-1"),
          createdByName: currentUser?.name || (isTeacher ? "Faculty Instructor" : "Student User"),
          quizType: newQuizType,
          uploaderRole: currentUser?.role || "student",
          isPublished: true,
          timeLimitMinutes: newQuizTimeLimit,
          passPercentage: newQuizPassPercentage,
          difficulty: newQuizDifficulty,
        }),
      });

      if (quizRes.ok) {
        const created = await quizRes.json();
        setQuizzes((prev) => [created, ...prev]);
        setShowCreateModal(false);
        setNewQuizTitle("");
        setNewQuizTopic("");
        setNewQuizQuestions([]);
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
    setEditSubjectId(quiz.subjectId || (subjects[0] ? subjects[0].id : "sub-101"));
    setEditQuizType(quiz.quizType || "teacher");
    setEditTimeLimit(quiz.timeLimitMinutes || 15);
    setEditPassPercentage(quiz.passPercentage || 70);
    setEditDifficulty(quiz.difficulty || "medium");
    setEditQuestions(quiz.questions || []);
  };

  const handleSaveEditQuiz = async () => {
    if (!editingQuiz) return;
    try {
      const selectedSubject = subjects.find((s) => s.id === editSubjectId);
      const res = await authFetch(`/api/quizzes/${editingQuiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          subjectId: editSubjectId,
          subjectName: selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : editingQuiz.subjectName,
          quizType: editQuizType,
          timeLimitMinutes: editTimeLimit,
          passPercentage: editPassPercentage,
          difficulty: editDifficulty,
          questions: editQuestions,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setQuizzes((prev) => prev.map((q) => (q.id === editingQuiz.id ? updated : q)));
        setEditingQuiz(null);
      }
    } catch (err) {
      console.error("Save edit quiz error:", err);
    }
  };

  const handleTogglePublish = async (quizId: string, currentPub: boolean) => {
    try {
      const res = await authFetch(`/api/quizzes/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !currentPub }),
      });
      if (res.ok) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quizId ? { ...q, isPublished: !currentPub } : q))
        );
      }
    } catch (err) {
      console.error("Toggle publish error:", err);
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

  // Filter Quizzes according to Privacy Rule, Tab selection, and Subject selection
  const visibleQuizzes = quizzes.filter((q) => {
    const type = q.quizType || (q.createdById?.startsWith("usr-teacher") ? "teacher" : "student");
    if (activeQuizTab === "teacher" && type !== "teacher") return false;
    if (activeQuizTab === "student" && (type !== "student" || q.createdById !== currentUser?.id)) return false;
    if (selectedSubjectFilter !== "all" && q.subjectId !== selectedSubjectFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <ConfettiEffect trigger={showConfetti} />

      {/* 1. ACTIVE QUIZ TAKING INTERFACE */}
      {activeQuiz && !completedAttempt && (() => {
        const isTeacherQuiz = (activeQuiz.quizType || (activeQuiz.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";

        return (
          <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden space-y-0">
            {/* Top Header Bar */}
            <div className="bg-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    {activeQuiz.subjectName}
                  </span>
                  {isTeacherQuiz ? (
                    <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold text-[10px] rounded-md flex items-center space-x-1">
                      <UserCheck className="w-3 h-3 text-blue-400" />
                      <span>Official Professor Exam</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-400/30 font-bold text-[10px] rounded-md flex items-center space-x-1">
                      <User className="w-3 h-3 text-purple-400" />
                      <span>Student Practice Drill</span>
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold mt-1">{activeQuiz.title}</h2>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-amber-500/10 text-amber-400 rounded-xl font-mono text-base font-black border border-amber-500/30 shadow-inner">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
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
                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-md font-bold text-[11px]">
                      Bloom's Level: {activeQuiz.questions[currentQIndex].bloomsLevel}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground">
                    {activeQuiz.questions[currentQIndex].question}
                  </h3>

                  {/* Question Options */}
                  {activeQuiz.questions[currentQIndex].options &&
                  activeQuiz.questions[currentQIndex].options!.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {activeQuiz.questions[currentQIndex].options!.map((opt, oIdx) => {
                        const isSelected =
                          userAnswers[activeQuiz.questions[currentQIndex].id] === oIdx;
                        return (
                          <button
                            key={oIdx}
                            onClick={() =>
                              handleSelectAnswer(activeQuiz.questions[currentQIndex].id, oIdx)
                            }
                            className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary"
                                : "bg-muted/40 border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            <span>
                              <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                              {opt}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
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

                  {/* AI Hint Section - DISABLED FOR PROFESSOR EXAMS */}
                  <div className="pt-2">
                    {isTeacherQuiz ? (
                      <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground flex items-center space-x-2">
                        <XCircle className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">
                          Hints & AI suggestions are disabled for Official Professor Examinations.
                        </span>
                      </div>
                    ) : hint ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
                        <span className="font-bold flex items-center space-x-1 text-amber-600 dark:text-amber-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI Socratic Hint</span>
                        </span>
                        <p className="leading-relaxed">{hint}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleFetchHint(activeQuiz.questions[currentQIndex])}
                        disabled={loadingHint}
                        className="px-3 py-1.5 bg-muted hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{loadingHint ? "Asking Gemini..." : "Need Socratic Hint?"}</span>
                      </button>
                    )}
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
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2 border border-border text-foreground rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>

                {currentQIndex < activeQuiz.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQIndex((prev) => prev + 1)}
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
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xl space-y-6">
          <div className="text-center space-y-2 border-b border-border pb-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase">
              <Trophy className="w-3.5 h-3.5" />
              <span>Assessment Completed!</span>
            </span>
            <h2 className="text-2xl font-black text-foreground">
              Your Score: {completedAttempt.score} / {completedAttempt.totalPoints} (
              {completedAttempt.percentage}%)
            </h2>
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
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Explanation:</strong> {fb.explanation}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setActiveQuiz(null);
                setCompletedAttempt(null);
                setSubmitError(null);
              }}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer"
            >
              Back to Assessments Catalog
            </button>
          </div>
        </div>
      )}

      {/* 3. CATALOG OF QUIZZES & ASSESSMENT TYPES */}
      {!activeQuiz && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 border border-blue-200/80 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-900 dark:border-blue-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200/80 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/20 text-xs font-semibold">
                <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
                <span>Blooms Taxonomy Assessment Portal</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assessments & Quizzes Catalog</h1>
              <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xl leading-relaxed">
                Choose between Official Teacher Subject Quizzes and Personal Student Practice Drills.
              </p>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Practice Quiz</span>
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
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-black">
                  <RotateCcw className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded uppercase tracking-wider">
                      Unfinished Quiz Saved
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded border border-amber-500/30 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>Active Practice Session</span>
                    </span>
                  </div>
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
              <button
                onClick={() => setActiveQuizTab("all")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeQuizTab === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                All Quizzes ({quizzes.length})
              </button>

              <button
                onClick={() => setActiveQuizTab("teacher")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeQuizTab === "teacher"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Teacher Subject Quizzes ({quizzes.filter(q => (q.quizType || "teacher") === "teacher").length})</span>
              </button>

              <button
                onClick={() => setActiveQuizTab("student")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeQuizTab === "student"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>My Personal Practice Quizzes ({quizzes.filter(q => q.quizType === "student" && q.createdById === currentUser?.id).length})</span>
              </button>

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

            <p className="text-xs text-muted-foreground hidden lg:block">
              {currentUser?.role === "teacher" || currentUser?.role === "admin"
                ? "* Faculty instructors can create, view, edit, publish, and delete course quizzes."
                : "* Student-created practice drills are recorded for your personal self-study."}
            </p>
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
              visibleQuizzes.map((quiz) => {
                const saved = savedProgresses[quiz.id];
                const isTeacherQuiz = (quiz.quizType || (quiz.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";
                const canManage = currentUser?.role === "teacher" || currentUser?.role === "admin" || quiz.createdById === currentUser?.id;

                return (
                  <div
                    key={quiz.id}
                    className={`bg-card p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                      saved
                        ? "border-amber-500/50 shadow-md ring-1 ring-amber-500/20"
                        : "border-border shadow-xs hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 bg-primary/10 text-primary font-mono text-[11px] font-bold rounded-lg uppercase truncate max-w-[200px]">
                          {quiz.subjectName}
                        </span>

                        {saved ? (
                          <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold text-[11px] rounded-full flex items-center space-x-1 shrink-0">
                            <RotateCcw className="w-3 h-3 text-amber-500 animate-pulse" />
                            <span>Q{saved.currentQIndex + 1}/{quiz.questions.length} Saved</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground flex items-center space-x-1 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{quiz.timeLimitMinutes || 15} mins</span>
                          </span>
                        )}
                      </div>

                      {/* Quiz Title & Type Badge */}
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                          {isTeacherQuiz ? (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-[10px] rounded-md border border-blue-500/20">
                              Teacher Subject Quiz
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold text-[10px] rounded-md border border-purple-500/20">
                              Student Practice Drill
                            </span>
                          )}

                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            quiz.isPublished ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600"
                          }`}>
                            {quiz.isPublished ? "Published" : "Draft/Unpublished"}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-foreground leading-snug">{quiz.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{quiz.description}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{quiz.questions?.length || 0} Questions</span>
                        <span className="font-medium text-foreground">
                          by {quiz.createdByName || (isTeacherQuiz ? "Faculty Teacher" : "Self-Study")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        {canManage && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleTogglePublish(quiz.id, quiz.isPublished)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                quiz.isPublished
                                  ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              }`}
                              title={quiz.isPublished ? "Unpublish Quiz" : "Publish Quiz"}
                            >
                              {quiz.isPublished ? "Unpublish" : "Publish"}
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(quiz)}
                              className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                              title="Edit Quiz details & questions"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setQuizToDelete(quiz)}
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
                              onClick={() => handleStartQuiz(quiz, false)}
                              className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              title="Start quiz from Question 1"
                            >
                              <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                              <span>Restart</span>
                            </button>
                            <button
                              onClick={() => handleStartQuiz(quiz, true)}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Resume</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartQuiz(quiz, false)}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 ml-auto cursor-pointer"
                          >
                            <span>Take Quiz</span>
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
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {quizToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-2xl w-full shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-4 text-xs">
              {/* Row 1: Quiz Scope */}
              <div>
                <label className="block font-bold text-foreground mb-1">Quiz Scope</label>
                <select
                  value={editQuizType}
                  onChange={(e) => setEditQuizType(e.target.value as "teacher" | "student")}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="teacher">Course Subject Quiz (For Enrolled Class Students)</option>
                  <option value="student">Personal Practice Drill (Private to Yourself)</option>
                </select>
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
                      {subjects.map((sub) => (
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

              <div className="grid grid-cols-3 gap-3">
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

                <div>
                  <label className="block font-bold text-foreground mb-1">Pass Score (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={editPassPercentage}
                    onChange={(e) => setEditPassPercentage(Number(e.target.value))}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Difficulty Level</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value as "easy" | "medium" | "hard")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Questions List Editor */}
              <div className="space-y-3 pt-3 border-t border-border">
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
                    }}
                    className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
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
                                correctAnswer: newType === "identification" ? String(updated[idx].correctAnswer || "") : 0,
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
                        type="text"
                        value={q.question}
                        onChange={(e) => {
                          const updated = [...editQuestions];
                          updated[idx] = { ...updated[idx], question: e.target.value };
                          setEditQuestions(updated);
                        }}
                        placeholder="Enter question prompt..."
                        className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none"
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
                            className="w-full p-1.5 bg-card border border-border rounded text-[11px] font-semibold"
                          />
                        </div>
                      ) : q.type === "true_false" ? (
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground">Correct Option:</label>
                          <select
                            value={Number(q.correctAnswer) || 0}
                            onChange={(e) => {
                              const updated = [...editQuestions];
                              updated[idx] = { ...updated[idx], correctAnswer: Number(e.target.value) };
                              setEditQuestions(updated);
                            }}
                            className="w-full p-1.5 bg-card border border-border rounded text-[11px]"
                          >
                            <option value={0}>True</option>
                            <option value={1}>False</option>
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {(q.options || ["Option 1", "Option 2", "Option 3", "Option 4"]).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center space-x-1.5">
                              <input
                                type="radio"
                                name={`correct-${idx}`}
                                checked={Number(q.correctAnswer) === optIdx}
                                onChange={() => {
                                  const updated = [...editQuestions];
                                  updated[idx] = { ...updated[idx], correctAnswer: optIdx };
                                  setEditQuestions(updated);
                                }}
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...editQuestions];
                                  const opts = [...(updated[idx].options || [])];
                                  opts[optIdx] = e.target.value;
                                  updated[idx] = { ...updated[idx], options: opts };
                                  setEditQuestions(updated);
                                }}
                                className="w-full p-1.5 bg-card border border-border rounded text-[11px]"
                              />
                            </div>
                          ))}
                        </div>
                      )}
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-xl ${
                  currentUser?.role === "teacher" || currentUser?.role === "admin"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                }`}>
                  {currentUser?.role === "teacher" || currentUser?.role === "admin" ? (
                    <GraduationCap className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {currentUser?.role === "teacher" || currentUser?.role === "admin"
                      ? "Create Course Quiz / Examination"
                      : "Create Student Practice Quiz"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {currentUser?.role === "teacher" || currentUser?.role === "admin"
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

            <div className="space-y-4 text-xs">
              {/* Row 1: Quiz Scope */}
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
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} - {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Row 3: Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <label className="block font-bold text-foreground mb-1">Pass Score (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={newQuizPassPercentage}
                    onChange={(e) => setNewQuizPassPercentage(Number(e.target.value))}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Difficulty</label>
                  <select
                    value={newQuizDifficulty}
                    onChange={(e) => setNewQuizDifficulty(e.target.value as "easy" | "medium" | "hard")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
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

              {/* Manual Question Builder */}
              <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3">
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
                      <select
                        value={manualQCorrect}
                        onChange={(e) => setManualQCorrect(Number(e.target.value))}
                        className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none"
                      >
                        <option value={0}>True</option>
                        <option value={1}>False</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-muted-foreground">Multiple Choice Options:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={manualQOpt0}
                          onChange={(e) => setManualQOpt0(e.target.value)}
                          placeholder="Option A (Index 0)"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={manualQOpt1}
                          onChange={(e) => setManualQOpt1(e.target.value)}
                          placeholder="Option B (Index 1)"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={manualQOpt2}
                          onChange={(e) => setManualQOpt2(e.target.value)}
                          placeholder="Option C (Index 2)"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={manualQOpt3}
                          onChange={(e) => setManualQOpt3(e.target.value)}
                          placeholder="Option D (Index 3)"
                          className="p-2 bg-card border border-border rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground">Correct Answer Option:</label>
                        <select
                          value={manualQCorrect}
                          onChange={(e) => setManualQCorrect(Number(e.target.value))}
                          className="w-full p-2 bg-card border border-border rounded-xl text-xs mt-1"
                        >
                          <option value={0}>Option A ({manualQOpt0 || "Option A"})</option>
                          <option value={1}>Option B ({manualQOpt1 || "Option B"})</option>
                          <option value={2}>Option C ({manualQOpt2 || "Option C"})</option>
                          <option value={3}>Option D ({manualQOpt3 || "Option D"})</option>
                        </select>
                      </div>
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
                              {q.type === "identification" ? "Identification" : q.type === "true_false" ? "True/False" : "MC"}
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
