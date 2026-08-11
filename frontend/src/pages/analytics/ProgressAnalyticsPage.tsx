import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Brain,
  Download,
  BarChart2,
} from "lucide-react";
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
import { authFetch } from "../../utils/authFetch";
import type { StudentProgress, Recommendation } from "../../types";

export const ProgressAnalyticsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const studentId = currentUser?.id || "usr-student-1";
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

  const chartData =
    progress?.topicPerformances && progress.topicPerformances.length > 0
      ? progress.topicPerformances
      : [
          { topic: "Graph Traversal", accuracyPercentage: 80 },
          { topic: "Recursion & Stacks", accuracyPercentage: 100 },
          { topic: "Binary Search Trees", accuracyPercentage: 90 },
          { topic: "Database Normalization", accuracyPercentage: 65 },
        ];

  const trendData =
    progress?.recentQuizAttempts && progress.recentQuizAttempts.length > 0
      ? progress.recentQuizAttempts.map((att, i) => ({
          quiz: `Quiz ${i + 1}`,
          score: att.percentage,
        }))
      : [
          { quiz: "Quiz 1", score: 65 },
          { quiz: "Quiz 2", score: 75 },
          { quiz: "Quiz 3", score: 80 },
        ];

  const handleExportPDF = async () => {
    try {
      const res = await authFetch("/api/convert-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `StudyLens AI Progress & Knowledge Gap Analytics Report`,
          content: `Student: ${currentUser?.name} | Email: ${currentUser?.email}\nAverage Score: ${progress?.averageScore || 80}%\nTotal Quizzes Completed: ${progress?.totalQuizzesTaken || 1}`,
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
      }
    } catch (err) {
      console.error("Export PDF error:", err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 border border-blue-200/80 text-slate-900 dark:from-blue-900 dark:via-indigo-950 dark:to-slate-900 dark:border-blue-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200/80 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/20 text-xs font-semibold">
            <Brain className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
            <span>Knowledge Gap Analysis & Adaptive Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress Analytics & Learning Path</h1>
          <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xl leading-relaxed">
            Real-time tracking of topic mastery, Bloom's taxonomy accuracy breakdown, and personalized recommendations.
          </p>
        </div>

        <button
          onClick={handleExportPDF}
          className="px-4 py-2.5 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 self-start sm:self-center cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Analytics PDF</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground">Average Performance</p>
          <p className="text-3xl font-black text-foreground mt-1">{progress?.averageScore || 80}%</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">Passing Mark Threshold: 70%</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground">Total Assessments Completed</p>
          <p className="text-3xl font-black text-foreground mt-1">{progress?.totalQuizzesTaken || 1}</p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1">Auto-Graded via StudyLens AI</p>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground">Detected Weak Topics</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {progress?.weakTopics?.length || 1}
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1">Requires Adaptive Review</p>
        </div>
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
          </div>
        </div>

        {/* Score Trend Line Chart */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Quiz Score Progression Trend</h3>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="h-64 w-full">
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
          </div>
        </div>
      </div>

      {/* Adaptive Study Recommendations List */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Personalized Adaptive Recommendations</h3>
            <p className="text-xs text-muted-foreground">
              AI-suggested study paths to boost accuracy on detected weak topics
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Target: {rec.weakTopic}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    Format: {rec.recommendationType}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground">{rec.title}</h4>
                <p className="text-xs text-muted-foreground">{rec.description}</p>
              </div>

              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 whitespace-nowrap self-start sm:self-center">
                Adaptive Difficulty: {rec.difficultyTarget.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
