import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Users, FileText, GraduationCap, Bell, BarChart2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../../../context/AnnouncementsContext";
import { useToast } from "../../../context/ToastContext";
import { authFetch } from "../../../utils/authFetch";
import type { LearningMaterial, MaterialFlag, Quiz, Subject, SubjectGrades } from "../../../types";
import type { EnrolledStudent, AdminUser, TabKey } from "./subjectDetailUtils";
import {
  flagsForMaterial,
  resolveFileUrl,
  isRenderable,
  isAiMaterial,
  groupAttemptsByQuiz,
} from "./subjectDetailUtils";

export function useSubjectDetailPage() {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && validTabs.includes(t) && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

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

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  const [grades, setGrades] = useState<SubjectGrades | null>(null);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [expandedGradeStudents, setExpandedGradeStudents] = useState<Record<string, boolean>>({});

  const [allStudents, setAllStudents] = useState<AdminUser[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assigningStudents, setAssigningStudents] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadRawText, setUploadRawText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const [materialToEdit, setMaterialToEdit] = useState<LearningMaterial | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRawText, setEditRawText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState<Quiz | null>(null);

  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<AnnouncementItem | null>(null);
  const [detailAnn, setDetailAnn] = useState<AnnouncementItem | null>(null);

  const [materialToDelete, setMaterialToDelete] = useState<LearningMaterial | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  const [matPage, setMatPage] = useState(1);
  const [quizPage, setQuizPage] = useState(1);
  const [annPage, setAnnPage] = useState(1);
  const [peoplePage, setPeoplePage] = useState(1);

  const [viewingMaterial, setViewingMaterial] = useState<LearningMaterial | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

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

  const uploadDirty =
    !!uploadFile || uploadTitle.trim().length > 0 || uploadDescription.trim().length > 0 || uploadRawText.trim().length > 0;

  const closeUploadNow = useCallback(() => {
    setDiscardOpen(false);
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadTitle("");
    setUploadDescription("");
    setUploadRawText("");
  }, []);

  const requestCloseUpload = useCallback(() => {
    if (uploadDirty) {
      setDiscardOpen(true);
      return;
    }
    closeUploadNow();
  }, [uploadDirty, closeUploadNow]);

  const confirmUploadDiscard = () => {
    setDiscardOpen(false);
    closeUploadNow();
  };

  const cancelUploadDiscard = () => {
    setDiscardOpen(false);
  };

  useEffect(() => {
    if (!showUploadModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (discardOpen) {
        setDiscardOpen(false);
        return;
      }
      requestCloseUpload();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showUploadModal, discardOpen, requestCloseUpload]);

  useEffect(() => {
    if (!showUploadModal || !uploadDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [showUploadModal, uploadDirty]);

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

  const downloadMaterialAsPdf = async (mat: LearningMaterial) => {
    try {
      const res = await authFetch("/api/convert-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mat.title || "Learning Material",
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

  const downloadQuizPdf = async (quizId: string, quizTitle: string) => {
    try {
      const res = await authFetch(`/api/quizzes/${encodeURIComponent(quizId)}/download-pdf`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quizTitle || "quiz"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Quiz downloaded as PDF.", "success");
    } catch {
      showToast("Could not download the quiz PDF.", "error");
    }
  };

  const handleOpenMaterialPreview = (mat: LearningMaterial) => {
    setViewingMaterial(mat);
  };

  const closePreview = () => {
    setViewingMaterial(null);
  };

  const handleDownload = async (mat: LearningMaterial) => {
    const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
    if (mat.fileUrl) {
      try {
        const res = await authFetch(`/api/materials/${encodeURIComponent(mat.id)}/download`);
        if (!res.ok) throw new Error(`Server returned status ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `${mat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "material"}.${ext || "bin"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch {
        // Fall through to generated PDF below.
      }
    }
    await downloadMaterialAsPdf(mat);
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

  const isStaff =
    currentUser?.role === "admin" ||
    (currentUser?.role === "teacher" && currentUser.id === subject?.teacherId);
  const canManage = currentUser?.role === "teacher" && currentUser.id === subject?.teacherId;

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "people", label: "People", icon: Users, count: students.length + 1 },
    { key: "materials", label: "Materials", icon: FileText, count: materials.length },
    { key: "quizzes", label: "Quizzes", icon: GraduationCap, count: quizzes.length },
    { key: "announcements", label: "Announcements", icon: Bell, count: subjectAnnouncements.length },
    { key: "grades", label: "Grades", icon: BarChart2, count: isStaff ? grades?.students?.length : grades?.attemptCount },
  ];

  const previewTimestamp = viewingMaterial?.createdAt
    ? new Date(viewingMaterial.createdAt).toLocaleString()
    : "";

  return {
    currentUser,
    navigate,
    subjectId,
    subject,
    notFound,
    activeTab,
    setActiveTab,
    students,
    studentsLoading,
    peoplePage,
    setPeoplePage,
    materials,
    materialsLoading,
    materialFlags,
    viewingFlags,
    setViewingFlags,
    resolvingFlag,
    setResolvingFlag,
    resolutionNote,
    setResolutionNote,
    resolving,
    flagTarget,
    setFlagTarget,
    flagCategory,
    setFlagCategory,
    flagNote,
    setFlagNote,
    flagSubmitting,
    quizzes,
    setQuizzes,
    quizzesLoading,
    quizPage,
    setQuizPage,
    grades,
    gradesLoading,
    expandedGradeStudents,
    setExpandedGradeStudents,
    allStudents,
    showAssignModal,
    setShowAssignModal,
    selectedStudentIds,
    setSelectedStudentIds,
    assigningStudents,
    showUploadModal,
    setShowUploadModal,
    uploadFile,
    setUploadFile,
    uploadTitle,
    setUploadTitle,
    uploadDescription,
    setUploadDescription,
    uploadRawText,
    setUploadRawText,
    uploading,
    discardOpen,
    setDiscardOpen,
    materialToEdit,
    setMaterialToEdit,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editRawText,
    setEditRawText,
    savingEdit,
    showQuizModal,
    setShowQuizModal,
    quizToEdit,
    setQuizToEdit,
    showAnnounceModal,
    setShowAnnounceModal,
    editingAnn,
    setEditingAnn,
    announcementToDelete,
    setAnnouncementToDelete,
    detailAnn,
    setDetailAnn,
    materialToDelete,
    setMaterialToDelete,
    quizToDelete,
    setQuizToDelete,
    matPage,
    setMatPage,
    annPage,
    setAnnPage,
    viewingMaterial,
    setViewingMaterial,
    previewQuiz,
    setPreviewQuiz,
    handleFlagMaterial,
    handleResolveFlag,
    handleOpenMaterialPreview,
    closePreview,
    uploadDirty,
    closeUploadNow,
    requestCloseUpload,
    confirmUploadDiscard,
    cancelUploadDiscard,
    openFile,
    downloadMaterialAsPdf,
    downloadQuizPdf,
    handleDownload,
    handleUpload,
    handleDeleteMaterial,
    openEditMaterial,
    handleUpdateMaterial,
    openEditQuiz,
    handleToggleQuizPublish,
    handleDeleteQuiz,
    openEditAnnouncement,
    openAssignStudents,
    toggleAssignStudent,
    handleSaveAssignment,
    deleteAnnouncement,
    showToast,
    flagsForMaterial,
    isRenderable,
    isAiMaterial,
    groupAttemptsByQuiz,
    subjectAnnouncements,
    highlightMaterialId,
    isStaff,
    canManage,
    tabs,
    previewTimestamp,
  };
}
