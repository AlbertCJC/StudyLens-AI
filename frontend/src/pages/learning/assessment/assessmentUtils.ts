import type { Quiz, QuizQuestion, QuizFeedbackItem, QuestionType } from "../../../types";

const AI_DEFAULT_QUIZ_DESCRIPTION = "Automated Bloom's Taxonomy Quiz generated via Groq Inference (GPT-OSS-120B).";

// Editor styling used to mark the correct answer as the selected option card.
export const CORRECT_ANSWER_CARD_CLASS =
  "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-xs ring-1 ring-green-500";
export const CORRECT_ANSWER_CHIP_CLASS = "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400";

// Fixed assessment parameters (not editable by users).
export const FIXED_PASS_PERCENTAGE = 75;
export const FIXED_DIFFICULTY = "medium";

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

// ISO timestamp -> value usable by <input type="datetime-local"> in local time.
export function toLocalInputValue(iso?: string | null): string {
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

export function feedbackCorrectText(fb: QuizFeedbackItem): string | null {
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

export function feedbackUserAnswerText(fb: QuizFeedbackItem, question?: QuizQuestion): string {
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

export function cleanQuizDescription(desc: string): string {
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
export function questionTypeLabel(q: Pick<QuizQuestion, "type" | "correctAnswer" | "options">): string {
  const type = canonicalQuestionType(q);
  if (type === "true_false") return "True / False";
  if (type === "multiple_choice") return Array.isArray(q.correctAnswer) ? "Multiple Select" : "Multiple Choice";
  return "Identification";
}

// Resolves a single stored answer value (integer, digit-string, letter "A"-"D", or
// exact option text) into a valid option index, or -1 when it cannot be matched.
export function resolveOptionIndex(value: string | number, options: (string | number)[]): number {
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

// Resolves every true/false encoding used by legacy rows, AI output, and the
// manual editor: booleans, 0/1, "A"/"B", and true/false words.
export function resolveTrueFalseIndex(value: unknown): number {
  if (typeof value === "boolean") return value ? 0 : 1;
  if (typeof value === "number") {
    if (value === 0) return 0;
    if (value === 1) return 1;
    return -1;
  }
  if (Array.isArray(value)) return value.length > 0 ? resolveTrueFalseIndex(value[0]) : -1;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["0", "true", "t", "yes", "a", "correct"].includes(text)) return 0;
    if (["1", "false", "f", "no", "b", "incorrect"].includes(text)) return 1;
  }
  return -1;
}

// Returns the option index currently marked correct for a multiple-choice question,
// or -1 when the question is multi-answer / has no selectable answer.
export function resolveMCIndex(q: QuizQuestion): number {
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
export function normalizeQuestionForEdit(q: QuizQuestion): QuizQuestion {
  const type = canonicalQuestionType(q);
  const base = { ...q, type };
  if (type === "multiple_choice") {
    const source = Array.isArray(base.options) && base.options.length > 0 ? base.options : ["Option A", "Option B"];
    const options = source.map((o) => String(o));
    while (options.length < 4) options.push("");
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
    const idx = resolveTrueFalseIndex(base.correctAnswer);
    return { ...base, correctAnswer: idx >= 0 ? idx : 0, options: ["True", "False"] };
  }
  if (type === "identification") {
    return { ...base, options: [], correctAnswer: typeof base.correctAnswer === "string" ? base.correctAnswer : String(base.correctAnswer ?? "") };
  }
  return base;
}

// Returns a human-readable reason why a question is not ready to be saved, or
// null when it is complete. Manual entry passes requireAllOptions so every
// visible multiple-choice field must be filled, while legacy quizzes may keep
// the number of options they were originally stored with.
export function validateQuizQuestion(
  q: QuizQuestion,
  opts: { requireAllOptions?: boolean } = {}
): string | null {
  if (!q.question || !q.question.trim()) return "Question prompt is required.";
  const type = canonicalQuestionType(q);
  if (type === "identification") {
    if (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim()) {
      return "Enter the exact answer for this identification question.";
    }
    return null;
  }
  if (type === "true_false") {
    if (resolveTrueFalseIndex(q.correctAnswer) < 0) {
      return "Select whether the correct answer is True or False.";
    }
    return null;
  }

  const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
  const minOptions = opts.requireAllOptions ? 4 : 2;
  if (options.length < minOptions) {
    return opts.requireAllOptions
      ? "Fill in all four answer options (A–D)."
      : "Provide at least two answer options.";
  }
  if (options.some((o) => !o)) return "Answer options cannot be left blank.";

  if (Array.isArray(q.correctAnswer)) {
    if (q.correctAnswer.length === 0) return "Select at least one correct answer.";
    const invalid = q.correctAnswer.some((value) => {
      const idx = Number(value);
      return !Number.isInteger(idx) || idx < 0 || idx >= options.length;
    });
    return invalid ? "Select a valid correct answer." : null;
  }

  return resolveOptionIndex(q.correctAnswer as string | number, options) >= 0
    ? null
    : "Select which option is the correct answer.";
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}
