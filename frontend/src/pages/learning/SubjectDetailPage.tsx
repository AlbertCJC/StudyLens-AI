import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  CheckCircle2,
  XCircle,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAnnouncements } from "../../context/AnnouncementsContext";
import { authFetch } from "../../utils/authFetch";
import type { Subject, LearningMaterial, Quiz, QuizQuestion, DifficultyLevel, BloomsTaxonomy } from "../../types";

interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  studentId: string;
  dateEnrolled: string;
}

type TabKey = "people" | "materials" | "quizzes" | "announcements";

const QUESTION_TYPES = ["multiple_choice", "true_false", "identification", "short_answer"] as const;
const BLOOMS_LEVELS: BloomsTaxonomy[] = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];

interface DraftQuestion {
  localId: string;
  question: string;
  type: (typeof QUESTION_TYPES)[number];
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: DifficultyLevel;
  bloomsLevel: BloomsTaxonomy;
  topicTag: string;
}

export const SubjectDetailPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { announcements, addAnnouncement } = useAnnouncements();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("people");

  // Students
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  // Materials
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  // Quizzes
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  // Upload Material Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadRawText, setUploadRawText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // Edit Material Modal
  const [materialToEdit, setMaterialToEdit] = useState<LearningMaterial | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRawText, setEditRawText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  // Create Quiz Modal
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState<Quiz | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState<DifficultyLevel>("medium");
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [quizPassPercentage, setQuizPassPercentage] = useState(70);
  const [quizPublished, setQuizPublished] = useState(true);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  // Post Announcement Modal
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPriority, setAnnPriority] = useState<"high" | "medium" | "low">("medium");
  const [annAudience, setAnnAudience] = useState<"all" | "students" | "teachers">("all");
  const [postingAnn, setPostingAnn] = useState(false);

  // Delete confirmations
  const [materialToDelete, setMaterialToDelete] = useState<LearningMaterial | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

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
      const [sRes, mRes, qRes] = await Promise.all([
        authFetch(`/api/subjects/${subject.id}/students`),
        authFetch(`/api/materials?userId=${currentUser.id || ""}&userRole=${currentUser.role || ""}`),
        authFetch(`/api/quizzes?userId=${currentUser.id || ""}`),
      ]);
      if (!active) return;
      if (sRes.ok) setStudents((await sRes.json()) as EnrolledStudent[]);
      if (mRes.ok) {
        const all = (await mRes.json()) as LearningMaterial[];
        setMaterials(all.filter((m) => m.subjectId === subject.id));
      }
      if (qRes.ok) {
        const all = (await qRes.json()) as Quiz[];
        setQuizzes(all.filter((q) => q.subjectId === subject.id));
      }
      setStudentsLoading(false);
      setMaterialsLoading(false);
      setQuizzesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [subject, currentUser]);

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !uploadRawText.trim()) {
      setUploadMsg("Upload a file or paste lecture text.");
      return;
    }
    if (!subject) return;
    setUploading(true);
    setUploadMsg(null);
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
      } else {
        const errText = await res.text().catch(() => "");
        let msg = "Upload failed.";
        try {
          msg = JSON.parse(errText)?.error || errText || msg;
        } catch {
          msg = errText || msg;
        }
        setUploadMsg(msg);
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setUploadMsg("Upload error: " + (err instanceof Error ? err.message : String(err)));
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
      }
    } catch (err) {
      console.error("Delete material error:", err);
    }
  };

  const openEditMaterial = (mat: LearningMaterial) => {
    setMaterialToEdit(mat);
    setEditTitle(mat.title);
    setEditDescription(mat.description || "");
    setEditRawText(mat.extractedText || "");
    setEditMsg(null);
  };

  const handleUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialToEdit || !editTitle.trim()) return;
    setSavingEdit(true);
    setEditMsg(null);
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
      } else {
        const errData = await res.json().catch(() => ({}));
        setEditMsg(errData.error || "Could not update the material.");
      }
    } catch (err) {
      console.error("Update material error:", err);
      setEditMsg("Update failed. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const addDraftQuestion = () => {
    setDraftQuestions((prev) => [
      ...prev,
      {
        localId: `q-${Date.now()}-${prev.length}`,
        question: "",
        type: "multiple_choice",
        options: ["", "", "", ""],
        correctAnswer: "",
        explanation: "",
        difficulty: "medium",
        bloomsLevel: "Analyzing",
        topicTag: "Core Concepts",
      },
    ]);
  };

  const updateDraftQuestion = (localId: string, patch: Partial<DraftQuestion>) => {
    setDraftQuestions((prev) => prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  };

  const updateDraftOption = (localId: string, index: number, value: string) => {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.localId !== localId) return q;
        const options = [...q.options];
        options[index] = value;
        return { ...q, options };
      })
    );
  };

  const removeDraftQuestion = (localId: string) => {
    setDraftQuestions((prev) => prev.filter((q) => q.localId !== localId));
  };

  const openEditQuiz = (quiz: Quiz) => {
    setQuizToEdit(quiz);
    setQuizTitle(quiz.title);
    setQuizDescription(quiz.description || "");
    setQuizDifficulty(quiz.difficulty);
    setQuizTimeLimit(quiz.timeLimitMinutes || 15);
    setQuizPassPercentage(quiz.passPercentage);
    setQuizPublished(quiz.isPublished);
    setDraftQuestions(
      (quiz.questions || []).map((q) => {
        const options =
          q.type === "multiple_choice" && q.options && q.options.length
            ? [...q.options]
            : ["", "", "", ""];
        return {
          localId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          question: q.question,
          type: q.type,
          options,
          correctAnswer:
            typeof q.correctAnswer === "number"
              ? (options[q.correctAnswer] ?? "")
              : String(q.correctAnswer ?? ""),
          explanation: q.explanation,
          difficulty: q.difficulty,
          bloomsLevel: q.bloomsLevel,
          topicTag: q.topicTag || "Core Concepts",
        };
      })
    );
    setShowQuizModal(true);
  };

  const buildQuizQuestions = (): QuizQuestion[] =>
    draftQuestions.map((q) => ({
      id: q.localId,
      question: q.question,
      type: q.type,
      options: q.type === "multiple_choice" ? q.options.filter((o) => o.trim() !== "") : undefined,
      correctAnswer:
        q.type === "multiple_choice"
          ? q.options.findIndex((o) => o.trim() === q.correctAnswer.trim())
          : q.correctAnswer,
      explanation: q.explanation,
      bloomsLevel: q.bloomsLevel,
      difficulty: q.difficulty,
      topicTag: q.topicTag || "Core Concepts",
    }));

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !quizTitle.trim()) return;
    setCreatingQuiz(true);
    try {
      const questions = buildQuizQuestions();
      const payload = {
        title: quizTitle.trim(),
        description: quizDescription || `Official Course Assessment for ${subject.code}`,
        subjectId: subject.id,
        subjectName: `${subject.code} - ${subject.name}`,
        questions,
        createdById: currentUser?.id || "usr-teacher-1",
        createdByName: currentUser?.name || "Faculty Instructor",
        quizType: "teacher",
        isPublished: quizPublished,
        timeLimitMinutes: quizTimeLimit,
        passPercentage: quizPassPercentage,
        difficulty: quizDifficulty,
      };

      if (quizToEdit) {
        const res = await authFetch(`/api/quizzes/${quizToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = (await res.json()) as Quiz;
          setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
          setQuizToEdit(null);
          setQuizTitle("");
          setQuizDescription("");
          setDraftQuestions([]);
          setShowQuizModal(false);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Could not update the quiz.");
        }
      } else {
        const res = await authFetch("/api/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = (await res.json()) as Quiz;
          setQuizzes((prev) => [created, ...prev]);
          setQuizTitle("");
          setQuizDescription("");
          setDraftQuestions([]);
          setShowQuizModal(false);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Could not create the quiz.");
        }
      }
    } catch (err) {
      console.error("Save quiz error:", err);
    } finally {
      setCreatingQuiz(false);
    }
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
      }
    } catch (err) {
      console.error("Toggle quiz publish error:", err);
    }
  };

  const handleDeleteQuiz = async (quiz: Quiz) => {
    try {
      const res = await authFetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
        setQuizToDelete(null);
      }
    } catch (err) {
      console.error("Delete quiz error:", err);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !annTitle.trim() || !annContent.trim()) return;
    setPostingAnn(true);
    try {
      addAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim(),
        authorName: `${currentUser?.name || "Faculty Instructor"} (${subject.code})`,
        targetAudience: annAudience,
        priority: annPriority,
        subjectId: subject.id,
        subjectName: `${subject.code} - ${subject.name}`,
        tag: subject.code,
      });
      setAnnTitle("");
      setAnnContent("");
      setShowAnnounceModal(false);
    } finally {
      setPostingAnn(false);
    }
  };

  const subjectAnnouncements = subject
    ? announcements.filter((a) => a.subjectId === subject.id)
    : [];

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "people", label: "People", icon: Users, count: students.length + 1 },
    { key: "materials", label: "Materials", icon: FileText, count: materials.length },
    { key: "quizzes", label: "Quizzes", icon: GraduationCap, count: quizzes.length },
    { key: "announcements", label: "Announcements", icon: Bell, count: subjectAnnouncements.length },
  ];

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

      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 border border-blue-200/80 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-900 dark:border-blue-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold rounded-lg">
                {subject.code}
              </span>
              {subject.semester && (
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                  {subject.semester} • {subject.schoolYear || ""}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{subject.name}</h1>
            {subject.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {subject.description}
              </p>
            )}
            <div className="flex items-center space-x-4 pt-1 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center space-x-1">
                <Users className="w-3.5 h-3.5" />
                <strong>{subject.studentCount}</strong> students
              </span>
              <span className="inline-flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5" />
                <strong>{subject.materialCount}</strong> materials
              </span>
              {subject.course && <span>Program: {subject.course}</span>}
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start lg:self-center">
            <Link
              to="/materials"
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Manage Materials</span>
            </Link>
            <Link
              to="/assessments"
              className="px-3 py-2 border border-blue-300/60 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Manage Quizzes</span>
            </Link>
          </div>
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
            <span className="text-xs font-semibold text-muted-foreground">
              {students.length + 1} people
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
            <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg shrink-0">
              Teacher
            </span>
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-semibold">Student</th>
                    <th className="py-2 pr-4 font-semibold">Student ID</th>
                    <th className="py-2 pr-4 font-semibold">Email</th>
                    <th className="py-2 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-4 font-bold text-foreground">{s.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-muted-foreground">{s.studentId || "—"}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg shrink-0">
                          Student
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <button
              onClick={() => {
                setUploadMsg(null);
                setShowUploadModal(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Material</span>
            </button>
          </div>

          {materialsLoading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading materials...</p>
          ) : materials.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No materials uploaded for this subject yet. Upload lecture notes, slide decks, or PDFs.
            </p>
          ) : (
            <div className="space-y-2.5">
              {materials.map((mat) => (
                <div
                  key={mat.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30 gap-3"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{mat.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {mat.uploadedBy} • {mat.fileType?.toUpperCase() || "TEXT"} {mat.fileSize ? `• ${mat.fileSize}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    {resolveFileUrl(mat) && (
                      <button
                        onClick={() => openFile(mat)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                        title={isRenderable(mat) ? "Open" : "Download"}
                      >
                        {isRenderable(mat) ? <Eye className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => openEditMaterial(mat)}
                      className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                      title="Edit Material"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setMaterialToDelete(mat)}
                      className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="Delete Material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
            <button
              onClick={() => {
                setQuizToEdit(null);
                setQuizTitle("");
                setQuizDescription("");
                setDraftQuestions([]);
                setShowQuizModal(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Quiz</span>
            </button>
          </div>

          {quizzesLoading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading quizzes...</p>
          ) : quizzes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No quizzes created for this subject yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{quiz.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {quiz.questions?.length || 0} questions • {quiz.difficulty} •{" "}
                      {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No time limit"} • Pass {quiz.passPercentage}%
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleQuizPublish(quiz)}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        quiz.isPublished
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                      title={quiz.isPublished ? "Click to unpublish" : "Click to publish"}
                    >
                      {quiz.isPublished ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{quiz.isPublished ? "Published" : "Draft"}</span>
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
                  </div>
                </div>
              ))}
            </div>
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
            <button
              onClick={() => {
                setAnnTitle("");
                setAnnContent("");
                setShowAnnounceModal(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Post Announcement</span>
            </button>
          </div>

          {subjectAnnouncements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No announcements posted for this subject yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {subjectAnnouncements.map((a) => (
                <div key={a.id} className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{a.title}</p>
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
                  <p className="text-[10px] text-muted-foreground">
                    {a.authorName} • {a.createdAt}
                  </p>
                </div>
              ))}
            </div>
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
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
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

              {uploadMsg && <p className="text-rose-600 text-[10px]">{uploadMsg}</p>}

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
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
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

              {editMsg && <p className="text-rose-600 text-[10px]">{editMsg}</p>}

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

      {/* ===== Create Quiz Modal ===== */}
      {showQuizModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowQuizModal(false);
          }}
        >
          <div className="bg-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {quizToEdit ? "Edit Quiz" : "Create Quiz"}
              </h3>
              <button
                onClick={() => setShowQuizModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateQuiz} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-foreground mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="e.g., Midterm Exam - Data Structures"
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-foreground mb-1">Description</label>
                  <input
                    type="text"
                    value={quizDescription}
                    onChange={(e) => setQuizDescription(e.target.value)}
                    placeholder="Optional description or instructions..."
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Difficulty</label>
                  <select
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={quizTimeLimit}
                    onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Pass Percentage</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={quizPassPercentage}
                    onChange={(e) => setQuizPassPercentage(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quizPublished}
                      onChange={(e) => setQuizPublished(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                    <span>Publish immediately</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">
                    Questions ({draftQuestions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addDraftQuestion}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Question</span>
                  </button>
                </div>

                {draftQuestions.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-3">
                    No questions yet. Add questions or leave empty for a title-only quiz.
                  </p>
                )}

                {draftQuestions.map((q, qi) => (
                  <div key={q.localId} className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Question {qi + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeDraftQuestion(q.localId)}
                        className="p-1 text-rose-600 hover:bg-rose-500/10 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => updateDraftQuestion(q.localId, { question: e.target.value })}
                      placeholder="Enter the question..."
                      className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateDraftQuestion(q.localId, { type: e.target.value as DraftQuestion["type"] })
                        }
                        className="px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      <select
                        value={q.difficulty}
                        onChange={(e) =>
                          updateDraftQuestion(q.localId, { difficulty: e.target.value as DifficultyLevel })
                        }
                        className="px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    {q.type === "multiple_choice" && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center space-x-1.5">
                            <span className="w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateDraftOption(q.localId, oi, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className="flex-1 px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                        <select
                          value={q.correctAnswer}
                          onChange={(e) => updateDraftQuestion(q.localId, { correctAnswer: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select correct answer...</option>
                          {q.options
                            .map((opt, oi) => ({ opt, oi }))
                            .filter((o) => o.opt.trim() !== "")
                            .map((o) => (
                              <option key={o.oi} value={o.opt}>
                                {String.fromCharCode(65 + o.oi)} - {o.opt}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {q.type === "true_false" && (
                      <div className="flex space-x-2">
                        {["True", "False"].map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => updateDraftQuestion(q.localId, { correctAnswer: tf })}
                            className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              q.correctAnswer === tf
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-border bg-card text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    )}

                    {(q.type === "identification" || q.type === "short_answer") && (
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateDraftQuestion(q.localId, { correctAnswer: e.target.value })}
                        placeholder="Correct answer..."
                        className="w-full px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={q.bloomsLevel}
                        onChange={(e) =>
                          updateDraftQuestion(q.localId, { bloomsLevel: e.target.value as BloomsTaxonomy })
                        }
                        className="px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {BLOOMS_LEVELS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={q.topicTag}
                        onChange={(e) => updateDraftQuestion(q.localId, { topicTag: e.target.value })}
                        placeholder="Topic tag (e.g., Arrays)"
                        className="px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => updateDraftQuestion(q.localId, { explanation: e.target.value })}
                      placeholder="Explanation (shown after answering)"
                      className="w-full px-2.5 py-1.5 border border-border bg-card text-foreground rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowQuizModal(false)}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingQuiz}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {creatingQuiz ? "Saving..." : quizToEdit ? "Save Changes" : "Create Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Post Announcement Modal ===== */}
      {showAnnounceModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAnnounceModal(false);
          }}
        >
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-foreground">Post Class Announcement</h3>
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g., Reminder: Quiz on Friday"
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-foreground mb-1">Message</label>
                <textarea
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Write your announcement to the class..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Priority</label>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Audience</label>
                  <select
                    value={annAudience}
                    onChange={(e) => setAnnAudience(e.target.value as "all" | "students" | "teachers")}
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Everyone</option>
                    <option value="students">Students</option>
                    <option value="teachers">Teachers</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingAnn}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {postingAnn ? "Posting..." : "Post Announcement"}
                </button>
              </div>
            </form>
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
          <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-border space-y-4">
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
          <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-border space-y-4">
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
    </div>
  );
};
