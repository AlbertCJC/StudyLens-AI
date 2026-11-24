import React from "react";
import { X, ChevronRight, CheckCircle2 } from "lucide-react";
import type { TopicPerformance } from "../types";

export interface AttemptDetail {
  quizTitle?: string;
  subjectName?: string;
  percentage: number;
  score?: number;
  maxScore?: number;
  completedAt?: string;
}

// Clickable row inside a card drill-down: sends the user to the matching
// section instead of leaving them on a static list.
export const DetailRow: React.FC<{
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}> = ({ label, sublabel, trailing, onClick }) => {
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground truncate">{label}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground truncate">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {trailing}
        {onClick && (
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="w-full p-3 rounded-xl border border-border bg-muted/20 flex items-start justify-between gap-3">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-3 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 flex items-start justify-between gap-3 text-left transition-all cursor-pointer group"
    >
      {content}
    </button>
  );
};

interface CardDetailModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  open,
  title,
  subtitle,
  onClose,
  children,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]">
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-border">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 pt-4 overflow-y-auto space-y-2.5">{children}</div>
      </div>
    </div>
  );
};

const accuracyColor = (pct: number) =>
  pct >= 70
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : pct >= 50
    ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
    : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30";

const accuracyBarColor = (pct: number) =>
  pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";

export interface MasteredTopic {
  topic: string;
  currentAccuracy: number;
  improvedFrom?: number | null;
}

export const WeakTopicsDetail: React.FC<{
  topics: string[];
  performances?: TopicPerformance[];
  onTopicClick?: (topic: string) => void;
  mastered?: MasteredTopic[];
}> = ({ topics, performances = [], onTopicClick, mastered = [] }) => {
  if (topics.length === 0 && mastered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No weak topics detected. Keep up the great work!
      </p>
    );
  }

  return (
    <>
      {topics.map((topic) => {
        const perf = performances.find(
          (p) => p.topic.toLowerCase() === topic.toLowerCase()
        );
        const pct = perf?.accuracyPercentage;
        const rowClasses = onTopicClick
          ? "cursor-pointer group hover:bg-primary/5 hover:border-primary/40 transition-all"
          : "";
        return (
          <div
            key={topic}
            onClick={onTopicClick ? () => onTopicClick(topic) : undefined}
            className={`p-3 rounded-xl border border-border bg-muted/20 space-y-2 ${rowClasses}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground">{topic}</span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  typeof pct === "number" ? accuracyColor(pct) : "text-muted-foreground bg-muted/40 border-border"
                }`}
              >
                Needs Review
              </span>
            </div>
            {typeof pct === "number" && (
              <>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${accuracyBarColor(pct)}`}
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {perf?.correctAnswers ?? 0}/{perf?.totalQuestions ?? 0} correct · {pct}% accuracy
                </p>
              </>
            )}
          </div>
        );
      })}

      {mastered.length > 0 && (
        <div className="pt-1 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Overcome ({mastered.length})
          </p>
          {mastered.map((m) => (
            <div
              key={m.topic}
              className={`p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 ${
                onTopicClick ? "cursor-pointer group hover:border-emerald-500/60 transition-all" : ""
              }`}
              onClick={onTopicClick ? () => onTopicClick(m.topic) : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">{m.topic}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                  Mastered
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {typeof m.improvedFrom === "number"
                  ? `Improved from ${m.improvedFrom}% to ${m.currentAccuracy}% accuracy`
                  : `${m.currentAccuracy}% accuracy — you've overcome this topic!`}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground pt-1">
        {onTopicClick
          ? "Tip: tap a topic to open the AI Study Generator with a ready-made study plan."
          : "Tip: check the Recommendations section below for targeted study steps."}
      </p>
    </>
  );
};

export const AttemptsDetail: React.FC<{
  attempts: AttemptDetail[];
  onAttemptClick?: (attempt: AttemptDetail, index: number) => void;
}> = ({ attempts, onAttemptClick }) => {
  if (attempts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No assessment attempts recorded yet.
      </p>
    );
  }

  return (
    <>
      {attempts.map((att, i) => (
        <div
          key={i}
          onClick={onAttemptClick ? () => onAttemptClick(att, i) : undefined}
          className={`p-3 rounded-xl border border-border bg-muted/20 flex items-start justify-between gap-3 ${
            onAttemptClick
              ? "cursor-pointer group hover:bg-primary/5 hover:border-primary/40 transition-all"
              : ""
          }`}
        >
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              {att.quizTitle || "Completed a quiz"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {[att.subjectName, att.completedAt ? new Date(att.completedAt).toLocaleDateString() : ""]
                .filter(Boolean)
                .join(" · ") || "Details unavailable"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-black tabular-nums text-foreground">
              {Math.round(att.percentage)}%
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                att.percentage >= 70
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30"
              }`}
            >
              {att.percentage >= 70 ? "Passed" : "Failed"}
            </span>
            {onAttemptClick && (
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
        </div>
      ))}
    </>
  );
};
