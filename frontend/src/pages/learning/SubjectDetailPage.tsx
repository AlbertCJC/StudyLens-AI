import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  FileText,
  GraduationCap,
  Bell,
  Upload,
  Plus,
  Megaphone,
  Mail,
  Trash2,
  X,
  FileCode,
  Download,
  Eye,
  XCircle,
  Pencil,
  ShieldCheck,
  BarChart2,
  UserCheck,
  ChevronRight,
  ChevronDown,
  Flag,
  History,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../../context/AnnouncementsContext";
import { useToast } from "../../context/ToastContext";
import { AnnouncementComposer } from "../../components/AnnouncementComposer";
import { Pagination, slicePage } from "../../components/Pagination";
import { authFetch } from "../../utils/authFetch";
import type {
  Subject,
  LearningMaterial,
  MaterialFlag,
  Quiz,
  SubjectGrades,
} from "../../types";
import { QuizCreateModal } from "../../components/QuizCreateModal";

interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  studentId: string;
  dateEnrolled: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  studentId?: string | null;
}

type TabKey = "people" | "materials" | "quizzes" | "announcements" | "grades";

export const SubjectDetailPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { announcements, deleteAnnouncement } = useAnnouncements();
  const { showToast } = useToast();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [notFound, setNotFound] = useState(false);
  const initialTabParam = searchParams.get("tab") as TabKey | null;
  const validTabs: TabKey[] = ["people", "materials", "quizzes", "announcements", "grades"];
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTabParam && validTabs.includes(initialTabParam) ? initialTabParam : "people"
  );

  useEffect(() => {
    const t = searchParams.get("tab") as TabKey | null;
    if (t && validTabs.includes(t) && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Students
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  // Materials
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  // Material flags (review workflow)
  const [materialFlags, setMaterialFlags] = useState<MaterialFlag[]>([]);
  const [viewingFlags, setViewingFlags] = useState<LearningMaterial | null>(null);
  const [resolvingFlag, setResolvingFlag] = useState<MaterialFlag | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [flagTarget, setFlagTarget] = useState<LearningMaterial | null>(null);
  const [flagCategory, setFlagCategory] = useState("Wrong file");
  const [flagNote, setFlagNote] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const highlightMaterialId = searchParams.get("material");

  // Quizzes
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  // Grades
  const [grades, setGrades] = useState<SubjectGrades | null>(null);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [expandedGradeStudents, setExpandedGradeStudents] = useState<Record<string, boolean>>({});

  // Assign students (admin only)
  const [allStudents, setAllStudents] = useState<AdminUser[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assigningStudents, setAssigningStudents] = useState(false);

  // Upload Material Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadRawText, setUploadRawText] = useState("");
  const [uploading, setUploading] = useState(false);

  // Edit Material Modal
  const [materialToEdit, setMaterialToEdit] = useState<LearningMaterial | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRawText, setEditRawText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Create / Edit Quiz Modal
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState<Quiz | null>(null);

  // Post Announcement Modal
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<AnnouncementItem | null>(null);
  const [detailAnn, setDetailAnn] = useState<AnnouncementItem | null>(null);

  // Delete confirmations
  const [materialToDelete, setMaterialToDelete] = useState<LearningMaterial | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  // Pagination
  const [matPage, setMatPage] = useState(1);
  const [quizPage, setQuizPage] = useState(1);
  const [annPage, setAnnPage] = useState(1);
  const [peoplePage, setPeoplePage] = useState(1);

  // Flag review helpers
  const flagsForMaterial = (id: string): MaterialFlag[] => materialFlags.filter((f) => f.materialId === id);

  const reloadFlags = async () => {
    try {
      const res = await authFetch("/api/material-flags");
      if (res.ok) setMaterialFlags((await res.json()) as MaterialFlag[]);
    } catch (err) {
      console.error("Reload flags error:", err);
    }
  };

  const handleFlagMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagTarget) return;
    setFlagSubmitting(true);
    try {
      const res = await authFetch(`/api/materials/${flagTarget.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: flagCategory, note: flagNote.trim() }),
      });
      if (res.ok) {
        showToast(`Flagged "${flagTarget.title}" for review. The teacher has been notified.`, "success");
        setFlagTarget(null);
        setFlagNote("");
        setFlagCategory("Wrong file");
        await reloadFlags();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not flag the material.", "error");
      }
    } catch {
      showToast("Could not flag the material.", "error");
    } finally {
      setFlagSubmitting(false);
    }
  };

  const handleResolveFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingFlag) return;
    setResolving(true);
    try {
      const res = await authFetch(`/api/material-flags/${resolvingFlag.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote: resolutionNote.trim() }),
      });
      if (res.ok) {
        showToast("Flag marked as resolved. The admin has been notified.", "success");
        setResolvingFlag(null);
        setResolutionNote("");
        await reloadFlags();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not resolve the flag.", "error");
      }
    } catch {
      showToast("Could not resolve the flag.", "error");
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authFetch(`/api/subjects/${subjectId}`);
        if (!active) return;
        if (res.ok) {
          setSubject(await res.json());
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Fetch subject error:", err);
        if (active) setNotFound(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [subjectId]);

  useEffect(() => {
    if (!subject || !currentUser) return;
    let active = true;
    (async () => {
      const [sRes, mRes, qRes, gRes, fRes] = await Promise.all([
        authFetch(`/api/subjects/${subject.id}/students`),
        authFetch(`/api/materials?userId=${currentUser.id || ""}&userRole=${currentUser.role || ""}`),
        authFetch(`/api/quizzes?userId=${currentUser.id || ""}&userRole=${currentUser.role || ""}`),
        authFetch(`/api/subjects/${subject.id}/grades`),
        authFetch("/api/material-flags"),
      ]);
      if (!active) return;
      if (sRes.ok) setStudents((await sRes.json()) as EnrolledStudent[]);
      if (mRes.ok) {
        const all = (await mRes.json()) as LearningMaterial[];
        setMaterials(all.filter((m) => m.subjectId === subject.id));
        if (highlightMaterialId && all.some((m) => m.id === highlightMaterialId)) {
          setActiveTab("materials");
        }
      }
      if (qRes.ok) {
        const all = (await qRes.json()) as Quiz[];
        const staff =
          currentUser?.role === "admin" ||
          (currentUser?.role === "teacher" && currentUser.id === subject.teacherId);
        setQuizzes(all.filter((q) => q.subjectId === subject.id && (staff || q.isPublished !== false)));
      }
      if (gRes.ok) setGrades((await gRes.json()) as SubjectGrades);
      if (fRes.ok) setMaterialFlags((await fRes.json()) as MaterialFlag[]);
      setStudentsLoading(false);
      setMaterialsLoading(false);
      setQuizzesLoading(false);
      setGradesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [subject, currentUser, highlightMaterialId]);

  // Admin only: load the student directory for assignment + load subject grades.
  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin" || !subject) return;
    let active = true;
    const loadStudentsForAssign = async () => {
      try {
        const res = await authFetch("/api/users");
        if (active && res.ok) {
          const data = (await res.json()) as AdminUser[];
          setAllStudents(data.filter((u) => u.role === "student"));
        }
      } catch (err) {
        console.error("Fetch students error:", err);
      }
    };
    loadStudentsForAssign();
    return () => {
      active = false;
    };
  }, [currentUser, subject]);

  const resolveFileUrl = (mat: LearningMaterial): string | null => {
    const url = mat.fileUrl;
    if (!url) return null;
    if (/^(https?:)?\/\//i.test(url)) return url;
    if (url.startsWith("/")) return url;
    return `/${url.replace(/^\.?\//, "")}`;
  };

  const isRenderable = (mat: LearningMaterial): boolean => {
    const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "mp4", "webm", "ogg", "mov"].includes(ext);
  };

  const openFile = (mat: LearningMaterial) => {
    const url = resolveFileUrl(mat);
    if (!url) return;
    if (isRenderable(mat)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = mat.title || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Text-based materials download as a PDF rendered from their extracted content.
  const downloadMaterialAsPdf = async (mat: LearningMaterial) => {
    try {
      const res = await authFetch("/api/convert-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mat.title || "Learning Material",
          // Mirror the on-screen preview: meta line under the heading, then
          // description and extracted text as separate paragraphs.
          metaLine: [
            (mat.fileType || "").toUpperCase(),
            mat.fileSize,
            mat.uploadedBy ? `Uploaded by ${mat.uploadedBy}` : "",
          ]
            .filter(Boolean)
            .join("  •  "),
          content: [mat.description, mat.extractedText].filter(Boolean).join("\n\n"),
        }),
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mat.title || "material"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Material downloaded as PDF.", "success");
    } catch {
      showToast("Could not generate the PDF. Opening the original file instead.", "error");
      openFile(mat);
    }
  };

  // Inline material preview modal state
  const [viewingMaterial, setViewingMaterial] = useState<LearningMaterial | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  const groupAttemptsByQuiz = <T extends { id: string; quizTitle: string }>(attempts: T[]) => {
    const groups: { title: string; entries: T[] }[] = [];
    for (const att of attempts) {
      let g = groups.find((x) => x.title === att.quizTitle);
      if (!g) {
        g = { title: att.quizTitle, entries: [] };
        groups.push(g);
      }
      g.entries.push(att);
    }
    return groups;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !uploadRawText.trim()) {
      showToast("Upload a file or paste lecture text.", "error");
      return;
    }
    if (!subject) return;
    setUploading(true);
    try {
      const formData = new FormData();
      if (uploadFile) formData.append("file", uploadFile);
      formData.append("title", uploadTitle || uploadFile?.name || "Uploaded Lecture Material");
      formData.append("description", uploadDescription || "Course lecture material");
      formData.append("subjectId", subject.id);
      formData.append("textInput", uploadRawText);
      formData.append("uploadedBy", currentUser?.name || "Faculty Instructor");
      formData.append("uploaderRole", currentUser?.role || "teacher");
      formData.append("uploaderId", currentUser?.id || "usr-teacher-1");
      formData.append("materialType", "course");

      const res = await authFetch("/api/materials/upload", { method: "POST", body: formData });
      if (res.ok) {
        const created = (await res.json()) as LearningMaterial;
        setMaterials((prev) => [created, ...prev]);
        setSubject((prev) => (prev ? { ...prev, materialCount: prev.materialCount + 1 } : prev));
        setUploadFile(null);
        setUploadTitle("");
        setUploadDescription("");
        setUploadRawText("");
        setShowUploadModal(false);
        showToast("Material uploaded successfully.");
      } else {
        const errText = await res.text().catch(() => "");
        let msg = "Upload failed.";
        try {
          msg = JSON.parse(errText)?.error || errText || msg;
        } catch {
          msg = errText || msg;
        }
        showToast(msg, "error");
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      showToast("Upload error: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (mat: LearningMaterial) => {
    try {
      const res = await authFetch(`/api/materials/${mat.id}`, { method: "DELETE" });
      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== mat.id));
        setMaterialToDelete(null);
        showToast("Material deleted.");
      }
    } catch (err) {
      console.error("Delete material error:", err);
      showToast("Could not delete the material. Please try again.", "error");
    }
  };

  const openEditMaterial = (mat: LearningMaterial) => {
    setMaterialToEdit(mat);
    setEditTitle(mat.title);
    setEditDescription(mat.description || "");
    setEditRawText(mat.extractedText || "");
  };

  const handleUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialToEdit || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const res = await authFetch(`/api/materials/${materialToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription,
          textInput: editRawText,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as LearningMaterial;
        setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setMaterialToEdit(null);
        showToast("Material updated successfully.");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Could not update the material.", "error");
      }
    } catch (err) {
      console.error("Update material error:", err);
      showToast("Update failed. Please try again.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditQuiz = (quiz: Quiz) => {
    setQuizToEdit(quiz);
    setShowQuizModal(true);
  };

  const handleToggleQuizPublish = async (quiz: Quiz) => {
    try {
      const res = await authFetch(`/api/quizzes/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !quiz.isPublished }),
      });
      if (res.ok) {
        setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? { ...q, isPublished: !q.isPublished } : q)));
        showToast(quiz.isPublished ? "Quiz unpublished." : "Quiz published.");
      }
    } catch (err) {
      console.error("Toggle quiz publish error:", err);
      showToast("Could not update the quiz visibility. Please try again.", "error");
    }
  };

  const handleDeleteQuiz = async (quiz: Quiz) => {
    try {
      const res = await authFetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
        setQuizToDelete(null);
        showToast("Quiz deleted.");
      }
    } catch (err) {
      console.error("Delete quiz error:", err);
      showToast("Could not delete the quiz. Please try again.", "error");
    }
  };

  const openEditAnnouncement = (ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setShowAnnounceModal(true);
  };

  const openAssignStudents = () => {
    setSelectedStudentIds(new Set(students.map((s) => s.id)));
    setShowAssignModal(true);
  };

  const toggleAssignStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleSaveAssignment = async () => {
    if (!subject) return;
    setAssigningStudents(true);
    const enrolled = new Set(students.map((s) => s.id));
    const toAdd = Array.from(selectedStudentIds).filter((id) => !enrolled.has(id));
    const toRemove = Array.from(enrolled).filter((id) => !selectedStudentIds.has(id));
    try {
      if (toAdd.length > 0) {
        const res = await authFetch(`/api/subjects/${subject.id}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: toAdd }),
        });
        if (!res.ok) throw new Error("Could not assign the selected students.");
      }
      if (toRemove.length > 0) {
        const res = await authFetch(`/api/subjects/${subject.id}/students`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: toRemove }),
        });
        if (!res.ok) throw new Error("Could not remove the selected students.");
      }
      const res = await authFetch(`/api/subjects/${subject.id}/students`);
      if (res.ok) setStudents((await res.json()) as EnrolledStudent[]);
      setShowAssignModal(false);
      showToast("Student enrollment updated.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update the roster.", "error");
    } finally {
      setAssigningStudents(false);
    }
  };

  const subjectAnnouncements = subject
    ? announcements.filter((a) => a.subjectId === subject.id)
    : [];

  if (notFound) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <div className="bg-card rounded-2xl border border-border p-10">
          <FileCode className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-bold text-foreground mt-4">Subject not found</h2>
          <p className="text-xs text-muted-foreground mt-1">
            This subject may have been deleted, or you do not have permission to view it.
          </p>
          <button
            onClick={() => navigate("/subjects")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Back to Subjects
          </button>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-xs text-muted-foreground py-10">Loading subject workspace...</p>
      </div>
    );
  }

  const isStaff =
    currentUser?.role === "admin" ||
    (currentUser?.role === "teacher" && currentUser.id === subject.teacherId);
  const canManage = currentUser?.role === "teacher" && currentUser.id === subject.teacherId;
  const isStudent = currentUser?.role === "student";

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "people", label: "People", icon: Users, count: students.length + 1 },
    { key: "materials", label: "Materials", icon: FileText, count: materials.length },
    { key: "quizzes", label: "Quizzes", icon: GraduationCap, count: quizzes.length },
    { key: "announcements", label: "Announcements", icon: Bell, count: subjectAnnouncements.length },
    { key: "grades", label: "Grades", icon: BarChart2, count: isStaff ? grades?.students?.length : grades?.attemptCount },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate("/subjects")}
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Subjects</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center space-x-2 flex-wrap">
            <h1 className="text-base font-bold text-foreground leading-tight truncate">{subject.name}</h1>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold rounded-md">
              {subject.code}
            </span>
            {subject.semester && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-md uppercase tracking-wide">
                {subject.semester} • {subject.schoolYear || ""}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight max-w-2xl truncate">
            {subject.description || `Managed by ${isStaff ? "the faculty" : "your instructor"} • ${subject.studentCount} students • ${subject.materialCount} materials`}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {currentUser?.role !== "admin" && (
            <>
              <Link
                to="/materials"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{canManage ? "Manage Materials" : "View Materials"}</span>
              </Link>
              <Link
                to={isStudent ? `/assessments?quizId=${quizzes[0]?.id || ""}` : "/assessments"}
                className="px-3 py-2 border border-blue-300/60 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{canManage ? "Manage Quizzes" : "Take Quizzes"}</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {(tab.count ?? 0) > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== People Tab ===== */}
      {activeTab === "people" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>People in this Subject</span>
            </h2>
            <span className="flex items-center space-x-2">
              {currentUser?.role === "admin" && (
                <button
                  onClick={openAssignStudents}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assign Students</span>
                </button>
              )}
            </span>
          </div>

          {/* Assigned Teacher */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{subject.teacherName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Assigned instructor for this subject
                </p>
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold text-muted-foreground pt-1">
            Enrolled Students ({students.length})
          </div>

          {studentsLoading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading enrolled students...</p>
          ) : students.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No students are enrolled in this subject yet.
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-semibold">Student</th>
                    <th className="py-2 pr-4 font-semibold">Student ID</th>
                    <th className="py-2 font-semibold">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {slicePage(students, peoplePage).map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-4 font-bold text-foreground">{s.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-muted-foreground">{s.studentId || "â€”"}</td>
                      <td className="py-2.5 text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.email || "â€”"}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={peoplePage}
              total={students.length}
              onPageChange={(p) => setPeoplePage(p)}
            />
            </>
          )}
        </div>
      )}

      {/* ===== Materials Tab ===== */}
      {activeTab === "materials" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Uploaded Materials</span>
            </h2>
            {canManage && (
              <button
                onClick={() => {
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Material</span>
              </button>
            )}
          </div>

          {materialsLoading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading materials...</p>
          ) : materials.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No materials uploaded for this subject yet. Upload lecture notes, slide decks, or PDFs.
            </p>
          ) : (
            <>
            {highlightMaterialId && materials.some((m) => m.id === highlightMaterialId) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/40 text-xs font-semibold text-primary">
                <Flag className="w-3.5 h-3.5" />
                <span>
                  Reviewing "{materials.find((m) => m.id === highlightMaterialId)?.title}" from your notification.
                </span>
              </div>
            )}
            <div className="space-y-2.5">
              {slicePage(materials, matPage).map((mat) => {
                const matFlags = flagsForMaterial(mat.id);
                const pendingFlag = matFlags.find((f) => f.status === "pending");
                const resolvedFlags = matFlags.filter((f) => f.status === "resolved");
                const highlighted = mat.id === highlightMaterialId;
                return (
                <div
                  key={mat.id}
                  className={`rounded-xl border transition-all ${
                    pendingFlag
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-border bg-muted/30"
                  } ${highlighted ? "ring-2 ring-primary/60" : ""}`}
                >
                  <div
                    onClick={() => setViewingMaterial(mat)}
                    className="flex items-center justify-between p-3.5 rounded-xl gap-3 cursor-pointer hover:bg-muted/50 transition-all"
                    title="View material"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{mat.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {mat.fileType?.toUpperCase() || "TEXT"} {mat.fileSize ? `• ${mat.fileSize}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      {resolveFileUrl(mat) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isRenderable(mat)) openFile(mat);
                            else downloadMaterialAsPdf(mat);
                          }}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                          title={isRenderable(mat) ? "Open" : "Download as PDF"}
                        >
                          {isRenderable(mat) ? <Eye className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                        </button>
                      )}
                      {currentUser?.role === "admin" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlagTarget(mat);
                            setFlagCategory("Wrong file");
                            setFlagNote("");
                          }}
                          disabled={!!pendingFlag}
                          className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={pendingFlag ? "Already flagged" : "Flag for review"}
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditMaterial(mat); }}
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                            title="Edit Material"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMaterialToDelete(mat); }}
                            className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {matFlags.length > 0 && (
                    <div className="px-3.5 pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start space-x-2 min-w-0">
                        <span
                          className={`p-1 rounded-lg shrink-0 ${
                            pendingFlag
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {pendingFlag ? <Flag className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          {pendingFlag ? (
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 leading-snug">
                              Pending review Â· {pendingFlag.category}
                              {pendingFlag.note ? ` â€” "${pendingFlag.note}"` : ""}
                            </p>
                          ) : (
                            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
                              Resolved Â· {resolvedFlags.length} flag{resolvedFlags.length > 1 ? "s" : ""} addressed
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Flagged by {pendingFlag?.flaggedByName || resolvedFlags[resolvedFlags.length - 1]?.flaggedByName || "Admin"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingFlags(mat);
                          }}
                          className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                          title="View flag history"
                        >
                          <History className="w-3 h-3" />
                          <span>History</span>
                        </button>
                        {pendingFlag && canManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setResolvingFlag(pendingFlag);
                              setResolutionNote("");
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                            title="Resolve this flag"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Mark Resolved</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            <Pagination
              page={matPage}
              total={materials.length}
              onPageChange={(p) => setMatPage(p)}
            />
            </>
          )}
        </div>
      )}

      {/* ===== Quizzes Tab ===== */}
      {activeTab === "quizzes" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Quizzes & Assessments</span>
            </h2>
            {canManage && (
              <button
                onClick={() => {
                  setQuizToEdit(null);
                  setShowQuizModal(true);
                }}
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
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30 gap-3"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewQuiz(quiz)}
                    className="min-w-0 flex-1 text-left cursor-pointer group"
                    title="View quiz details"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{quiz.title}</p>
                      {(quiz.attemptsUsed ?? 0) > 0 && (
                        <span
                          className="text-sm font-bold text-primary shrink-0 tabular-nums"
                          title="Latest attempt score"
                        >
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
                          onClick={() => handleToggleQuizPublish(quiz)}
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
                          onClick={() => openEditQuiz(quiz)}
                          className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                          title="Edit Quiz"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setQuizToDelete(quiz)}
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
                          onClick={() =>
                            navigate(
                              `/assessments?quizId=${quiz.id}&returnTo=${encodeURIComponent(`/subjects/${subjectId}?tab=quizzes`)}`
                            )
                          }
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

            <Pagination
              page={quizPage}
              total={quizzes.length}
              onPageChange={(p) => setQuizPage(p)}
            />
            </>
          )}
        </div>
      )}

      {/* ===== Announcements Tab ===== */}
      {activeTab === "announcements" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Class Announcements</span>
            </h2>
            {canManage && (
              <button
                onClick={() => {
                  setEditingAnn(null);
                  setShowAnnounceModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Post Announcement</span>
              </button>
            )}
          </div>

          {subjectAnnouncements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No announcements posted for this subject yet.
            </p>
          ) : (
            <>
            <div className="space-y-2.5">
              {slicePage(subjectAnnouncements, annPage).map((a) => {
                const canManageAnn =
                  (a.authorId && a.authorId === currentUser?.id) ||
                  (currentUser?.role === "teacher" && currentUser.id === subject.teacherId);
                return (
                <div key={a.id} onClick={() => setDetailAnn(a)} className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1.5 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{a.title}</p>
                      {a.subjectName && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                          {a.subjectName}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full shrink-0 ${
                        a.priority === "high"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : a.priority === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-slate-500/10 text-muted-foreground"
                      }`}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{a.content}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {a.authorName} • {a.createdAt}
                    </p>
                    {canManageAnn && (
                      <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditAnnouncement(a)}
                          className="p-1.5 text-amber-600 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                          title="Edit Announcement"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAnnouncementToDelete(a)}
                          className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <Pagination
              page={annPage}
              total={subjectAnnouncements.length}
              onPageChange={(p) => setAnnPage(p)}
            />
            </>
          )}
        </div>
      )}

      {/* ===== Grades Tab ===== */}
      {activeTab === "grades" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Quiz Grades & Final Grade</span>
          </h2>

          {gradesLoading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading grades...</p>
          ) : isStaff ? (
            grades?.students && grades.students.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No quiz attempts recorded for this subject yet.
              </p>
            ) : (
              <div className="space-y-3">
                {(grades?.students || []).map((st) => {
                  const isExpanded = !!expandedGradeStudents[st.studentId];
                  return (
                    <div key={st.studentId} className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGradeStudents((prev) => ({ ...prev, [st.studentId]: !isExpanded }))
                        }
                        className="w-full flex items-center justify-between gap-3 cursor-pointer group"
                        title={isExpanded ? "Hide grades" : "Show grades"}
                      >
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {st.studentName}
                        </p>
                        <span className="text-muted-foreground shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] text-muted-foreground">{st.attemptCount} attempt(s)</p>
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                                st.averagePercentage >= 75
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : st.averagePercentage >= 60
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              Final Grade: {st.averagePercentage}%
                            </span>
                          </div>
                          {st.attempts.length > 0 && (
                            <div className="space-y-2.5 pt-1">
                              {groupAttemptsByQuiz(st.attempts).map((grp) => (
                                <div key={grp.entries[0].id} className="space-y-1">
                                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/60">
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold text-foreground truncate">
                                        {grp.title}
                                        {grp.entries.length > 1 && (
                                          <span className="ml-1.5 text-[9px] font-bold uppercase text-primary">Latest</span>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">{grp.entries[0].completedAt}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 shrink-0">
                                      <span className="text-[11px] font-mono font-bold text-foreground">
                                        {grp.entries[0].score}/{grp.entries[0].maxScore}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                                          grp.entries[0].passed
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                        }`}
                                      >
                                        {grp.entries[0].percentage}%
                                      </span>
                                    </div>
                                  </div>
                                  {grp.entries.slice(1).map((att) => (
                                    <div
                                      key={att.id}
                                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40 ml-4"
                                    >
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        Previous attempt • {att.completedAt}
                                      </p>
                                      <div className="flex items-center space-x-2 shrink-0">
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                          {att.score}/{att.maxScore}
                                        </span>
                                        <span className={`text-[10px] font-bold ${att.passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                          {att.percentage}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {grades && (grades.attempts || []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  You haven't taken any quizzes in this subject yet. Take a quiz to see your grade.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Final Grade (average of all quiz scores)
                      </p>
                      <p className="text-3xl font-black text-foreground mt-1">
                        {grades?.averagePercentage || 0}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {grades?.attemptCount || 0} quiz attempt(s)
                      </p>
                    </div>
                    <BarChart2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>

                  <div className="space-y-3">
                    {groupAttemptsByQuiz(grades?.attempts || []).map((grp) => (
                      <div key={grp.entries[0].id} className="space-y-1.5">
                        <div
                          className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30 gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {grp.title}
                              {grp.entries.length > 1 && (
                                <span className="ml-1.5 text-[9px] font-bold uppercase text-primary">Latest</span>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{grp.entries[0].completedAt}</p>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[11px] font-mono font-bold text-foreground">
                              {grp.entries[0].score}/{grp.entries[0].maxScore}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                grp.entries[0].passed
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {grp.entries[0].percentage}%
                            </span>
                          </div>
                        </div>
                        {grp.entries.slice(1).map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40 ml-5 gap-3"
                          >
                            <p className="text-[10px] text-muted-foreground truncate">
                              Previous attempt • {att.completedAt}
                            </p>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {att.score}/{att.maxScore}
                              </span>
                              <span className={`text-[10px] font-bold ${att.passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {att.percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== Upload Material Modal ===== */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowUploadModal(false);
          }}
        >
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-foreground">Upload Material</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">File (PDF, DOCX, PPTX, TXT)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-bold file:cursor-pointer cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Graph Algorithms Lecture Notes"
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief summary of the material..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Or paste lecture text</label>
                <textarea
                  rows={3}
                  value={uploadRawText}
                  onChange={(e) => setUploadRawText(e.target.value)}
                  placeholder="Paste text content to create a text-based study material..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit Material Modal ===== */}
      {materialToEdit && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMaterialToEdit(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-foreground">Edit Material</h3>
              <button
                onClick={() => setMaterialToEdit(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateMaterial} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g., Graph Algorithms Lecture Notes"
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Brief summary of the material..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Text content</label>
                <textarea
                  rows={6}
                  value={editRawText}
                  onChange={(e) => setEditRawText(e.target.value)}
                  placeholder="Paste or edit the text content used for study..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setMaterialToEdit(null)}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuizModal && (
        <QuizCreateModal
          open={showQuizModal}
          onClose={() => setShowQuizModal(false)}
          onSaved={(saved) => {
            setQuizzes((prev) =>
              prev.some((q) => q.id === saved.id)
                ? prev.map((q) => (q.id === saved.id ? saved : q))
                : [saved, ...prev]
            );
            setQuizToEdit(null);
          }}
          subjects={subject ? [subject] : []}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name}
          canManageCourseQuizzes={canManage}
          defaultScope="teacher"
          lockSubject
          initialSubjectId={subject?.id}
          initialSubjectName={subject ? `${subject.code} - ${subject.name}` : undefined}
          quizToEdit={quizToEdit}
          onOpenAI={() => navigate("/ai-assistant")}
        />
      )}


      <AnnouncementComposer
        open={showAnnounceModal}
        onClose={() => { setShowAnnounceModal(false); setEditingAnn(null); }}
        editingAnn={editingAnn}
        presetSubjectId={subject?.id}
        presetSubjectName={subject ? `${subject.code} - ${subject.name}` : undefined}
      />

      {/* ===== Assign Students Modal (admin only) ===== */}
      {showAssignModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAssignModal(false);
          }}
        >
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Assign Students</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select which students to enroll in {subject.code} - {subject.name}
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                {selectedStudentIds.size} selected of {allStudents.length} students
              </p>
              <button
                onClick={() =>
                  setSelectedStudentIds(
                    selectedStudentIds.size === allStudents.length
                      ? new Set()
                      : new Set(allStudents.map((s) => s.id))
                  )
                }
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {selectedStudentIds.size === allStudents.length ? "Clear all" : "Select all"}
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No student accounts found. Create student accounts from the admin dashboard.
                </p>
              ) : (
                allStudents.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.id)}
                        onChange={() => toggleAssignStudent(s.id)}
                        className="accent-blue-600 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg shrink-0">
                      {s.studentId || "â€”"}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                disabled={assigningStudents}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
              >
                {assigningStudents ? "Saving..." : "Save Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Material Confirm */}
      {materialToDelete && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMaterialToDelete(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-xl border border-border space-y-4">
            <h3 className="text-base font-bold text-foreground">Delete this material?</h3>
            <p className="text-xs text-muted-foreground">
              "{materialToDelete.title}" will be permanently removed from this subject.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMaterial(materialToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Quiz Confirm */}
      {quizToDelete && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQuizToDelete(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-xl border border-border space-y-4">
            <h3 className="text-base font-bold text-foreground">Delete this quiz?</h3>
            <p className="text-xs text-muted-foreground">
              "{quizToDelete.title}" and its records will be permanently removed.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setQuizToDelete(null)}
                className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteQuiz(quizToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Delete
              </button>
              </div>
          </div>
        </div>
      )}

      {announcementToDelete && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAnnouncementToDelete(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-xl border border-border space-y-4">
            <h3 className="text-base font-bold text-foreground">Delete this announcement?</h3>
            <p className="text-xs text-muted-foreground">
              "{announcementToDelete.title}" will be permanently removed for everyone.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setAnnouncementToDelete(null)}
                className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = announcementToDelete;
                  setAnnouncementToDelete(null);
                  deleteAnnouncement(target.id);
                  showToast("Announcement deleted.");
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Delete
              </button>
             </div>
          </div>
        </div>
      )}

      {/* Announcement Detail Modal */}
      {detailAnn && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setDetailAnn(null)}
        >
          <div
            className="bg-card border border-border p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 flex-wrap gap-1">
                  <span
                    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                      detailAnn.priority === "high"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : detailAnn.priority === "medium"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    }`}
                  >
                    {detailAnn.priority.toUpperCase()}
                  </span>
                  {detailAnn.subjectName && (
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {detailAnn.subjectName}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-foreground leading-snug">{detailAnn.title}</h2>
              </div>
              <button
                onClick={() => setDetailAnn(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{detailAnn.authorName}</p>
                  <p className="text-[10px] text-muted-foreground">Announcement Author</p>
                </div>
              </div>
              <span className="font-medium text-foreground">{detailAnn.createdAt}</span>
            </div>

            <div className="bg-muted/20 p-4 rounded-xl border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {detailAnn.content}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={() => setDetailAnn(null)}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Preview Modal */}
      {viewingMaterial && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingMaterial(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">{viewingMaterial.title}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {viewingMaterial.fileType?.toUpperCase() || "TEXT"}
                  {viewingMaterial.fileSize ? ` • ${viewingMaterial.fileSize}` : ""} • {viewingMaterial.uploadedBy}
                </p>
              </div>
              <button
                onClick={() => setViewingMaterial(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer shrink-0"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {viewingMaterial.description && (
              <p className="text-xs text-muted-foreground">{viewingMaterial.description}</p>
            )}

            <div className="rounded-xl border border-border bg-muted/20 p-4 max-h-[45vh] overflow-y-auto">
              {viewingMaterial.extractedText ? (
                <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {viewingMaterial.extractedText}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No readable text preview is available for this material. Use the button below to open or download the
                  original file.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2 flex-wrap">
              {resolveFileUrl(viewingMaterial) && isRenderable(viewingMaterial) && (
                <button
                  onClick={() => openFile(viewingMaterial)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Open Original
                </button>
              )}
              {resolveFileUrl(viewingMaterial) && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const url = resolveFileUrl(viewingMaterial);
                    if (!url) return;
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = viewingMaterial.title || "material";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="px-4 py-2 border border-primary/50 text-primary hover:bg-primary/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Save the original uploaded file"
                >
                  Download Original
                </button>
              )}
              {!isRenderable(viewingMaterial) && (
                <button
                  onClick={() => downloadMaterialAsPdf(viewingMaterial)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Download the material content as PDF"
                >
                  Download as PDF
                </button>
              )}
              <button
                onClick={() => setViewingMaterial(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Preview Modal */}
      {previewQuiz &&
        (() => {
          const pq = previewQuiz;
          const pqIsCourseQuiz = (pq.quizType || (pq.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";
          const pqExhausted =
            pqIsCourseQuiz && (pq.attemptsAllowed || 0) > 0 && (pq.attemptsUsed || 0) >= (pq.attemptsAllowed || 0);
          const pqOverdue = !!pq.deadline && new Date(pq.deadline).getTime() < Date.now();
          return (
            <div
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={(e) => {
                if (e.target === e.currentTarget) setPreviewQuiz(null);
              }}
            >
              <div className="bg-card border border-border rounded-2xl max-w-2xl w-full shadow-xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border p-5 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        {pq.subjectName ? (
                          <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-mono text-[10px] font-bold rounded-md uppercase tracking-wider">
                            {pq.subjectName}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 font-mono text-[10px] font-bold rounded-md uppercase tracking-wider border border-amber-500/30">
                            Unassigned
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground font-mono text-[10px] font-bold rounded-md uppercase tracking-wider">
                          {pqIsCourseQuiz ? "Course Quiz" : "Practice Quiz"}
                        </span>
                        {pqOverdue && (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 font-mono text-[10px] font-bold rounded-md uppercase tracking-wider border border-rose-500/30">
                            Deadline Passed
                          </span>
                        )}
                        {(pq.attemptsUsed ?? 0) > 0 && (
                          <span className="text-base font-bold text-primary ml-auto shrink-0 tabular-nums">
                            {pq.lastScoreRaw ?? 0}/{pq.lastMaxScore ?? 0}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">{pq.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {pq.questions?.length || 0} Questions Â· {pq.timeLimitMinutes || 15} min Â· Pass {pq.passPercentage || 70}% Â· {pq.difficulty || "medium"}
                        {pq.deadline && ` Â· Due ${new Date(pq.deadline).toLocaleString()}`}
                        {pqIsCourseQuiz && (
                          <span className={pqExhausted ? " text-rose-600 font-semibold" : ""}>
                            {" Â· "}
                            {(pq.attemptsAllowed || 0) > 0
                              ? `${pq.attemptsUsed || 0}/${pq.attemptsAllowed} attempts`
                              : "Unlimited attempts"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewQuiz(null)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {pq.description && (
                  <div className="px-5">
                    <p className="text-xs text-muted-foreground leading-relaxed">{pq.description}</p>
                  </div>
                )}

                <div className="px-5 overflow-y-auto space-y-3 pr-3 flex-1">
                  {isStaff ? (
                    pq.questions && pq.questions.length > 0 ? (
                      pq.questions.map((q, idx) => (
                        <div key={q.id || idx} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground text-xs">Question {idx + 1}</span>
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold rounded uppercase tracking-wider">
                              {q.type === "multiple_choice"
                                ? Array.isArray(q.correctAnswer)
                                  ? "Multiple Select"
                                  : "Multiple Choice"
                                : q.type === "true_false"
                                  ? "True / False"
                                  : "Identification"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-snug">{q.question}</p>
                          {q.type === "multiple_choice" && q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-start space-x-1.5 text-xs text-muted-foreground">
                                  <span className="font-bold text-foreground">{String.fromCharCode(65 + oIdx)}.</span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {q.type === "true_false" && (
                            <div className="text-xs text-muted-foreground flex items-center space-x-2">
                              <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-bold">True</span>
                              <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-bold">False</span>
                            </div>
                          )}
                          {q.topicTag && (
                            <div className="flex items-center space-x-1.5">
                              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase tracking-wider">{q.topicTag}</span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center space-y-2">
                        <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                        <p className="text-sm font-semibold text-foreground">No questions in this quiz yet.</p>
                      </div>
                    )
                  ) : (
                    <div className="py-10 text-center space-y-2">
                      <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                      <p className="text-sm font-semibold text-foreground">Questions hidden until you start</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        The questions and answer choices for this quiz are revealed only when you take it.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border p-5 pt-3 flex-wrap">
                  <div className="flex items-center space-x-2 flex-wrap">
                    {canManage && (
                      <>
                        {pq.subjectId && pq.subjectId !== "personal" && (
                          <button
                            onClick={() => {
                              handleToggleQuizPublish(pq);
                              setPreviewQuiz(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              pq.isPublished
                                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            }`}
                            title={pq.isPublished ? "Unpublish Quiz" : "Publish Quiz"}
                          >
                            {pq.isPublished ? "Unpublish" : "Publish"}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            openEditQuiz(pq);
                            setPreviewQuiz(null);
                          }}
                          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                          title="Edit Quiz details & questions"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setQuizToDelete(pq);
                            setPreviewQuiz(null);
                          }}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                          title="Delete Quiz"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isStaff &&
                      (pqExhausted ? (
                        <span className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold cursor-not-allowed">
                          Attempts exhausted
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            const q = pq;
                            setPreviewQuiz(null);
                            navigate(
                              `/assessments?quizId=${q.id}&returnTo=${encodeURIComponent(`/subjects/${subjectId}?tab=quizzes`)}`
                            );
                          }}
                          disabled={pqOverdue && (pq.attemptsUsed ?? 0) === 0}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span>{(pq.attemptsUsed ?? 0) > 0 ? "Retake Quiz" : "Take Quiz"}</span>
                        </button>
                      ))}
                    <button
                      onClick={() => setPreviewQuiz(null)}
                      className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Flag Dialog */}
      {flagTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setFlagTarget(null)}>
          <form
            onSubmit={handleFlagMaterial}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-foreground">Flag Material for Review</h3>
                <p className="text-xs text-muted-foreground">The teacher will be notified with this reason.</p>
              </div>
              <button
                type="button"
                onClick={() => setFlagTarget(null)}
                className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 border border-border rounded-xl">
              <p className="font-bold text-foreground text-sm truncate">{flagTarget.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{flagTarget.subjectName || "Unassigned"}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Category</label>
              <select
                value={flagCategory}
                onChange={(e) => setFlagCategory(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option>Wrong file</option>
                <option>Wrong subject</option>
                <option>Incomplete content</option>
                <option>Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Note (optional)</label>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                rows={3}
                placeholder="e.g. The uploaded content belongs to a different subject."
                className="w-full px-3 py-2 border border-border bg-muted/30 text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFlagTarget(null)}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={flagSubmitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                {flagSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                <span>{flagSubmitting ? "Flagging..." : "Flag Material"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Flag History Modal */}
      {viewingFlags && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingFlags(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                  <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Flag History</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{viewingFlags.title}</p>
              </div>
              <button
                onClick={() => setViewingFlags(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {flagsForMaterial(viewingFlags.id).length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No flags have been raised on this material.
              </p>
            ) : (
              <div className="space-y-3">
                {flagsForMaterial(viewingFlags.id).map((flag) => (
                  <div key={flag.id} className="p-3.5 border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          flag.status === "pending"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {flag.status === "pending" ? "Pending" : "Resolved"} Â· {flag.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(flag.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Flagged by: {flag.flaggedByName || flag.flaggedById}</p>
                    {flag.note && <p className="text-xs text-foreground">"{flag.note}"</p>}
                    {flag.status === "resolved" && (
                      <div className="pt-2 border-t border-border space-y-1">
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Resolved by: {flag.resolvedByName || flag.resolvedById || "â€”"}
                        </p>
                        {flag.resolutionNote && (
                          <p className="text-[11px] text-muted-foreground">Resolution note: "{flag.resolutionNote}"</p>
                        )}
                        {flag.resolvedAt && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {new Date(flag.resolvedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingFlags(null)}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Flag Modal */}
      {resolvingFlag && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResolvingFlag(null);
          }}
        >
          <form
            onSubmit={handleResolveFlag}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Resolve Flag</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  The admin who flagged this material will be notified.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolvingFlag(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-0.5">
              <p className="text-xs font-bold text-foreground">
                {resolvingFlag.category}
                {resolvingFlag.note ? ` â€” "${resolvingFlag.note}"` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Flagged by {resolvingFlag.flaggedByName || "Admin"} on {new Date(resolvingFlag.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Resolution note (optional)</label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                placeholder="e.g. Replaced with the corrected file."
                className="w-full px-3 py-2 border border-border bg-muted/30 text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setResolvingFlag(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resolving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                {resolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{resolving ? "Resolving..." : "Mark Resolved"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
