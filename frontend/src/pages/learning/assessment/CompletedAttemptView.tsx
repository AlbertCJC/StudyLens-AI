import { CheckCircle2, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { CountUp } from "../../../components/ui/count-up";
import type { Quiz, QuizAttempt } from "../../../types";
import { feedbackCorrectText, feedbackUserAnswerText } from "./assessmentUtils";

interface CompletedAttemptViewProps {
  completedAttempt: QuizAttempt;
  activeQuiz: Quiz;
  returnTo: string | null;
  onBack: () => void;
}

function ScoreRing({ percentage }: { percentage: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percentage));
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="score-ring" x1="0" x2="1">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="url(#score-ring)"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-foreground">
        <CountUp value={Math.round(pct)} suffix="%" duration={1000} />
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#4f46e5", "#6366f1", "#10b981", "#34d399", "#c7d2fe"];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-0 overflow-visible" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 7) * 60}ms`,
            ["--drift" as string]: `${((i * 53) % 80) - 40}px`,
          }}
        />
      ))}
    </div>
  );
}

export function CompletedAttemptView({ completedAttempt, activeQuiz, returnTo, onBack }: CompletedAttemptViewProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
      <div className="relative text-center space-y-3 border-b border-border pb-5">
        {completedAttempt.percentage >= 80 && <Confetti />}
        <ScoreRing percentage={completedAttempt.percentage} />
        <h2 className="text-2xl font-black text-foreground">
          {completedAttempt.percentage >= 80 ? "Great work!" : completedAttempt.percentage >= 50 ? "Assessment completed" : "Keep practicing"}
        </h2>
        <p className="text-base font-bold text-primary">
          {completedAttempt.score} / {completedAttempt.totalPoints} points
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
            style={{ animationDelay: `${Math.min(idx, 10) * 40}ms`, animationFillMode: "both" }}
            className={`p-4 rounded-xl border space-y-2 text-xs animate-in fade-in slide-up ${
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
          className="px-5 py-2.5 bg-cta-gradient hover:brightness-110 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
        >
          {returnTo ? "Back to Subject Quizzes" : "Back to Assessments Catalog"}
        </button>
      </div>
    </div>
  );
}
