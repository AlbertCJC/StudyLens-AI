import React, { useState, useEffect } from "react";
import { TrendingUp, Download, BarChart2, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { CardDetailModal, WeakTopicsDetail, AttemptsDetail } from "../../components/CardDetailModal";
import type { StudentProgress, Recommendation } from "../../types";

type DetailCardKey = "weak" | "average" | "assessments";

export const ProgressAnalyticsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [detailCard, setDetailCard] = useState<DetailCardKey | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const studentId = currentUser?.id || "";
        const [progRes, recRes] = await Promise.all([
          authFetch(`/api/progress/${studentId}`),
          authFetch(`/api/recommendations/${studentId}`),
        ]);
        if (progRes.ok) {
          const progData = await progRes.json();
          if (isSubscribed) setProgress(progData);
        }
        if (recRes.ok) {
          const recData = await recRes.json();
          if (isSubscribed) setRecommendations(recData);
        }
      } catch (err) {
        console.error("Progress analytics error:", err);
      }
    };

    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id]);

  const chartData = progress?.topicPerformances ?? [];

  const trendData =
    progress?.recentQuizAttempts?.map((att, i) => ({
      quiz: `Quiz ${i + 1}`,
      score: att.percentage,
    })) ?? [];

  const handleExportPDF = async () => {
    try {
      const res = await authFetch("/api/convert-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `StudyLens AI Progress & Knowledge Gap Analytics Report`,
          content: `Student: ${currentUser?.name} | Email: ${currentUser?.email}\nAverage Score: ${progress?.averageScore ?? 0}%\nTotal Quizzes Completed: ${progress?.totalQuizzesTaken ?? 0}`,
          items: chartData.map((d) => ({
            question: `Topic: ${d.topic}`,
            answer: `Accuracy: ${d.accuracyPercentage}% | Status: ${
              d.accuracyPercentage >= 70 ? "Mastered" : "Needs Review"
            }`,
          })),
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `StudyLens_Progress_Report_${Date.now()}.pdf`;
        a.click();
        showToast("Progress report exported as PDF.");
      }
    } catch (err) {
      console.error("Export PDF error:", err);
      showToast("Could not export the report. Please try again.", "error");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={handleExportPDF}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Analytics PDF</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setDetailCard("average")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Average Performance</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-3xl font-black text-foreground mt-1">
            {typeof progress?.averageScore === "number" ? `${progress.averageScore}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Passing mark is 70%</p>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("assessments")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Assessments Completed</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-3xl font-black text-foreground mt-1">{progress?.totalQuizzesTaken ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Automatically graded</p>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("weak")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-amber-500/60 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Detected Weak Topics</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-amber-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {progress?.weakTopics?.length ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Click to see topics that need review</p>
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Accuracy Bar Chart */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Topic Accuracy Breakdown (%)</h3>
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-muted-foreground">No topic data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="topic" tick={{ fontSize: 10, fill: "currentColor" }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", fontSize: "11px" }}
                  />
                  <Bar dataKey="accuracyPercentage" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Score Trend Line Chart */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Quiz Score Progression Trend</h3>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="h-64 w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-muted-foreground">No quiz attempts yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="quiz" tick={{ fontSize: 10, fill: "currentColor" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", fontSize: "11px" }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Study Recommendations */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
        <h3 className="text-base font-bold text-foreground">Recommendations</h3>

        <div className="space-y-3">
          {recommendations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No recommendations yet.</p>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    {rec.weakTopic} · {rec.recommendationType}
                    {typeof rec.accuracyPercentage === "number" ? ` · ${rec.accuracyPercentage}% accuracy` : ""}
                  </p>
                  <h4 className="text-sm font-bold text-foreground">{rec.title}</h4>
                  <p className="text-xs text-muted-foreground">{rec.description}</p>
                </div>

                {rec.steps && rec.steps.length > 0 && (
                  <div className="pt-3 border-t border-border/60">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Suggested steps
                    </p>
                    <ol className="space-y-1.5">
                      {rec.steps.map((s) => (
                        <li key={`${rec.id}-${s.step}`} className="flex items-start space-x-2 text-xs">
                          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {s.step}
                          </span>
                          <span className="text-foreground">
                            <span className="font-bold capitalize">{s.type}:</span>{" "}
                            {s.title}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <CardDetailModal
        open={detailCard === "weak"}
        title="Detected Weak Topics"
        subtitle={`You have ${progress?.weakTopics?.length ?? 0} topic${(progress?.weakTopics?.length ?? 0) === 1 ? "" : "s"} that need review.`}
        onClose={() => setDetailCard(null)}
      >
        <WeakTopicsDetail
          topics={progress?.weakTopics ?? []}
          performances={progress?.topicPerformances ?? []}
          mastered={progress?.masteredTopics ?? []}
        />
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "average" || detailCard === "assessments"}
        title={detailCard === "average" ? "Average Performance" : "Completed Assessments"}
        subtitle={
          detailCard === "average"
            ? `Overall average: ${typeof progress?.averageScore === "number" ? `${progress.averageScore}%` : "—"} (passing mark is 70%)`
            : `${progress?.totalQuizzesTaken ?? 0} assessment${(progress?.totalQuizzesTaken ?? 0) === 1 ? "" : "s"} completed`
        }
        onClose={() => setDetailCard(null)}
      >
        <AttemptsDetail attempts={progress?.recentQuizAttempts ?? []} />
      </CardDetailModal>
    </div>
  );
};
