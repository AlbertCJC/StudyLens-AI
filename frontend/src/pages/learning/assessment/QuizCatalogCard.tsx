import { ArrowRight, BookOpen, Clock, Pencil, Play, RotateCw, Trash2 } from "lucide-react";
import type { Quiz, User } from "../../../types";
import { cleanQuizDescription, isQuizOverdue, type SavedQuizProgress } from "./assessmentUtils";

interface QuizCatalogCardProps {
  quiz: Quiz;
  saved: SavedQuizProgress | undefined;
  currentUser: User | null;
  onPreview: (quiz: Quiz) => void;
  onStartQuiz: (quiz: Quiz, resume?: boolean) => void;
  onTogglePublish: (quiz: Quiz) => void;
  onOpenAssignSubject: (quiz: Quiz) => void;
  onOpenEdit: (quiz: Quiz) => void;
  onRequestDelete: (quiz: Quiz) => void;
}

export function QuizCatalogCard({
  quiz,
  saved,
  currentUser,
  onPreview,
  onStartQuiz,
  onTogglePublish,
  onOpenAssignSubject,
  onOpenEdit,
  onRequestDelete,
}: QuizCatalogCardProps) {
  const canManage = currentUser?.role === "teacher" || (quiz.createdById === currentUser?.id && currentUser?.role !== "admin");
  const canPublish = currentUser?.role === "teacher";
  const quizAttemptsAllowed = quiz.attemptsAllowed || 0;
  const cleanDesc = cleanQuizDescription(quiz.description || "");

  return (
    <div
      onClick={() => onPreview(quiz)}
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
                onTogglePublish(quiz);
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
                onOpenAssignSubject(quiz);
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
                  onOpenEdit(quiz);
                }}
                className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                title="Edit Quiz details & questions"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete(quiz);
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
                  onStartQuiz(quiz, false);
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
                  onStartQuiz(quiz, true);
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
                onStartQuiz(quiz, false);
              }}
              className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 ml-auto cursor-pointer"
            >
              <span>{(quiz.attemptsUsed ?? 0) > 0 ? "Retake Quiz" : "Take Quiz"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
