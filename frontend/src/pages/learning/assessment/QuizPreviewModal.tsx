import { ArrowRight, BookOpen, CheckSquare, Pencil, Play, RotateCw, Trash2, X } from "lucide-react";
import type { Quiz, User } from "../../../types";
import {
  cleanQuizDescription,
  isQuizOverdue,
  questionTypeLabel,
  type SavedQuizProgress,
} from "./assessmentUtils";

interface QuizPreviewModalProps {
  previewQuiz: Quiz;
  canManageCourseQuizzes: boolean;
  currentUser: User | null;
  savedProgresses: Record<string, SavedQuizProgress>;
  onClose: () => void;
  onStartQuiz: (quiz: Quiz, resume?: boolean) => void;
  onTogglePublish: (quiz: Quiz) => void;
  onOpenAssignSubject: (quiz: Quiz) => void;
  onOpenEdit: (quiz: Quiz) => void;
  onRequestDelete: (quiz: Quiz) => void;
}

export function QuizPreviewModal({
  previewQuiz,
  canManageCourseQuizzes,
  currentUser,
  savedProgresses,
  onClose,
  onStartQuiz,
  onTogglePublish,
  onOpenAssignSubject,
  onOpenEdit,
  onRequestDelete,
}: QuizPreviewModalProps) {
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
        if (e.target === e.currentTarget) onClose();
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
            onClick={onClose}
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
                  onTogglePublish(pq);
                  onClose();
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
                  onOpenAssignSubject(pq);
                  onClose();
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
                    onOpenEdit(pq);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                  title="Edit Quiz details & questions"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => {
                    onRequestDelete(pq);
                    onClose();
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
                    onClose();
                    onStartQuiz(pq, false);
                  }}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  title="Start quiz from Question 1"
                >
                  <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                  <span>Restart</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onStartQuiz(pq, true);
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
                  onClose();
                  onStartQuiz(pq, false);
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
}
