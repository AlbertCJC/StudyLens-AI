import { Plus, X, Sparkles, CheckCircle2, User, GraduationCap } from "lucide-react";
import { useState, useCallback } from "react";
import { authFetch } from "../utils/authFetch";
import { useToast } from "../context/ToastContext";
import type { Quiz, QuizQuestion, Subject, DifficultyLevel, BloomsTaxonomy } from "../types";

const FIXED_PASS_PERCENTAGE = 75;
const FIXED_DIFFICULTY: DifficultyLevel = "medium";

const CORRECT_ANSWER_CARD_CLASS =
  "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-xs ring-1 ring-green-500";
const CORRECT_ANSWER_CHIP_CLASS = "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400";

const QUESTION_TYPES: { value: "multiple_choice" | "true_false" | "identification"; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "identification", label: "Identification" },
];

interface CreateDraft {
  localId: string;
  question: string;
  type: "multiple_choice" | "true_false" | "identification";
  options: string[];
  correctAnswer: string | number;
  explanation: string;
  bloomsLevel: BloomsTaxonomy;
  difficulty: DifficultyLevel;
  topicTag: string;
}

function validateCreateDraft(q: CreateDraft): string | null {
  if (!q.question.trim()) return "Question prompt is required.";

  if (q.type === "multiple_choice") {
    const options = q.options.map((o) => o.trim());
    if (options.length < 4 || options.some((o) => !o)) {
      return "Fill in all four answer options (A-D).";
    }
    if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim() || !options.includes(q.correctAnswer.trim())) {
      return "Select which option is the correct answer.";
    }
    return null;
  }

  if (q.type === "true_false") {
    return q.correctAnswer === "True" || q.correctAnswer === "False"
      ? null
      : "Select whether the correct answer is True or False.";
  }

  return q.correctAnswer.toString().trim() ? null : "Enter the exact answer for this identification question.";
}

const toLocalInputValue = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export interface QuizCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (saved: Quiz) => void;
  subjects: Subject[];
  currentUserId?: string;
  currentUserName?: string;
  canManageCourseQuizzes: boolean;
  defaultScope?: "teacher" | "student";
  lockSubject?: boolean;
  initialSubjectId?: string;
  initialSubjectName?: string;
  quizToEdit?: Quiz | null;
  onOpenAI?: () => void;
}

