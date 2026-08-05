import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Sparkles,
  Filter,
  CheckCircle2,
  AlertCircle,
  Download,
  UserCheck,
  User,
  BookOpen,
  ArrowRight,
  FileCode,
  X,
  FileCheck,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "../../context/AuthContext";
import type { LearningMaterial, Subject } from "../../types";

interface LearningMaterialsPageProps {
  onGenerateResource?: (material: LearningMaterial) => void;
  onNavigate?: (tab: string) => void;
}

export const LearningMaterialsPage: React.FC<LearningMaterialsPageProps> = ({
  onGenerateResource,
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "teacher" | "student">("all");

  // Downloaded Tracking State
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("studylens_downloaded_materials");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Upload State (For Teachers/Professors)
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [targetResourceType, setTargetResourceType] = useState<"course" | "personal">("course");
  const [rawText, setRawText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Preview / Document Reader Modal
  const [previewMaterial, setPreviewMaterial] = useState<LearningMaterial | null>(null);

  // Format Download Selection Modal
  const [downloadModalMaterial, setDownloadModalMaterial] = useState<LearningMaterial | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmMat, setDeleteConfirmMat] = useState<LearningMaterial | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const [matRes, subRes] = await Promise.all([
          fetch(`/api/materials?userId=${currentUser?.id || ""}&userRole=${currentUser?.role || ""}`),
          fetch("/api/subjects"),
        ]);
        if (matRes.ok) {
          const matData = await matRes.json();
          if (isSubscribed) setMaterials(matData);
        }
        if (subRes.ok) {
          const subData = await subRes.json();
          if (isSubscribed) {
            setSubjects(subData);
            if (subData.length > 0 && !subjectId) setSubjectId(subData[0].id);
          }
        }
      } catch (err) {
        console.error("Fetch materials error:", err);
      }
    };

    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [subjectId, currentUser?.id, currentUser?.role]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !rawText) {
      setUploadMessage("Please upload a file (PDF, DOCX, PPTX, TXT) or paste lecture text.");
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const isPersonalType = currentUser?.role === "teacher" ? targetResourceType === "personal" : true;
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("title", title || file?.name || (isPersonalType ? "Personal Study Note" : "Uploaded Lecture Material"));
      formData.append("description", description || (isPersonalType ? "Personal self-study note" : "Course lecture material"));
      formData.append("subjectId", isPersonalType ? "personal" : (subjectId || subjects[0]?.id || "sub-101"));
      formData.append("textInput", rawText);
      formData.append("uploadedBy", currentUser?.name || "Prof. Maria Santos");
      formData.append("uploaderRole", currentUser?.role || "teacher");
      formData.append("uploaderId", currentUser?.id || "usr-teacher-1");
      formData.append("materialType", isPersonalType ? "personal" : "course");

      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const newMat = await res.json();
        setMaterials([newMat, ...materials]);
        setUploadMessage(
          isPersonalType
            ? "Personal study material saved successfully to your repository!"
            : "Course material successfully published to enrolled students!"
        );
        setFile(null);
        setTitle("");
        setDescription("");
        setRawText("");
      } else {
        const err = await res.json();
        setUploadMessage(err.error || "Upload failed");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Upload error:", err);
      setUploadMessage("Upload error: " + errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        setDeleteConfirmMat(null);
      }
    } catch (err) {
      console.error("Delete material error:", err);
    }
  };

  const markAsDownloaded = (matId: string) => {
    setDownloadedIds((prev) => {
      const updated = new Set(prev).add(matId);
      localStorage.setItem("studylens_downloaded_materials", JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  // PDF Download Generator using jsPDF
  const handleDownloadPDF = (mat: LearningMaterial) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - margin * 2;

    // Header Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, "F");

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const titleLines = doc.splitTextToSize(mat.title, maxLineWidth);
    doc.text(titleLines, margin, 12);

    // Subtitle Info
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225); // slate-300
    const subText = `Subject: ${mat.subjectName}  |  Uploaded by: ${mat.uploadedBy} (${
      mat.uploaderRole === "teacher" ? "Faculty" : "Student"
    })  |  Date: ${new Date(mat.createdAt).toLocaleDateString()}`;
    doc.text(subText, margin, 22);

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, 32, pageWidth - margin, 32);

    // Text Body
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(mat.extractedText || "No content available.", maxLineWidth);
    let cursorY = 40;
    const lineHeight = 5.5;

    for (let i = 0; i < lines.length; i++) {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 10, "F");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${mat.title} — StudyLens Course Note`, margin, 7);

        cursorY = 18;
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
      }
      doc.text(lines[i], margin, cursorY);
      cursorY += lineHeight;
    }

    const filename = `${mat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_notes.pdf`;
    doc.save(filename);
    markAsDownloaded(mat.id);
  };

  // Plain Text Download Generator
  const handleDownloadTXT = (mat: LearningMaterial) => {
    const fileContent = `================================================
${mat.title}
Subject: ${mat.subjectName}
Uploaded By: ${mat.uploadedBy} (${mat.uploaderRole === "teacher" ? "Faculty" : "Student"})
Date: ${new Date(mat.createdAt).toLocaleDateString()}
================================================\n\n` + mat.extractedText;

    const element = document.createElement("a");
    const file = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `${mat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_notes.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    markAsDownloaded(mat.id);
  };

  // Filter Logic with Privacy Enforcement
  const filteredMaterials = materials.filter((m) => {
    const matchesSubject = selectedSubject === "all" || m.subjectId === selectedSubject;

    const isCourseMat =
      m.materialType === "course" ||
      (!m.materialType &&
        (m.uploaderRole === "teacher" ||
          m.uploadedBy?.startsWith("Prof.") ||
          m.uploadedBy?.startsWith("Dr.")));

    const isPersonalMat = m.materialType === "personal" || (!m.materialType && !isCourseMat);

    // Privacy Protection: Personal materials/notes are strictly private to the owner who uploaded them.
    if (isPersonalMat) {
      const isOwner =
        (m.uploaderId && currentUser?.id && m.uploaderId === currentUser.id) ||
        (currentUser?.name && m.uploadedBy === currentUser.name) ||
        (!m.uploaderId && currentUser?.id === "usr-student-1");
      if (!isOwner && currentUser?.role !== "admin") return false;
    }

    if (!matchesSubject) return false;
    if (sourceFilter === "teacher") return isCourseMat;
    if (sourceFilter === "student") return isPersonalMat;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. TOP HEADER BANNER OR TEACHER UPLOAD FORM */}
      {currentUser?.role === "student" ? (
        <div className="bg-gradient-to-r from-blue-50 via-purple-50/80 to-indigo-50/70 border border-blue-200/80 dark:from-blue-950/80 dark:via-purple-950/60 dark:to-slate-950 dark:border-blue-500/20 p-6 rounded-2xl shadow-xs space-y-3 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-200/80 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center space-x-1">
                  <BookOpen className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span>Course & Personal Notes Repository</span>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Learning & Lecture Materials</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                Access official course materials uploaded by your professors, as well as your personal study notes. To upload or generate new study materials, head over to the <strong className="text-purple-700 dark:text-purple-300 font-bold">AI Study Generator</strong>.
              </p>
            </div>

            <button
              onClick={() => onNavigate && onNavigate("ai-assistant")}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 self-start sm:self-center shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Create Notes in AI Generator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Teacher / Admin Upload Form Box */
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-foreground">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload Course Lecture Material (Faculty Portal)</h3>
              <p className="text-xs text-muted-foreground">
                Publish lecture files (PDF, DOCX, PPTX, TXT) for student access. StudyLens AI extracts and indexes document text automatically.
              </p>
            </div>
          </div>

          {uploadMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                uploadMessage.includes("successfully")
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/20"
              }`}
            >
              {uploadMessage.includes("successfully") ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{uploadMessage}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-foreground mb-1">Document Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Module 4: Relational Algebra & Normalization"
                  className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {currentUser?.role === "teacher" && (
                <div className="space-y-2">
                  <label className="block font-semibold text-foreground">Target Resource Purpose / Format</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setTargetResourceType("course")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        targetResourceType === "course"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Course Subject Material</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetResourceType("personal")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        targetResourceType === "personal"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Personal Self-Study Note</span>
                    </button>
                  </div>

                  {targetResourceType === "course" ? (
                    <div>
                      <label className="block font-semibold text-foreground mb-1">Enrolled Course Subject</label>
                      <select
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card text-foreground"
                      >
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} — {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-semibold rounded-xl flex items-center space-x-2">
                      <User className="w-4 h-4 text-purple-500 shrink-0" />
                      <span>This file will be saved as your personal study resource (separate from course subjects).</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1">Description / Topic Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of lecture topics covered in this file..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>

            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <label className="block font-semibold text-foreground mb-1">Select File (PDF, DOCX, PPTX, TXT)</label>
                <div className="border-2 border-dashed border-border hover:border-blue-500 p-4 rounded-xl text-center bg-muted/30 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileText className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-foreground">
                    {file ? file.name : "Click or drag & drop lecture file here"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PDF, DOCX, PPTX, TXT format supported"}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">OR Paste Lecture Text directly</label>
                <textarea
                  rows={2}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste raw lecture content or textbook notes here..."
                  className="w-full px-3 py-1.5 border border-border bg-muted/40 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isUploading
                    ? "Extracting Text & Processing..."
                    : currentUser?.role === "teacher" && targetResourceType === "personal"
                    ? "Save Personal Self-Study Note"
                    : "Publish Course Material to Students"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. MATERIALS CATALOG & FILTERING */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border w-fit max-w-full overflow-x-auto shrink-0">
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                sourceFilter === "all"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({materials.length})
            </button>
            <button
              onClick={() => setSourceFilter("teacher")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                sourceFilter === "teacher"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Enrolled Course Subjects</span>
            </button>
            <button
              onClick={() => setSourceFilter("student")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                sourceFilter === "student"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Personal Notes & Self-Study</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-muted text-foreground font-medium focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Materials Grid */}
        {filteredMaterials.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-bold text-foreground">No materials found in this section</p>
            <p className="text-xs text-muted-foreground">
              Try selecting "All Materials" or switching subjects in the filter above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((mat) => {
              const isCourseMaterial =
                mat.materialType === "course" ||
                (!mat.materialType &&
                  (mat.uploaderRole === "teacher" ||
                    mat.uploadedBy?.startsWith("Prof.") ||
                    mat.uploadedBy?.startsWith("Dr.")));
              const isDownloaded = downloadedIds.has(mat.id);

              return (
                <div
                  key={mat.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                    isCourseMaterial
                      ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50"
                      : "bg-purple-500/5 border-purple-500/20 hover:border-purple-500/50"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {isCourseMaterial ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1 border border-blue-500/30">
                          <UserCheck className="w-3 h-3 text-blue-500" />
                          <span>🎓 Course Subject Material</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1 border border-purple-500/30">
                          <User className="w-3 h-3 text-purple-500" />
                          <span>✏️ Personal Study Note</span>
                        </span>
                      )}

                      <div className="flex items-center space-x-1.5">
                        {isDownloaded && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] rounded flex items-center space-x-1 border border-emerald-500/30">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Downloaded</span>
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono">{mat.fileSize || "1.2 MB"}</span>
                        {(currentUser?.role === "teacher" || currentUser?.role === "admin" || mat.uploaderId === currentUser?.id || mat.materialType === "personal") && (
                          <button
                            onClick={() => setDeleteConfirmMat(mat)}
                            className="text-muted-foreground hover:text-rose-600 transition-colors p-1.5 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{mat.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{mat.description}</p>
                    <p className="text-[10px] font-semibold text-primary">{mat.subjectName}</p>
                  </div>

                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">Uploaded by: {mat.uploadedBy}</span>
                      <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => setPreviewMaterial(mat)}
                        className="py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>View PDF</span>
                      </button>

                      <button
                        onClick={() => setDownloadModalMaterial(mat)}
                        className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-700"
                        title="Download material notes in PDF or TXT format"
                      >
                        <Download className="w-3 h-3 text-emerald-400" />
                        <span>{isDownloaded ? "Saved" : "Download"}</span>
                      </button>

                      <button
                        onClick={() => onGenerateResource && onGenerateResource(mat)}
                        className="py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-blue-200" />
                        <span>AI Tools</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. PDF DOCUMENT READER MODAL (VIEWING MATERIAL AS FORMATTED PDF DOCUMENT) */}
      {previewMaterial && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] flex flex-col">
            {/* Document Reader Bar Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 bg-slate-900 -mx-6 -mt-6 p-5 rounded-t-2xl text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1">
                      <FileCheck className="w-3 h-3 text-rose-400" />
                      <span>PDF Document Reader</span>
                    </span>
                    <span className="text-[11px] text-slate-300 font-semibold">{previewMaterial.subjectName}</span>
                  </div>
                  <h3 className="text-base font-bold mt-0.5 text-white">{previewMaterial.title}</h3>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewMaterial(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Paper Styled View */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 rounded-xl border border-border space-y-4 shadow-inner">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md space-y-6 max-w-2xl mx-auto">
                {/* PDF Page Decorative Header */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      StudyLens Course Material Document
                    </p>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {previewMaterial.title}
                    </h2>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 font-mono">
                    <p>Uploaded: {new Date(previewMaterial.createdAt).toLocaleDateString()}</p>
                    <p className="font-bold text-slate-700 dark:text-slate-300">{previewMaterial.uploadedBy}</p>
                  </div>
                </div>

                {/* PDF Content Body */}
                <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans font-normal tracking-wide">
                  {previewMaterial.extractedText || "No readable document text available."}
                </div>

                {/* PDF Page Footer */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Subject: {previewMaterial.subjectName}</span>
                  <span>Page 1 of 1 • StudyLens AI Generated PDF Document</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadPDF(previewMaterial)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF (.pdf)</span>
                </button>

                <button
                  onClick={() => handleDownloadTXT(previewMaterial)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl font-semibold text-xs flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Download TXT (.txt)</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewMaterial(null)}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted text-xs cursor-pointer"
                >
                  Close Reader
                </button>
                <button
                  onClick={() => {
                    const m = previewMaterial;
                    setPreviewMaterial(null);
                    if (onGenerateResource) onGenerateResource(m);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate AI Study Tools</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CHOOSE DOWNLOAD FORMAT MODAL */}
      {downloadModalMaterial && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Select File Download Format</h3>
                  <p className="text-xs text-muted-foreground">Choose your preferred download format</p>
                </div>
              </div>
              <button
                onClick={() => setDownloadModalMaterial(null)}
                className="text-muted-foreground hover:text-foreground font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
              <p className="text-xs font-bold text-foreground">{downloadModalMaterial.title}</p>
              <p className="text-[11px] text-muted-foreground">{downloadModalMaterial.subjectName}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  handleDownloadPDF(downloadModalMaterial);
                  setDownloadModalMaterial(null);
                }}
                className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs shadow-xs">
                    PDF
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400">
                      PDF Document (.pdf)
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Formatted printable PDF with page headers & layout metadata
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-rose-500" />
              </button>

              <button
                onClick={() => {
                  handleDownloadTXT(downloadModalMaterial);
                  setDownloadModalMaterial(null);
                }}
                className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="p-2.5 bg-slate-800 text-blue-400 rounded-xl font-bold text-xs border border-slate-700">
                    TXT
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Plain Text File (.txt)
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Raw text notes file compatible with all editors & note apps
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-blue-500" />
              </button>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setDownloadModalMaterial(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Warning Modal */}
      {deleteConfirmMat && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Learning Material?</h3>
                <p className="text-xs text-muted-foreground">Confirmation required</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1 text-xs text-rose-800 dark:text-rose-200">
              <p className="font-bold">Are you sure you want to delete this learning material?</p>
              <p className="text-[11px] leading-relaxed opacity-90">
                "{deleteConfirmMat.title}" will be permanently removed from your personal materials repository. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => setDeleteConfirmMat(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmMat.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Material</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
