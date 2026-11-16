import { CheckCircle2, XCircle } from "lucide-react";
import type { Quiz, QuizAttempt } from "../../../types";
import { feedbackCorrectText, feedbackUserAnswerText } from "./assessmentUtils";

interface CompletedAttemptViewProps {
  completedAttempt: QuizAttempt;
  activeQuiz: Quiz;
  returnTo: string | null;
  onBack: () => void;
}

export function CompletedAttemptView({ completedAttempt, activeQuiz, returnTo, onBack }: CompletedAttemptViewProps) {
  return (
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
          onClick={onBack}
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer"
        >
          {returnTo ? "Back to Subject Quizzes" : "Back to Assessments Catalog"}
        </button>
      </div>
    </div>
  );
}
