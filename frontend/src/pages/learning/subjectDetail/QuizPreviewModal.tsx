import { GraduationCap, Pencil, Trash2, X } from "lucide-react";
import type { Quiz } from "../../../types";

interface QuizPreviewModalProps {
  open: boolean;
  onClose: () => void;
  quiz: Quiz;
  isStaff: boolean;
  canManage: boolean;
  onTogglePublish: (quiz: Quiz) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quiz: Quiz) => void;
  onTakeQuiz: (quizId: string) => void;
}

export function QuizPreviewModal({
  open,
  onClose,
  quiz,
  isStaff,
  canManage,
  onTogglePublish,
  onEditQuiz,
  onDeleteQuiz,
  onTakeQuiz,
}: QuizPreviewModalProps) {
  if (!open) return null;

  const pq = quiz;
  const pqIsCourseQuiz =
    (pq.quizType || (pq.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";
  const pqExhausted =
    pqIsCourseQuiz && (pq.attemptsAllowed || 0) > 0 && (pq.attemptsUsed || 0) >= (pq.attemptsAllowed || 0);
  // eslint-disable-next-line react-hooks/purity
  const pqOverdue = !!pq.deadline && new Date(pq.deadline).getTime() < Date.now();

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
              <GraduationCap className="w-5 h-5" />
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
                  {pqIsCourseQuiz ? "Course Quiz" : "Practice Quiz"}
                </span>
                {pqOverdue && (
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
                {pq.questions?.length || 0} Questions Â· {pq.timeLimitMinutes || 15} min Â· Pass {pq.passPercentage || 70}% Â· {pq.difficulty || "medium"}
                {pq.deadline && ` Â· Due ${new Date(pq.deadline).toLocaleString()}`}
                {pqIsCourseQuiz && (
                  <span className={pqExhausted ? " text-rose-600 font-semibold" : ""}>
                    {" Â· "}
                    {(pq.attemptsAllowed || 0) > 0
                      ? `${pq.attemptsUsed || 0}/${pq.attemptsAllowed} attempts`
                      : "Unlimited attempts"}
                  </span>
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

        {pq.description && (
          <div className="px-5">
            <p className="text-xs text-muted-foreground leading-relaxed">{pq.description}</p>
          </div>
        )}

        <div className="px-5 overflow-y-auto space-y-3 pr-3 flex-1">
          {isStaff ? (
            pq.questions && pq.questions.length > 0 ? (
              pq.questions.map((q, idx) => (
                <div key={q.id || idx} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground text-xs">Question {idx + 1}</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold rounded uppercase tracking-wider">
                      {q.type === "multiple_choice"
                        ? Array.isArray(q.correctAnswer)
                          ? "Multiple Select"
                          : "Multiple Choice"
                        : q.type === "true_false"
                          ? "True / False"
                          : "Identification"}
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
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase tracking-wider">
                        {q.topicTag}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-10 text-center space-y-2">
                <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm font-semibold text-foreground">No questions in this quiz yet.</p>
              </div>
            )
          ) : (
            <div className="py-10 text-center space-y-2">
              <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
              <p className="text-sm font-semibold text-foreground">Questions hidden until you start</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                The questions and answer choices for this quiz are revealed only when you take it.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border p-5 pt-3 flex-wrap">
          <div className="flex items-center space-x-2 flex-wrap">
            {canManage && (
              <>
                {pq.subjectId && pq.subjectId !== "personal" && (
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
                <button
                  onClick={() => {
                    onEditQuiz(pq);
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
                    onDeleteQuiz(pq);
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
            {!isStaff && pqExhausted ? (
              <span className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold cursor-not-allowed">
                Attempts exhausted
              </span>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onTakeQuiz(pq.id);
                }}
                disabled={pqOverdue && (pq.attemptsUsed ?? 0) === 0}
                className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{(pq.attemptsUsed ?? 0) > 0 ? "Retake Quiz" : "Take Quiz"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
