import { GraduationCap, Plus, Pencil, Download, Trash2 } from "lucide-react";
import { Pagination, slicePage } from "../../../components/Pagination";
import type { Quiz } from "../../../types";

interface QuizzesTabProps {
  quizzes: Quiz[];
  quizzesLoading: boolean;
  quizPage: number;
  setQuizPage: (page: number) => void;
  canManage: boolean;
  onCreateQuiz: () => void;
  onPreview: (quiz: Quiz) => void;
  onTogglePublish: (quiz: Quiz) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDownloadQuizPdf: (quizId: string, quizTitle: string) => void;
  onDeleteQuiz: (quiz: Quiz) => void;
  onStartQuiz: (quizId: string) => void;
}

export function QuizzesTab({
  quizzes,
  quizzesLoading,
  quizPage,
  setQuizPage,
  canManage,
  onCreateQuiz,
  onPreview,
  onTogglePublish,
  onEditQuiz,
  onDownloadQuizPdf,
  onDeleteQuiz,
  onStartQuiz,
}: QuizzesTabProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Quizzes & Assessments</span>
        </h2>
        {canManage && (
          <button
            onClick={onCreateQuiz}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Quiz</span>
          </button>
        )}
      </div>

      {quizzesLoading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Loading quizzes...</p>
      ) : quizzes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          No quizzes created for this subject yet.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            {slicePage(quizzes, quizPage).map((quiz) => (
              <div key={quiz.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30 gap-3">
                <button
                  type="button"
                  onClick={() => onPreview(quiz)}
                  className="min-w-0 flex-1 text-left cursor-pointer group"
                  title="View quiz details"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{quiz.title}</p>
                    {(quiz.attemptsUsed ?? 0) > 0 && (
                      <span className="text-sm font-bold text-primary shrink-0 tabular-nums" title="Latest attempt score">
                        {quiz.lastScoreRaw ?? 0}/{quiz.lastMaxScore ?? 0}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {quiz.questions?.length || 0} questions • {quiz.difficulty} •{" "}
                    {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No time limit"} • Pass {quiz.passPercentage}%
                    {quiz.deadline
                      ? ` • Due ${new Date(quiz.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : ""}
                  </p>
                </button>
                <div className="flex items-center space-x-1.5 shrink-0">
                  {canManage ? (
                    <>
                      <button
                        onClick={() => onTogglePublish(quiz)}
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
                        onClick={() => onEditQuiz(quiz)}
                        className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                        title="Edit Quiz"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDownloadQuizPdf(quiz.id, quiz.title)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                        title="Download Quiz PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteQuiz(quiz)}
                        className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (quiz.attemptsAllowed || 0) > 0 &&
                    (quiz.attemptsUsed ?? 0) >= (quiz.attemptsAllowed || 0) ? (
                    <span
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground"
                      title="Attempt limit reached for this quiz"
                    >
                      Attempts Exceeded
                    </span>
                  ) : (
                    <>
                      {(quiz.attemptsAllowed || 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-semibold whitespace-nowrap">
                          {Math.max(0, (quiz.attemptsAllowed || 0) - (quiz.attemptsUsed ?? 0))} attempt
                          {(quiz.attemptsAllowed || 0) - (quiz.attemptsUsed ?? 0) === 1 ? "" : "s"} left
                        </span>
                      )}
                      <button
                        onClick={() => onStartQuiz(quiz.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
                        title="Start this quiz"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>{(quiz.attemptsUsed ?? 0) > 0 ? "Retake Quiz" : "Take Quiz"}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={quizPage} total={quizzes.length} onPageChange={setQuizPage} />
        </>
      )}
    </div>
  );
}
