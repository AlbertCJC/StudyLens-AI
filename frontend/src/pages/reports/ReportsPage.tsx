import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, BarChart2, Download, Trash2, RefreshCw, ChevronDown, X, Users, GraduationCap, Sparkles, Loader2, Search, Filter, RotateCcw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import type { GeneratedReport } from "../../types";

const REPORT_TYPES = ["Student Performance", "Quiz Analytics", "Subject Summary", "AI Usage"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_ICONS: Record<ReportType, React.ElementType> = {
  "Student Performance": Users,
  "Quiz Analytics": BarChart2,
  "Subject Summary": GraduationCap,
  "AI Usage": Sparkles,
};

interface StudentOption { id: string; name: string; }
interface QuizOption { id: string; title: string; subjectName: string; subjectId?: string; }
interface SubjectOption { id: string; name: string; }

export const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const isTeacher = currentUser?.role === "teacher";
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("Student Performance");
  const [title, setTitle] = useState("");
  const [targetId, setTargetId] = useState("");

  const [viewing, setViewing] = useState<GeneratedReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeneratedReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      const suffix = isTeacher && currentUser?.id ? `?generatedBy=${encodeURIComponent(currentUser.id)}` : "";
      const res = await authFetch(`/api/reports${suffix}`);
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      } else {
        showToast("Failed to load reports.", "error");
      }
    } catch {
      showToast("Could not reach the report service.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isTeacher, currentUser?.id]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(fetchReports, 0);

    const teacherSubjectIds = new Set<string>();

    const loadScopedLists = async () => {
      setLoadingStudents(true);
      setLoadingQuizzes(true);
      setLoadingSubjects(true);
      try {
        const [usersRes, quizzesRes, subjectsRes] = await Promise.all([
          authFetch("/api/users"),
          authFetch("/api/quizzes"),
          authFetch("/api/subjects"),
        ]);
        if (!active) return;

        let allSubjects: { id: string; name: string; code?: string; teacherId?: string }[] = [];
        let allQuizzes: QuizOption[] = [];
        let allUsers: { id: string; name: string; role: string }[] = [];

        if (subjectsRes.ok) {
          const subData = await subjectsRes.json();
          if (Array.isArray(subData)) allSubjects = subData;
        }
        if (quizzesRes.ok) {
          const qData = await quizzesRes.json();
          if (Array.isArray(qData)) allQuizzes = qData.map((q) => ({ id: q.id, title: q.title, subjectName: q.subjectName, subjectId: q.subjectId }));
        }
        if (usersRes.ok) {
          const uData = await usersRes.json();
          if (Array.isArray(uData)) allUsers = uData;
        }

        let scopedSubjects = allSubjects;
        if (isTeacher && currentUser?.id) {
          scopedSubjects = allSubjects.filter((s) => s.teacherId === currentUser.id);
        }
        scopedSubjects.forEach((s) => teacherSubjectIds.add(s.id));
        setSubjects(scopedSubjects.map((s) => ({ id: s.id, name: `${s.code || ""} - ${s.name}` })));

        let scopedQuizzes = allQuizzes;
        if (isTeacher && currentUser?.id) {
          const owned = allQuizzes.filter((q) => q.subjectId && teacherSubjectIds.has(q.subjectId));
          if (owned.length > 0) scopedQuizzes = owned;
        }
        setQuizzes(scopedQuizzes);

        const allStudents = allUsers.filter((u) => u.role === "student").map((u) => ({ id: u.id, name: u.name }));
        let scopedStudents = allStudents;
        if (isTeacher && currentUser?.id) {
          const rosterIds = new Set<string>();
          await Promise.all(
            [...teacherSubjectIds].map(async (sid) => {
              try {
                const res = await authFetch(`/api/subjects/${sid}/students`);
                if (res.ok) {
                  const roster = await res.json();
                  if (Array.isArray(roster)) roster.forEach((r) => rosterIds.add(r.id));
                }
              } catch { /* ignore roster fetch errors */ }
            })
          );
          scopedStudents = allStudents.filter((s) => rosterIds.has(s.id));
        }
        setStudents(scopedStudents);
      } catch {
        // ignore
      } finally {
        setLoadingStudents(false);
        setLoadingQuizzes(false);
        setLoadingSubjects(false);
      }
    };

    loadScopedLists();
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [fetchReports, isTeacher, currentUser?.id]);

  const openGenerate = (type: ReportType, existing?: GeneratedReport) => {
    setReportType(existing?.reportType || type);
    setTitle(existing?.title || `${type} Report`);
    setTargetId(existing?.targetId || "");
    setShowGenerate(true);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await authFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          title: title.trim() || `${reportType} Report`,
          targetId: targetId || undefined,
          generatedBy: currentUser?.id || "usr-admin-1",
          teacherId: isTeacher ? currentUser?.id : undefined,
          userRole: currentUser?.role || "student",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setReports((prev) => [data, ...prev]);
        setShowGenerate(false);
        showToast("Report generated successfully.");
      } else {
        showToast(data?.error || "Could not generate the report.", "error");
      }
    } catch {
      showToast("Report generation failed. Please try again.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const requestDelete = (report: GeneratedReport) => {
    setDeleteTarget(report);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`/api/reports/${deleteTarget.id}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Report deleted.");
    } catch {
      showToast("Could not delete the report.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const summaryRows = (report: GeneratedReport): { label: string; value: string }[] => {
    const s = (report.summary || {}) as Record<string, unknown>;
    const rows: { label: string; value: string }[] = [];
    if (s.studentName) rows.push({ label: "Student", value: String(s.studentName) });
    if (typeof s.quizzesTaken === "number") rows.push({ label: "Quizzes Taken", value: String(s.quizzesTaken) });
    if (typeof s.averageScore === "number") rows.push({ label: "Average Score", value: `${s.averageScore}%` });
    if (typeof s.passRate === "number") rows.push({ label: "Pass Rate", value: `${s.passRate}%` });
    if (Array.isArray(s.weakTopics)) rows.push({ label: "Weak Topics", value: (s.weakTopics as string[]).join(", ") || "None" });
    if (Array.isArray(s.strongTopics)) rows.push({ label: "Strong Topics", value: (s.strongTopics as string[]).join(", ") || "None" });
    if (typeof s.totalAttempts === "number") rows.push({ label: "Total Attempts", value: String(s.totalAttempts) });
    if (Array.isArray(s.quizzes)) rows.push({ label: "Quizzes Analyzed", value: String((s.quizzes as unknown[]).length) });
    if (typeof s.overallAverage === "number") rows.push({ label: "Overall Average", value: `${s.overallAverage}%` });
    if (Array.isArray(s.subjects)) rows.push({ label: "Subjects Covered", value: String((s.subjects as unknown[]).length) });
    if (typeof s.totalGenerated === "number") rows.push({ label: "Total AI Generated", value: String(s.totalGenerated) });
    if (typeof s.quizCount === "number") rows.push({ label: "Quizzes (Total)", value: String(s.quizCount) });
    if (typeof s.generationEvents === "number") rows.push({ label: "AI Generation Events", value: String(s.generationEvents) });
    if (s.breakdown && typeof s.breakdown === "object") {
      const b = s.breakdown as Record<string, unknown>;
      rows.push({ label: "By Type", value: Object.entries(b).map(([k, v]) => `${k}: ${v}`).join(" | ") });
    }
    return rows;
  };

  const csvFromRows = (report: GeneratedReport): string => {
    const rows = summaryRows(report);
    return rows.map((r) => `"${r.label.replace(/"/g, '""')}","${r.value.replace(/"/g, '""')}"`).join("\n");
  };

  const exportReportCSV = (report: GeneratedReport) => {
    const content = `Report,${report.reportType}\nTitle,${report.title}\nGenerated,${report.generatedAt}\n\n` + csvFromRows(report);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]+/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReportPDF = async (report: GeneratedReport) => {
    setExporting(report.id);
    try {
      const items = summaryRows(report).map((r) => ({ question: r.label, answer: r.value }));
      const res = await authFetch("/api/convert-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: report.title,
          content: `${report.reportType} · Generated ${report.generatedAt}`,
          items,
        }),
      });
      if (!res.ok) throw new Error("PDF export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title.replace(/[^a-z0-9]+/gi, "_")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast("Report exported as PDF.");
    } catch {
      showToast("Could not export the report as PDF.", "error");
    } finally {
      setExporting(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (typeFilter !== "all" && r.reportType !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !r.reportType.toLowerCase().includes(q)) return false;
    }
    // Compare parsed timestamps (generatedAt may be a display-formatted string).
    const generated = new Date(r.generatedAt).getTime();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    if (fromTs && !(generated >= fromTs)) return false;
    if (toTs && !(generated <= toTs)) return false;
    return true;
  });

  const renderDetails = (report: GeneratedReport) => {
    const s = (report.summary || {}) as Record<string, unknown>;
    const rows = summaryRows(report);

    if (report.reportType === "Quiz Analytics" && Array.isArray(s.quizzes)) {
      const qrows = s.quizzes as Record<string, unknown>[];
      return (
        <div className="space-y-4">
          {qrows.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No quiz analytics data available.</p>}
          {qrows.length > 0 && (
            <div className="space-y-3">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={qrows.map((q) => ({ name: (q.quizTitle || "Quiz").slice(0, 24), avg: q.averageScore ?? 0 }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "currentColor" }} interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", fontSize: "11px" }} />
                    <Bar dataKey="avg" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <th className="py-2 pr-2">Quiz</th>
                    <th className="py-2 px-2">Subject</th>
                    <th className="py-2 px-2 text-right">Attempts</th>
                    <th className="py-2 px-2 text-right">Avg</th>
                    <th className="py-2 px-2 text-right">Pass Rate</th>
                    <th className="py-2 px-2 text-right">High / Low</th>
                  </tr>
                </thead>
                <tbody>
                  {qrows.map((q, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-2 font-semibold text-foreground">{String(q.quizTitle || "Quiz")}</td>
                      <td className="py-2 px-2 text-muted-foreground">{String(q.subjectName || "—")}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(q.attempts ?? 0)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(q.averageScore ?? 0)}%</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(q.passRate ?? 0)}%</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(q.highestScore ?? 0)} / {Number(q.lowestScore ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (report.reportType === "Subject Summary" && Array.isArray(s.subjects)) {
      const srows = s.subjects as Record<string, unknown>[];
      return (
        <div className="space-y-4">
          {srows.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No subject summary data available.</p>}
          {srows.length > 0 && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <th className="py-2 pr-2">Subject</th>
                  <th className="py-2 px-2">Teacher</th>
                  <th className="py-2 px-2 text-right">Materials</th>
                  <th className="py-2 px-2 text-right">Quizzes</th>
                  <th className="py-2 px-2 text-right">AI Items</th>
                  <th className="py-2 px-2 text-right">Attempts</th>
                  <th className="py-2 px-2 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {srows.map((srow, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-2 font-semibold text-foreground">{String(srow.subjectName || "—")}</td>
                    <td className="py-2 px-2 text-muted-foreground">{String(srow.teacherName || "—")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(srow.materials ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(srow.quizzes ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(srow.aiGeneratedItems ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(srow.quizAttempts ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(srow.averageScore ?? 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (report.reportType === "Student Performance") {
      const attempts = Array.isArray(s.recentAttempts) ? (s.recentAttempts as Record<string, unknown>[]) : [];
      return (
        <div className="space-y-4">
          {attempts.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No recent attempts for this student.</p>}
          {attempts.length > 0 && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <th className="py-2 pr-2">Quiz</th>
                  <th className="py-2 px-2">Subject</th>
                  <th className="py-2 px-2 text-right">Score</th>
                  <th className="py-2 px-2 text-right">%</th>
                  <th className="py-2 px-2 text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-2 font-semibold text-foreground">{String(a.quizTitle || "Quiz")}</td>
                    <td className="py-2 px-2 text-muted-foreground">{String(a.subjectName || "—")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(a.score ?? 0)}/{Number(a.maxScore ?? a.totalPoints ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(a.percentage ?? 0)}%</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                        {a.passed ? "Passed" : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (report.reportType === "AI Usage" && s.breakdown && typeof s.breakdown === "object") {
      const b = s.breakdown as Record<string, unknown>;
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(b).map(([k, v]) => (
              <span key={k} className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = searchTerm !== "" || typeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-end shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
              <FileText className="w-3.5 h-3.5" />
              <span>Generate Report</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Choose a report type</DropdownMenuLabel>
            {REPORT_TYPES.map((type) => {
              const Icon = REPORT_ICONS[type];
              return (
                <DropdownMenuItem key={type} onClick={() => openGenerate(type)} className="gap-2.5">
                  <Icon className="w-4 h-4 text-primary" />
                  <span>{type}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Generated Reports</h3>
              <button
                onClick={fetchReports}
                title="Reload the report list from the server"
                className="p-1.5 bg-muted/50 hover:bg-muted text-foreground rounded-lg transition-all border border-border cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {filteredReports.length} of {reports.length} generated reports
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports..."
                className="pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-44"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="p-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none"
            >
              <option value="all">All types</option>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Generated on or after"
              className="p-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Generated on or before"
              className="p-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none"
            />
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Filter className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10">
            {reports.length === 0
              ? "No reports generated yet. Use the Generate Report button above to create one."
              : "No reports match the current filters."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const preview = summaryRows(report).slice(0, 2).map((r) => `${r.label}: ${r.value}`).join(" · ");
              return (
                <div
                  key={report.id}
                  onClick={() => setViewing(report)}
                  className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-all"
                  title="View Report"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider shrink-0">
                        {report.reportType}
                      </span>
                      <h4 className="text-sm font-bold text-foreground truncate">{report.title}</h4>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground font-mono">{report.generatedAt}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openGenerate(report.reportType, report); }}
                        className="p-1.5 text-muted-foreground hover:text-emerald-600 rounded-lg cursor-pointer"
                        title="Regenerate with same settings"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); exportReportCSV(report); }}
                        className="p-1.5 text-muted-foreground hover:text-primary rounded-lg cursor-pointer"
                        title="Export CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); exportReportPDF(report); }}
                        disabled={exporting === report.id}
                        className="p-1.5 text-muted-foreground hover:text-blue-600 rounded-lg cursor-pointer disabled:opacity-50"
                        title="Export PDF"
                      >
                        {exporting === report.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); requestDelete(report); }}
                        className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        title="Delete Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {preview && (
                    <p className="text-[11px] text-muted-foreground truncate">{preview}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showGenerate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowGenerate(false); }}
        >
          <form onSubmit={handleGenerate} className="bg-card border border-border p-6 rounded-2xl max-w-lg w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Generate {reportType} Report</h3>
                  <p className="text-xs text-muted-foreground">Compile academic data into a structured report</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowGenerate(false)} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Report Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {reportType === "Student Performance" && (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Target Student</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">
                      {loadingStudents
                        ? "Loading students..."
                        : students.length === 0
                          ? "No students enrolled in your subjects yet"
                          : "Select a student..."}
                    </option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {reportType === "Quiz Analytics" && (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Target Quiz (optional)</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{loadingQuizzes ? "Loading quizzes..." : "All quizzes"}</option>
                    {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.subjectName})</option>)}
                  </select>
                </div>
              )}

              {reportType === "Subject Summary" && (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Target Subject (optional)</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{loadingSubjects ? "Loading subjects..." : "All subjects"}</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {reportType === "AI Usage" && (
                <p className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
                  {isTeacher
                    ? "Generates an AI Usage report for your own generated content."
                    : "Generates an AI Usage report summarizing all AI-generated content across the platform."}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setShowGenerate(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{generating ? "Generating..." : "Generate Report"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" /> Delete Report
                </h3>
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to delete "{deleteTarget.title}"? This action cannot be undone.
                </p>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deleting ? "Deleting..." : "Yes, Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setViewing(null); }}
        >
          <div className="bg-card border border-border p-6 rounded-2xl max-w-2xl w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="space-y-1 min-w-0">
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                  {viewing.reportType}
                </span>
                <h3 className="text-lg font-bold text-foreground leading-snug">{viewing.title}</h3>
                <p className="text-[11px] text-muted-foreground">Generated {viewing.generatedAt}</p>
              </div>
              <button onClick={() => setViewing(null)} className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {renderDetails(viewing)}

              {summaryRows(viewing).length === 0 && !renderDetails(viewing) ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No summary data available for this report.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {summaryRows(viewing).map((row, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/60 text-xs">
                      <span className="font-bold text-foreground">{row.label}</span>
                      <span className="text-muted-foreground text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => exportReportCSV(viewing)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => exportReportPDF(viewing)}
                disabled={exporting === viewing.id}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                {exporting === viewing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
              </button>
              <button onClick={() => setViewing(null)} className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};