export function QuizCreateModal(props: QuizCreateModalProps) {
  const {
    open,
    onClose,
    onSaved,
    subjects,
    currentUserId,
    currentUserName,
    canManageCourseQuizzes,
    defaultScope,
    lockSubject = false,
    initialSubjectId,
    initialSubjectName,
    quizToEdit,
    onOpenAI,
  } = props;
  const { showToast } = useToast();

  const [scope, setScope] = useState<"teacher" | "student">(
    quizToEdit
      ? quizToEdit.quizType === "student"
        ? "student"
        : "teacher"
      : defaultScope ?? (canManageCourseQuizzes ? "teacher" : "student")
  );
  const [title, setTitle] = useState(quizToEdit?.title || "");
  const [subjectId, setSubjectId] = useState(
    quizToEdit
      ? quizToEdit.subjectId && quizToEdit.subjectId !== "personal"
        ? quizToEdit.subjectId
        : initialSubjectId || ""
      : initialSubjectId || ""
  );
  const [timeLimit, setTimeLimit] = useState(quizToEdit?.timeLimitMinutes || 15);
  const [topicTag, setTopicTag] = useState("");
  const [limitAttempts, setLimitAttempts] = useState((quizToEdit?.attemptsAllowed || 0) > 0);
  const [attempts, setAttempts] = useState(quizToEdit?.attemptsAllowed || 3);
  const [revealAnswers, setRevealAnswers] = useState(quizToEdit ? quizToEdit.revealAnswers !== false : true);
  const [deadline, setDeadline] = useState(toLocalInputValue(quizToEdit?.deadline));
  const [draftQuestions, setDraftQuestions] = useState<CreateDraft[]>(
    (quizToEdit?.questions || []).map((q, i) => {
      let correctAnswer = "";
      if (q.type === "true_false") {
        const tf = Array.isArray(q.correctAnswer) ? Number(q.correctAnswer[0]) : Number(q.correctAnswer);
        correctAnswer = tf === 1 ? "False" : tf === 0 ? "True" : "";
      } else if (q.type === "multiple_choice") {
        const options = q.options || [];
        const idx = Array.isArray(q.correctAnswer) ? Number(q.correctAnswer[0]) : Number(q.correctAnswer);
        correctAnswer = Number.isInteger(idx) && options[idx] !== undefined ? options[idx] : String(q.correctAnswer ?? "");
      } else {
        correctAnswer = String(q.correctAnswer ?? "");
      }
      return {
        localId: `q-${i}`,
        question: q.question,
        type: q.type as "multiple_choice" | "true_false" | "identification",
        options: q.type === "multiple_choice" ? [...(q.options || [])] : [],
        correctAnswer,
        explanation: q.explanation || "",
        bloomsLevel: q.bloomsLevel || "Understanding",
        difficulty: q.difficulty || "medium",
        topicTag: q.topicTag || "Core Concepts",
      };
    })
  );

  // Current single draft question being edited above the added-questions list.
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftType, setDraftType] = useState<CreateDraft["type"]>("multiple_choice");
  const [draftCorrect, setDraftCorrect] = useState<string | number>(""); // option text for MC/TF, exact text for ID
  const [draftExplanation, setDraftExplanation] = useState("");
  const [draftOpts, setDraftOpts] = useState<string[]>(["", "", "", ""]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const subjectLabel = selectedSubject
    ? `${selectedSubject.code} - ${selectedSubject.name}`
    : initialSubjectName || "";

  const isPractice = scope === "student";

  const addDraftQuestion = useCallback(() => {
    const draft: CreateDraft = {
      localId: `q-${Date.now()}`,
      question: draftQuestion.trim(),
      type: draftType,
      options: draftType === "multiple_choice" ? draftOpts.map((o) => o.trim()) : [],
      correctAnswer: draftCorrect,
      explanation: draftExplanation.trim(),
      bloomsLevel: "Understanding",
      difficulty: FIXED_DIFFICULTY,
      topicTag: topicTag || "Core Concepts",
    };

    const error = validateCreateDraft(draft);
    if (error) {
      setDraftError(error);
      showToast(error, "error");
      return;
    }

    setDraftQuestions((prev) => [...prev, draft]);
    setDraftQuestion("");
    setDraftCorrect("");
    setDraftExplanation("");
    setDraftOpts(["", "", "", ""]);
    setDraftError(null);
  }, [draftQuestion, draftType, draftCorrect, draftExplanation, draftOpts, topicTag]);

  const removeDraftQuestion = useCallback((localId: string) => {
    setDraftQuestions((prev) => prev.filter((q) => q.localId !== localId));
  }, []);

  const buildQuizQuestions = useCallback((): QuizQuestion[] =>
    draftQuestions.map((q) => ({
      id: q.localId,
      question: q.question,
      type: q.type,
      options:
        q.type === "multiple_choice" ? q.options.filter((o) => o.trim() !== "") : undefined,
      correctAnswer:
        q.type === "multiple_choice"
          ? q.options.findIndex((o) => o === q.correctAnswer)
          : q.type === "true_false"
            ? q.correctAnswer === "True"
              ? 0
              : 1
            : q.correctAnswer,
      explanation: q.explanation,
      bloomsLevel: q.bloomsLevel,
      difficulty: q.difficulty,
      topicTag: q.topicTag || "Core Concepts",
    })), [draftQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Quiz title is required.", "error");
      return;
    }
    if (!isPractice && !subjectId && !lockSubject) {
      showToast("Select an associated course subject.", "error");
      return;
    }
    if (draftQuestions.length === 0) {
      showToast("Add at least one question, or use the AI Quiz Generator instead.", "error");
      return;
    }
    for (let i = 0; i < draftQuestions.length; i++) {
      const error = validateCreateDraft(draftQuestions[i]);
      if (error) {
        showToast(`Question ${i + 1}: ${error}`, "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      const questions = buildQuizQuestions();
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: isPractice ? `Personal practice drill on ${title.trim()}` : `Course assessment on ${title.trim()}`,
        questions,
        timeLimitMinutes: timeLimit,
        passPercentage: FIXED_PASS_PERCENTAGE,
        difficulty: FIXED_DIFFICULTY,
        attemptsAllowed: limitAttempts ? attempts : 0,
        revealAnswers,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      };

      if (!isPractice) {
        payload.subjectId = subjectId;
        payload.subjectName = subjectLabel;
        payload.quizType = "teacher";
        payload.isPublished = true;
        payload.createdById = currentUserId || "usr-teacher-1";
        payload.createdByName = currentUserName || "Faculty Instructor";
      } else {
        payload.subjectId = "personal";
        payload.subjectName = "Personal Practice";
        payload.quizType = "student";
        payload.isPublished = true;
        payload.createdById = currentUserId || "";
        payload.createdByName = currentUserName || "Student User";
      }

      // Practice drills cannot move subjects or change scope on update.
      if (quizToEdit && quizToEdit.quizType === "student") {
        delete payload.subjectId;
        delete payload.subjectName;
        delete payload.quizType;
        delete payload.isPublished;
      }

      const res = quizToEdit
        ? await authFetch(`/api/quizzes/${quizToEdit.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await authFetch("/api/quizzes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(typeof body?.error === "string" ? body.error : "Could not save the quiz.", "error");
        return;
      }

      const saved = (await res.json()) as Quiz;
      onSaved(saved);
      showToast(quizToEdit ? "Quiz updated successfully." : "Quiz created successfully.");
      onClose();
    } catch (err) {
      console.error("Save quiz error:", err);
      showToast("Could not save the quiz. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-5xl w-full shadow-xl my-6 px-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pt-4 pb-6">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
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
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground truncate">
                {canManageCourseQuizzes
                  ? "Create Course Quiz / Examination"
                  : "Create Student Practice Quiz"}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {canManageCourseQuizzes
                  ? "Faculty Assessment Portal - Manual or Generated Questions"
                  : "Private self-study practice assessment"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {onOpenAI && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAI();
            }}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate with AI (opens AI Study Assistant)</span>
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Settings card */}
          <div className="space-y-4 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
            {/* Row 1: Quiz Scope (staff only - students always create personal drills) */}
            {canManageCourseQuizzes ? (
              <div className="transition-opacity duration-200">
                <div className="flex items-center gap-2 mb-1">
                  <label className="block font-bold text-foreground mb-0 text-xs">Quiz Scope</label>
                </div>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "teacher" | "student")}
                  className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="teacher">Course Subject Quiz (For Enrolled Class Students)</option>
                  <option value="student">Personal Practice Drill (Private to Yourself)</option>
                </select>
              </div>
            ) : (
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs text-muted-foreground">
                This quiz will be saved as a{" "}
                <strong className="text-foreground font-semibold">Personal Practice Drill</strong> that only you can see
                and take.
              </div>
            )}

            {/* Row 2: Title and (Conditional) Associated Subject */}
            <div className={`grid gap-3 ${scope === "teacher" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <label className="block font-bold text-foreground mb-1 text-xs">Quiz Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    scope === "teacher"
                      ? "e.g. Data Structures Midterm Examination"
                      : "e.g. Graph Algorithms Self-Test"
                  }
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {scope === "teacher" && (
                <div className="transition-opacity duration-200">
                  <label className="block font-bold text-foreground mb-1 text-xs">Associated Course Subject</label>
                  {lockSubject ? (
                    <p className="px-3 py-2 border border-border bg-muted/20 text-foreground rounded-xl font-semibold text-xs">
                      {subjectLabel || "This subject"}
                    </p>
                  ) : (
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a subject (optional)</option>
                      {subjects
                        .filter((sub) => !canManageCourseQuizzes || sub.teacherId === currentUserId || true)
                        .map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} - {sub.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Row 3: Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-foreground mb-1 text-xs">Time (Mins)</label>
                <input
                  type="number"
                  min={1}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1 text-xs">Topic Tag</label>
                <input
                  type="text"
                  value={topicTag}
                  onChange={(e) => setTopicTag(e.target.value)}
                  placeholder="e.g. Core Concepts"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Row 3b: Attempt Limit (teacher/course quizzes only) */}
            {scope === "teacher" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity duration-200">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id="create-limit-attempts"
                    checked={limitAttempts}
                    onChange={(e) => setLimitAttempts(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="create-limit-attempts" className="font-bold text-foreground text-xs cursor-pointer">
                    Limit attempts per student
                  </label>
                </div>
                {limitAttempts && (
                  <div className="transition-opacity duration-200">
                    <label className="block font-bold text-foreground mb-1 text-xs">Max Attempts</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={attempts}
                      onChange={(e) => setAttempts(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                      className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    id="create-reveal-answers"
                    checked={revealAnswers}
                    onChange={(e) => setRevealAnswers(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="create-reveal-answers" className="font-bold text-foreground text-xs cursor-pointer">
                    Students can see correct answers after submitting
                  </label>
                </div>
                <div className="sm:col-span-2 transition-opacity duration-200">
                  <label className="block font-bold text-foreground mb-1 text-xs">Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
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
          <div className="space-y-4 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h4 className="font-bold text-foreground text-xs">Manual Question Builder</h4>
                <p className="text-[11px] text-muted-foreground">{draftQuestions.length} Question(s) Added</p>
              </div>
              <button
                type="button"
                onClick={addDraftQuestion}
                className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {draftError && <p className="text-[11px] font-bold text-rose-600">{draftError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">Question Prompt</label>
                  <input
                    type="text"
                    value={draftQuestion}
                    onChange={(e) => setDraftQuestion(e.target.value)}
                    placeholder="Type the question..."
                    className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">Question Type</label>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as CreateDraft["type"])}
                    className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {draftType === "identification" ? (
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">Exact Answer</label>
                  <input
                    type="text"
                    value={String(draftCorrect || "")}
                    onChange={(e) => setDraftCorrect(e.target.value)}
                    placeholder="Type the exact answer students must enter"
                    className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                  />
                </div>
              ) : draftType === "true_false" ? (
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">Correct Answer</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {[0, 1].map((tfIdx) => (
                      <div
                        key={tfIdx}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setDraftCorrect(tfIdx === 0 ? "True" : "False");
                          setDraftError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}
                        className={`flex items-center p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          draftCorrect === (tfIdx === 0 ? "True" : "False")
                            ? CORRECT_ANSWER_CARD_CLASS
                            : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full ${CORRECT_ANSWER_CHIP_CLASS} text-[10px] font-bold flex items-center justify-center shrink-0 mr-2`}>
                          {tfIdx === 0 ? "True" : "False"}
                        </span>
                        <span className="truncate flex-1">{tfIdx === 0 ? "True" : "False"}</span>
                        {draftCorrect === (tfIdx === 0 ? "True" : "False") && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground">Correct Answer Option:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDraftCorrect(i);
                            setDraftError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}
                          className={`flex items-center p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${draftCorrect === i ? CORRECT_ANSWER_CARD_CLASS : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"}`}
                        >
                          <span className={`w-5 h-5 rounded-full ${CORRECT_ANSWER_CHIP_CLASS} text-[10px] font-bold flex items-center justify-center shrink-0 mr-2`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="truncate flex-1">Option {String.fromCharCode(65 + i)}</span>
                          {draftCorrect === i && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">Option Inputs</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { label: "Option A", value: draftOpts[0], idx: 0 },
                        { label: "Option B", value: draftOpts[1], idx: 1 },
                        { label: "Option C", value: draftOpts[2], idx: 2 },
                        { label: "Option D", value: draftOpts[3], idx: 3 },
                      ].map((opt) => (
                        <div key={opt.idx}>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-1">
                            {opt.label}
                          </label>
                          <input
                            type="text"
                            value={opt.value}
                            onChange={(e) => {
                              const updated = [...draftOpts];
                              updated[opt.idx] = e.target.value;
                              setDraftOpts(updated);
                              setDraftError(null);
                            }}
                            placeholder={`Enter ${opt.label.toLowerCase()}`}
                            className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">Explanation / Solution Notes</label>
                <input
                  type="text"
                  value={draftExplanation}
                  onChange={(e) => setDraftExplanation(e.target.value)}
                  placeholder="Brief explanation for why this answer is correct..."
                  className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Added Questions List */}
            {draftQuestions.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                <p className="text-[11px] font-bold text-foreground">Questions Included in Quiz:</p>
                <div className="space-y-1.5 overflow-y-auto pr-1">
                  {draftQuestions.map((q, i) => (
                    <div key={q.localId} className="flex items-center justify-between p-2.5 bg-card border border-border rounded-xl text-xs">
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">
                          {q.type.replace("_", " ").toUpperCase()}
                        </span>
                        <span className="truncate font-medium">{i + 1}. {q.question}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDraftQuestion(q.localId)}
                        className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 pb-8 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center space-x-1.5"
            >
              {submitting ? (
                <span>Saving Quiz...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{quizToEdit ? "Save Changes" : "Create & Save Quiz"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
