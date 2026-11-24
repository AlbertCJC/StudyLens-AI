import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import type { GeneratedReport } from "../../types";
import type { ReportType } from "./reportMeta";
import { ReportDeleteModal } from "./ReportDeleteModal";
import { ReportGenerateModal } from "./ReportGenerateModal";
import { ReportViewModal } from "./ReportViewModal";
import { ReportsList } from "./ReportsList";
import { exportReportCSV, filterReports, type QuizOption, type StudentOption, type SubjectOption } from "./reportUtils";

const REPORT_PAGE_SIZE = 50;

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
  const [refreshing, setRefreshing] = useState(false);

  const [reportsPage, setReportsPage] = useState(1);
  const [reportsTotal, setReportsTotal] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      const offset = (reportsPage - 1) * REPORT_PAGE_SIZE;
      const params = new URLSearchParams();
      params.set("limit", String(REPORT_PAGE_SIZE));
      params.set("offset", String(offset));
      const suffix = isTeacher && currentUser?.id ? `?generatedBy=${encodeURIComponent(currentUser.id)}&${params.toString()}` : `?${params.toString()}`;
      const res = await authFetch(`/api/reports${suffix}`);
      if (res.ok) {
        const data = await res.json();
        const reportList = Array.isArray(data.reports) ? data.reports : [];
        setReports(reportList);
        setReportsTotal(data.total || 0);
      } else {
        showToast("Failed to load reports.", "error");
      }
    } catch {
      showToast("Could not reach the report service.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isTeacher, currentUser, reportsPage]);

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
        setReportsTotal((prev) => prev + 1);
        setShowGenerate(false);
        showToast("Report generated");
      } else {
        showToast(data?.error || "Could not generate the report.", "error");
      }
    } catch {
      showToast("Report generation failed. Please try again.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const requestDelete = (report: GeneratedReport) => setDeleteTarget(report);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/reports/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData?.error || "Could not delete the report.", "error");
        return;
      }
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setReportsTotal((prev) => Math.max(0, prev - 1));
      if (filteredReports.length === 1 && reportsPage > 1) {
        setReportsPage((prev) => Math.max(1, prev - 1));
      }
      setDeleteTarget(null);
      showToast("Report deleted.");
    } catch {
      showToast("Could not delete the report.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReportsPage(1);
  }, [searchTerm, typeFilter]);

  const filteredReports = filterReports(reports, searchTerm, typeFilter);
  const hasFilters = searchTerm !== "" || typeFilter !== "all";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <ReportsList
        reports={reports}
        filteredReports={filteredReports}
        reportsTotal={reportsTotal}
        loading={loading}
        refreshing={refreshing}
        reportsPage={reportsPage}
        pageSize={REPORT_PAGE_SIZE}
        searchTerm={searchTerm}
        typeFilter={typeFilter}
        hasFilters={hasFilters}
        onRefresh={fetchReports}
        onSearchTermChange={setSearchTerm}
        onTypeFilterChange={setTypeFilter}
        onClearFilters={clearFilters}
        onGenerateType={(type) => openGenerate(type)}
        onView={setViewing}
        onEdit={(report) => openGenerate(report.reportType, report)}
        onExport={exportReportCSV}
        onDelete={requestDelete}
        onPrevPage={() => setReportsPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setReportsPage((p) => p + 1)}
      />

      {showGenerate && (
        <ReportGenerateModal
          reportType={reportType}
          title={title}
          targetId={targetId}
          students={students}
          quizzes={quizzes}
          subjects={subjects}
          loadingStudents={loadingStudents}
          loadingQuizzes={loadingQuizzes}
          loadingSubjects={loadingSubjects}
          isTeacher={isTeacher}
          generating={generating}
          onTitleChange={setTitle}
          onTargetIdChange={setTargetId}
          onSubmit={handleGenerate}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {deleteTarget && (
        <ReportDeleteModal
          report={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {viewing && (
        <ReportViewModal
          report={viewing}
          onClose={() => setViewing(null)}
          onExport={exportReportCSV}
        />
      )}
    </div>
  );
};
