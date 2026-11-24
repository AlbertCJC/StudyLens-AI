import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Award,
  TrendingUp,
  Activity,
  Clock,
  FileText,
  Layers,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { isNewUser } from "../../utils/time";
import { CardDetailModal, WeakTopicsDetail, AttemptsDetail, DetailRow } from "../../components/CardDetailModal";
import type { StudentProgress } from "../../types";

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenWeakTopic?: (topic: string) => void;
}

interface EnrolledSubject {
  id: string;
  code: string;
  name: string;
  materialCount?: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate, onOpenWeakTopic }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([]);
  const [detailCard, setDetailCard] = useState<"weak" | "average" | "subjects" | "completed" | null>(null);

  // In-Progress Quiz State initialized lazily from localStorage
  const [savedQuizInfo] = useState<{
    quizTitle: string;
    subjectName: string;
    currentQIndex: number;
    totalQuestions: number;
    userAnswersCount: number;
    targetEndTime?: number;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const userId = currentUser?.id || "guest";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`studylens_quiz_progress_${userId}_`)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            return {
              quizTitle: parsed.quizTitle || "In Progress Assessment",
              subjectName: parsed.subjectName || "Subject",
              currentQIndex: parsed.currentQIndex || 0,
              totalQuestions: parsed.totalQuestions || 10,
              userAnswersCount: Object.keys(parsed.userAnswers || {}).length,
              targetEndTime: parsed.targetEndTime,
            };
          }
        } catch (e) {
          console.error("Error parsing saved quiz in StudentDashboard:", e);
        }
      }
    }
    return null;
  });

  useEffect(() => {
    const studentId = currentUser?.id;
    if (!studentId) return;
    let isSubscribed = true;

    authFetch(`/api/progress/${studentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed) setProgress(data);
      })
      .catch(() => {});

    authFetch("/api/subjects")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (isSubscribed) setSubjects(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id]);

  const studentName = currentUser?.name ? currentUser.name.split(" ")[0] : "there";
  const attempts = progress?.recentQuizAttempts ?? [];

  return (
    <div className="space-y-6 pb-6">
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {isNewUser(currentUser?.createdAt) ? "Welcome" : "Welcome back"}, {studentName}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your learning today.
          </p>
        </div>
      </div>

      {/* Active Saved Quiz Banner if user exited mid-quiz */}
      {savedQuizInfo && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {savedQuizInfo.quizTitle} ({savedQuizInfo.subjectName})
              </p>
              <p className="text-xs text-muted-foreground">
                Question {savedQuizInfo.currentQIndex + 1} of {savedQuizInfo.totalQuestions} ({savedQuizInfo.userAnswersCount} answered)
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate("assessments")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm self-start sm:self-center cursor-pointer transition-all"
          >
            <span>Continue Quiz</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => setDetailCard("subjects")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-primary/50 hover:shadow-xs transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Total Subjects</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">{subjects.length}</p>
          </div>
          <div className="p-3 bg-structure text-primary dark:text-indigo-300 rounded-2xl shrink-0 relative">
            <BookOpen className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("completed")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-primary/50 hover:shadow-xs transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Completed Quizzes</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              {progress?.totalQuizzesTaken ?? 0}
            </p>
          </div>
          <div className="p-3 bg-structure text-primary dark:text-indigo-300 rounded-2xl shrink-0 relative">
            <Award className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("average")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-xs transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Average Score</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              {typeof progress?.averageScore === "number" ? `${progress.averageScore}%` : "—"}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-2xl shrink-0 relative">
            <TrendingUp className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("weak")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-rose-500/50 hover:shadow-xs transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Weak Topics</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              {progress?.weakTopics?.length ?? 0}
            </p>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 rounded-2xl shrink-0 relative">
            <Activity className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </div>

      {/* Row 2: 2 Column Layout (Recent Activities & Enrolled Subjects) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Activities (7 cols) */}
        <div className="lg:col-span-7 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Recent Activities</h2>
            <button
              onClick={() => onNavigate("analytics")}
              className="text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>

          {attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No recent activity yet. Take a quiz to get started.</p>
          ) : (
            <div className="space-y-4">
              {attempts.map((att, i) => (
                <div key={i} className="flex items-start space-x-3.5 pb-4 border-b border-border/60 last:border-0 last:pb-0">
                  <div className="p-2.5 rounded-full bg-structure text-primary dark:text-indigo-300 mt-0.5 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-sm font-extrabold text-foreground leading-snug">
                      {att.quizTitle || "Completed a quiz"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {att.subjectName && (
                        <span className="px-2.5 py-0.5 bg-cta-gradient text-white text-[11px] font-bold rounded-md">
                          {att.subjectName}
                        </span>
                      )}
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Score: {att.percentage}%
                      </span>
                    </div>
                    {att.completedAt && (
                      <p className="text-xs text-muted-foreground pt-1">
                        {new Date(att.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Enrolled Subjects (5 cols) */}
        <div className="lg:col-span-5 bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-6">
          <h2 className="text-lg font-extrabold text-foreground">Enrolled Subjects</h2>

          {subjects.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">You are not enrolled in any subjects yet.</p>
          ) : (
            <div className="space-y-3">
              {subjects.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onNavigate("subjects")}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 hover:border-primary/50 transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 rounded-lg bg-structure text-primary dark:text-indigo-300 shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{sub.name}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{sub.code}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground flex items-center space-x-1 shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{sub.materialCount ?? 0} materials</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick AI Shortcuts */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-3.5 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Generate Study Materials</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create quizzes, flashcards, or summaries from your course materials.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => onNavigate("ai-assistant")}
            className="w-full py-2 bg-cta-gradient hover:brightness-110 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Launch AI Study Assistant</span>
          </button>
          <button
            onClick={() => onNavigate("flashcards")}
            className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Open Flashcards Deck</span>
          </button>
        </div>
      </div>

      <CardDetailModal
        open={detailCard === "weak"}
        title="Weak Topics"
        subtitle={`You have ${progress?.weakTopics?.length ?? 0} topic${(progress?.weakTopics?.length ?? 0) === 1 ? "" : "s"} that need review.`}
        onClose={() => setDetailCard(null)}
      >
        {onOpenWeakTopic ? (
          <>
            <WeakTopicsDetail
              topics={progress?.weakTopics ?? []}
              performances={progress?.topicPerformances ?? []}
              mastered={progress?.masteredTopics ?? []}
              onTopicClick={(topic) => {
                setDetailCard(null);
                onOpenWeakTopic(topic);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setDetailCard(null);
                onNavigate("flashcards");
              }}
              className="w-full p-3 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
            >
              <div>
                <p className="text-xs font-bold text-foreground">Review with Flashcards</p>
                <p className="text-[11px] text-muted-foreground">Drill your existing decks on these topics</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </>
        ) : (
          <WeakTopicsDetail
            topics={progress?.weakTopics ?? []}
            performances={progress?.topicPerformances ?? []}
            mastered={progress?.masteredTopics ?? []}
          />
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "average"}
        title="Average Score"
        subtitle={`Overall average: ${typeof progress?.averageScore === "number" ? `${progress.averageScore}%` : "—"} (passing mark is 70%)`}
        onClose={() => setDetailCard(null)}
      >
        <AttemptsDetail
          attempts={progress?.recentQuizAttempts ?? []}
          onAttemptClick={() => {
            setDetailCard(null);
            onNavigate("analytics");
          }}
        />
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "subjects"}
        title="Enrolled Subjects"
        subtitle={`You are enrolled in ${subjects.length} course subject${subjects.length === 1 ? "" : "s"}.`}
        onClose={() => setDetailCard(null)}
      >
        {subjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No enrolled subjects yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.map((s) => (
              <li key={s.id}>
                <DetailRow
                  label={`${s.code} — ${s.name}`}
                  trailing={
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300">
                      {s.materialCount ?? 0} material{(s.materialCount ?? 0) === 1 ? "" : "s"}
                    </span>
                  }
                  onClick={() => navigate(`/subjects/${s.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "completed"}
        title="Completed Quizzes"
        subtitle={`You have completed ${progress?.totalQuizzesTaken ?? 0} quiz${(progress?.totalQuizzesTaken ?? 0) === 1 ? "" : "zes"} so far.`}
        onClose={() => setDetailCard(null)}
      >
        {(progress?.recentQuizAttempts ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No quiz attempts recorded yet. Take an assessment to see your history here.
          </p>
        ) : (
          <AttemptsDetail
            attempts={progress?.recentQuizAttempts ?? []}
            onAttemptClick={() => {
              setDetailCard(null);
              onNavigate("assessments");
            }}
          />
        )}
      </CardDetailModal>
    </div>
  );
};