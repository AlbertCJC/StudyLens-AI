import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Sparkles,
  Filter,
  AlertCircle,
  Download,
  BookOpen,
  ArrowRight,
  FileCode,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import arialRegularUrl from "../../assets/fonts/arial.ttf?url";
import arialBoldUrl from "../../assets/fonts/arialbd.ttf?url";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import type { LearningMaterial, Subject } from "../../types";
import { Pagination, slicePage } from "../../components/Pagination";

interface LearningMaterialsPageProps {
  onGenerateResource?: (material: LearningMaterial) => void;
  onNavigate?: (tab: string) => void;
}

// Embedded Unicode Arial TTF cache so every downloaded PDF embeds a real font with
// correct per-glyph metrics. jsPDF's built-in Helvetica is WinAnsi-only: characters
// outside that set (curly quotes, dashes, arrows, bullets) measure ~0 width, which
// makes splitTextToSize wrap too late and text overflow/overlap the page edges.
let pdfFontCache: { regular: string; bold: string } | null = null;

const loadPdfFonts = async (): Promise<{ regular: string; bold: string } | null> => {
  if (pdfFontCache) return pdfFontCache;
  try {
    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    };
    const [regular, bold] = await Promise.all([
      fetch(arialRegularUrl).then((r) => r.arrayBuffer()),
      fetch(arialBoldUrl).then((r) => r.arrayBuffer()),
    ]);
    pdfFontCache = { regular: toBase64(regular), bold: toBase64(bold) };
  } catch {
    pdfFontCache = null;
  }
  return pdfFontCache;
};

type PdfSegment = { text: string; bold: boolean };

// Splits AI-generated resource text into bold/normal segments based on its structure
// (flashcard labels, quiz labels, reviewer topics, summary takeaway labels). Uploaded
// textbook text carries no structure and stays plain.
const buildBoldSegments = (text: string): PdfSegment[] => {
  const segments: PdfSegment[] = [];
  for (const rawLine of text.split("\n")) {
    let m: RegExpMatchArray | null;

    if (/^Topic:/.test(rawLine)) {
      segments.push({ text: rawLine, bold: true });
    } else if ((m = rawLine.match(/^(Card \d+: Q:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^( {2}A:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^(Q\d+:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^( {2}Correct Answer:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^(- )?(Key Takeaway:)(.*)$/))) {
      if (m[1]) segments.push({ text: m[1], bold: false });
      segments.push({ text: m[2], bold: true });
      if (m[3]) segments.push({ text: m[3], bold: false });
    } else {
      segments.push({ text: rawLine, bold: false });
    }
  }
  return segments;
};

export const LearningMaterialsPage: React.FC<LearningMaterialsPageProps> = ({
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [materialPage, setMaterialPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    setMaterialPage(1);
  }, [selectedSubject]);

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
  const [rawText, setRawText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Assign Subject Modal State (teacher-owned materials)
  const [assignSubjectMat, setAssignSubjectMat] = useState<LearningMaterial | null>(null);
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [isAssigningSubject, setIsAssigningSubject] = useState(false);


  // Preview / Document Reader Modal
  const [previewMaterial, setPreviewMaterial] = useState<LearningMaterial | null>(null);
  const [previewTab, setPreviewTab] = useState<"file" | "text">("file");
  const [filePreviewError, setFilePreviewError] = useState(false);

  // Format Download Selection Modal
  const [downloadModalMaterial, setDownloadModalMaterial] = useState<LearningMaterial | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmMat, setDeleteConfirmMat] = useState<LearningMaterial | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const [matRes, subRes] = await Promise.all([
          authFetch(`/api/materials?userId=${currentUser?.id || ""}&userRole=${currentUser?.role || ""}`),
          authFetch("/api/subjects"),
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
      showToast("Please upload a file (PDF, DOCX, PPTX, TXT) or paste lecture text.", "info");
      return;
    }

    setIsUploading(true);

    try {
      const chosenSubject = subjectId || subjects[0]?.id || "";
      const isPersonalType = !chosenSubject;
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("title", title || file?.name || (isPersonalType ? "Personal Study Note" : "Uploaded Lecture Material"));
      formData.append("description", description || (isPersonalType ? "Personal self-study note" : "Course lecture material"));
      formData.append("subjectId", isPersonalType ? "" : chosenSubject);
      formData.append("textInput", rawText);
      formData.append("uploadedBy", currentUser?.name || "Prof. Maria Santos");
      formData.append("uploaderRole", currentUser?.role || "teacher");
      formData.append("uploaderId", currentUser?.id || "usr-teacher-1");
      formData.append("materialType", isPersonalType ? "personal" : "course");

      const res = await authFetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const newMat = await res.json();
        setMaterials([newMat, ...materials]);
        showToast(
          isPersonalType
            ? "Personal study material saved successfully to your repository!"
            : "Course material successfully published to enrolled students!"
        );
        setFile(null);
        setTitle("");
        setDescription("");
        setRawText("");
      } else {
        let errMessage = "Upload failed";
        try {
          const errText = await res.text();
          const errJson = JSON.parse(errText);
          errMessage = errJson?.error || errText || errMessage;
        } catch {
          // Non-JSON body (e.g. an HTML error page)
        }
        showToast(errMessage, "error");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Upload error:", err);
      showToast("Upload error: " + errorMsg, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/materials/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        setDeleteConfirmMat(null);
        showToast("Material deleted.");
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson?.error || "Could not delete the material.", "error");
      }
    } catch (err) {
      console.error("Delete material error:", err);
    }
  };

  const openAssignSubject = (mat: LearningMaterial) => {
    setAssignSubjectMat(mat);
    setAssignSubjectId(mat.subjectId ? mat.subjectId : "");

  };

  const handleAssignSubject = async () => {
    if (!assignSubjectMat || !assignSubjectId) {
      showToast("Please select an assigned subject.", "info");
      return;
    }
    setIsAssigningSubject(true);

    try {
      const res = await authFetch(`/api/materials/${assignSubjectMat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: assignSubjectId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setAssignSubjectMat(null);
        showToast("Subject assigned to material.");
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson?.error || "Could not assign the subject. Please try again.", "error");
      }
    } catch {
      showToast("Could not assign the subject. Please try again.", "error");
    } finally {
      setIsAssigningSubject(false);
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
  const handleDownloadPDF = async (mat: LearningMaterial) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - margin * 2;

    // Embed Arial (regular + bold) so unicode characters get real glyphs and correct
    // wrap metrics; fall back to the built-in Helvetica if the font fetch fails.
    const fonts = await loadPdfFonts();
    if (fonts) {
      doc.addFileToVFS("ArialEmbed.ttf", fonts.regular);
      doc.addFileToVFS("ArialEmbed-Bold.ttf", fonts.bold);
      doc.addFont("ArialEmbed.ttf", "ArialEmbed", "normal");
      doc.addFont("ArialEmbed-Bold.ttf", "ArialEmbed", "bold");
    }
    const baseFont = fonts ? "ArialEmbed" : "helvetica";
    doc.setLineHeightFactor(1.5);
    const mmPerPt = 25.4 / 72;

    // Title: each line drawn at its measured height so wrapped titles never collide
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont(baseFont, "bold");
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(mat.title, maxLineWidth);
    const titleLineHeight = doc.getFontSize() * 1.5 * mmPerPt;
    let cursorY = 16;
    for (const line of titleLines) {
      doc.text(line, margin, cursorY);
      cursorY += titleLineHeight;
    }

    // Separator line (drawn below the whole title block so long titles never overlap it)
    const sepY = 16 + titleLines.length * titleLineHeight + 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, sepY, pageWidth - margin, sepY);

    // Text Body
    doc.setFont(baseFont, "normal");
    doc.setFontSize(10);
    const cleanText = (mat.extractedText || "No content available.")
      .replace(/[\u00a0\u2007\u2009\u202f\u200b\ufeff]/g, " ")
      .split("")
      .map((ch) => {
        const c = ch.charCodeAt(0);
        if (c === 11 || c === 12 || c === 13) return "\n";
        if ((c < 32 && c !== 9 && c !== 10) || (c >= 127 && c <= 159)) return "";
        return ch;
      })
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const bodySegments = buildBoldSegments(cleanText);

    // Word-aware wrap of the segment stream into display lines. Tokens are measured
    // under their own font so bold/normal runs share a correct line break. Every
    // source line ends with a hard break (no line merging), and only width-wrapped
    // continuation lines drop leading spaces; intentional indents are preserved.
    const displayLines: PdfSegment[][] = [];
    let cur: PdfSegment[] = [];
    let curWidth = 0;
    const flushLine = () => {
      displayLines.push(cur);
      cur = [];
      curWidth = 0;
    };
    for (const seg of bodySegments) {
      if (seg.text === "") {
        if (cur.length > 0) flushLine();
        displayLines.push([]);
        continue;
      }
      doc.setFont(baseFont, seg.bold ? "bold" : "normal");
      const tokens = seg.text.split(/(\s+)/).filter((t) => t !== "");
      let firstInLine = true;
      for (let token of tokens) {
        if (cur.length === 0 && /^\s+$/.test(token) && !firstInLine) continue;
        firstInLine = false;
        // Hard-break tokens wider than the line (URLs, code, long runs) so nothing
        // overflows the right margin: binary-search the largest prefix that fits.
        while (doc.getTextWidth(token) > maxLineWidth && token.length > 1) {
          let lo = 1;
          let hi = token.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (doc.getTextWidth(token.slice(0, mid)) <= maxLineWidth) lo = mid;
            else hi = mid - 1;
          }
          if (cur.length > 0) flushLine();
          cur.push({ text: token.slice(0, lo), bold: seg.bold });
          flushLine();
          token = token.slice(lo);
        }
        if (token === "") continue;
        const tokenWidth = doc.getTextWidth(token);
        if (curWidth + tokenWidth > maxLineWidth && cur.length > 0) flushLine();
        cur.push({ text: token, bold: seg.bold });
        curWidth += tokenWidth;
      }
      if (cur.length > 0) flushLine();
    }

    const lineHeight = doc.getFontSize() * 1.5 * mmPerPt;
    cursorY = sepY + lineHeight + 3;

    for (const line of displayLines) {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = 20;
      }
      if (line.length > 0) {
        let x = margin;
        for (const s of line) {
          doc.setFont(baseFont, s.bold ? "bold" : "normal");
          doc.text(s.text, x, cursorY);
          x += doc.getTextWidth(s.text);
        }
      }
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

  // Resolve the URL for the original uploaded file (relative to Cloudinary/Firebase URLs).
  const resolveFileUrl = (mat: LearningMaterial): string | null => {
    const url = mat.fileUrl;
    if (!url) return null;
    if (/^(https?:)?\/\//i.test(url)) return url;
    if (url.startsWith("/")) return url;
    return `/${url.replace(/^\.?\//, "")}`;
  };

  // File types a browser can render directly without conversion.
  const isRenderableFileType = (mat: LearningMaterial): boolean => {
    const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
    if (ext === "pdf") return true;
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return true;
    if (["mp4", "webm", "ogg", "mov"].includes(ext)) return true;
    return false;
  };

  const isImageFileType = (mat: LearningMaterial): boolean => {
    const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  };

  const isVideoFileType = (mat: LearningMaterial): boolean => {
    const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
    return ["mp4", "webm", "ogg", "mov"].includes(ext);
  };

  // Open / download the ORIGINAL uploaded file (not a regenerated copy).
  const handleOpenOriginalFile = (mat: LearningMaterial) => {
    const url = resolveFileUrl(mat);
    if (!url) return;
    if (isRenderableFileType(mat)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      // Non-renderable types (DOCX/PPTX/TXT...) download instead of opening a dead viewer tab.
      const element = document.createElement("a");
      element.href = url;
      element.download = mat.title || "download";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
    markAsDownloaded(mat.id);
  };

  const openPreview = (mat: LearningMaterial, tab: "file" | "text" = "file") => {
    setFilePreviewError(false);
    setPreviewTab(tab);
    setPreviewMaterial(mat);
    if (tab === "file" && resolveFileUrl(mat)) preflightOriginalFile(mat);
  };

  // Probe the original file BEFORE rendering so a missing/unreachable file never
  // leaves a silently blank viewer - on failure we fall back to the extracted text.
  const preflightOriginalFile = async (mat: LearningMaterial) => {
    const url = resolveFileUrl(mat);
    if (!url) return;
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!res.ok) setFilePreviewError(true);
    } catch {
      setFilePreviewError(true);
    }
  };

  // Filter Logic with Privacy Enforcement
  const filteredMaterials = materials.filter((m) => {
    const matchesSubject = selectedSubject === "all" || m.subjectId === selectedSubject;

    // Privacy Protection: Personal materials/notes are strictly private to the owner who uploaded them.
    if (m.materialType === "personal") {
      const isOwner =
        (m.uploaderId && currentUser?.id && m.uploaderId === currentUser.id) ||
        (currentUser?.name && m.uploadedBy === currentUser.name) ||
        (!m.uploaderId && currentUser?.id === "usr-student-1");
      if (!isOwner && currentUser?.role !== "admin") return false;
    }

    return matchesSubject;
  });

  // Derived original-file URL for the current preview (the exact uploaded file).
  const originalFileUrl = previewMaterial ? resolveFileUrl(previewMaterial) : null;
  const hasOriginalFile = !!originalFileUrl && isRenderableFileType(previewMaterial as LearningMaterial);

  // AI-generated resources (fileType "ai-*") have no original uploaded file - the
  // generated content itself IS the document, so the viewer shows it directly.
  const isAiMaterial = (mat: LearningMaterial | null): boolean =>
    !!mat && (mat.fileType || "").toLowerCase().startsWith("ai-");
  const previewIsAi = isAiMaterial(previewMaterial);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {currentUser?.role === "student" ? (
          <button
            onClick={() => onNavigate && onNavigate("ai-assistant")}
            className="px-4 py-2.5 bg-[#5b51d8] hover:bg-[#4c42c9] text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Create Notes in Resource Generator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : currentUser?.role === "teacher" ? (
          <button
            onClick={() => setShowUpload((prev) => !prev)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{showUpload ? "Close Upload Form" : "Upload Material"}</span>
          </button>
        ) : null}
      </div>

      {currentUser?.role === "teacher" && showUpload && (
        /* Teacher Upload Form Box */
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-foreground">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload Course Material</h3>
              <p className="text-xs text-muted-foreground">Publish lecture files (PDF, DOCX, PPTX, TXT) for student access.</p>
            </div>
          </div>

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
                  <label className="block font-semibold text-foreground mb-1">Assigned Course Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card text-foreground"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    The material is published to students of the selected subject.
                  </p>
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
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-card text-foreground shadow-xs border border-border">
              All Materials ({filteredMaterials.length})
            </span>
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
                  {s.code} - {s.name}
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
              Try selecting "All Subjects" in the filter above.
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slicePage(filteredMaterials, materialPage).map((mat) => {
              const isDownloaded = downloadedIds.has(mat.id);
              const canAssignSubject =
                currentUser?.role === "teacher" &&
                mat.uploaderId === currentUser?.id &&
                mat.uploaderRole !== "student";

              return (
                <div
                  key={mat.id}
                  onClick={() => openPreview(mat, "file")}
                  className="p-4 rounded-xl border border-border transition-all space-y-3 flex flex-col justify-between bg-card hover:border-blue-500/40 cursor-pointer"
                  title="Click to view this material"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {mat.subjectName ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                          {mat.subjectName}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                          Unassigned
                        </span>
                      )}

                      <div className="flex items-center space-x-1.5">
                        {mat.fileSize && <span className="text-[10px] text-muted-foreground font-mono">{mat.fileSize}</span>}
                        {(currentUser?.role === "teacher" && mat.uploaderId === currentUser?.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmMat(mat);
                            }}
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
                  </div>

                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-end text-[10px] text-muted-foreground">
                      <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDownloadModalMaterial(mat);
                        }}
                        className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-700"
                        title="Download material notes in PDF or TXT format"
                      >
                        <Download className="w-3 h-3 text-emerald-400" />
                        <span>{isDownloaded ? "Saved" : "Download"}</span>
                      </button>
                    </div>

                    {canAssignSubject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignSubject(mat);
                        }}
                        className="w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer border border-indigo-500/20"
                        title={mat.subjectId ? "Change the assigned subject" : "Assign this material to an assigned subject"}
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{mat.subjectId ? "Change Subject" : "Assign Subject"}</span>
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={materialPage}
            total={filteredMaterials.length}
            onPageChange={setMaterialPage}
          />
          </>
        )}

      </div>

      {/* 3. PDF DOCUMENT READER MODAL (VIEWING MATERIAL AS FORMATTED PDF DOCUMENT) */}
      {previewMaterial && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewMaterial(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] flex flex-col">
            {/* Document Reader Bar Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 bg-slate-900 -mx-6 -mt-6 p-5 rounded-t-2xl text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    {!previewIsAi && (
                      <span className="text-[11px] text-slate-300 font-semibold">{previewMaterial.subjectName || "Unassigned"}</span>
                    )}

                    {previewMaterial.fileType && !previewIsAi && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-md border border-rose-500/30">
                        {previewMaterial.fileType.toUpperCase()}
                      </span>
                    )}

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

            {/* Document Reader Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 rounded-xl border border-border space-y-4 shadow-inner">
              {/* View Tabs (hidden for AI-generated resources - no original file exists) */}
              {!previewIsAi && (
                <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setFilePreviewError(false); setPreviewTab("file"); if (previewMaterial) preflightOriginalFile(previewMaterial); }}
                  disabled={!hasOriginalFile}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    previewTab === "file" && hasOriginalFile
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  Original Document
                </button>
                <button
                  onClick={() => setPreviewTab("text")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    previewTab === "text" || !hasOriginalFile
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  Extracted Text
                </button>
              </div>
              )}

              {/* ORIGINAL FILE VIEW (PDF iframe / image / video) */}
              {previewTab === "file" && hasOriginalFile && !filePreviewError && (
                <div className="bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-700 overflow-hidden h-[60vh]">
                  {isImageFileType(previewMaterial) ? (
                    <img
                      src={originalFileUrl || undefined}
                      alt={previewMaterial.title}
                      className="w-full h-full object-contain"
                      onError={() => setFilePreviewError(true)}
                    />
                  ) : isVideoFileType(previewMaterial) ? (
                    <video
                      src={originalFileUrl || undefined}
                      controls
                      className="w-full h-full object-contain"
                      onError={() => setFilePreviewError(true)}
                    />
                  ) : (
                    <iframe
                      src={originalFileUrl || undefined}
                      title={previewMaterial.title}
                      className="w-full h-full"
                      onError={() => setFilePreviewError(true)}
                    />
                  )}
                </div>
              )}

              {/* LOAD ERROR: original file is missing/unreachable -> fall back to extracted text */}
              {previewTab === "file" && hasOriginalFile && filePreviewError && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md max-w-2xl mx-auto text-center space-y-4">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    The original file could not be loaded.
                  </p>
                  <p className="text-xs text-slate-500">
                    Showing the extracted document text below instead.
                  </p>
                </div>
              )}

              {/* FALLBACK: non-renderable uploaded file type with a link to open the original.
                  Not shown for AI-generated resources (they have no original file). */}
              {previewTab === "file" && !hasOriginalFile && !previewIsAi && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md max-w-2xl mx-auto text-center space-y-4">
                  <FileCode className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {previewMaterial.fileType?.toUpperCase()} files can't be previewed inline.
                  </p>
                  <p className="text-xs text-slate-500">
                    Open the original uploaded file to view its exact contents.
                  </p>
                </div>
              )}

              {/* EXTRACTED TEXT VIEW (paper style) */}
              {(previewTab === "text" || !hasOriginalFile || filePreviewError) && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md space-y-6 max-w-2xl mx-auto">
                  {/* Paper Page Header */}
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex justify-between items-end">
                    <div>
                      {!previewIsAi && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          {previewMaterial.subjectName || "Unassigned"}
                          {previewMaterial.fileType ? ` Â· ${previewMaterial.fileType.toUpperCase()}` : ""}
                        </p>
                      )}

                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                        {previewMaterial.title}
                      </h2>
                    </div>
                    {!previewIsAi && (
                      <div className="text-right text-[10px] text-slate-500 font-mono">
                        <p>Uploaded: {new Date(previewMaterial.createdAt).toLocaleDateString()}</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300">{previewMaterial.uploadedBy}</p>
                        {previewMaterial.fileSize && <p>{previewMaterial.fileSize}</p>}
                      </div>
                    )}

                  </div>

                  {/* Content Body */}
                  <div className="text-[13px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-7 font-sans font-normal tracking-wide">
                    {previewMaterial.extractedText || "No readable document text available."}
                  </div>

                  {/* Decorative Page Footer (hidden for AI-generated resources) */}
                  {!previewIsAi && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-center gap-2">
                      <span className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
                        StudyLens Learning Materials
                      </p>
                      <span className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                    </div>
                    )}

                </div>
              )}

            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
              <div className="flex items-center space-x-2">
                {originalFileUrl && previewTab === "file" && (
                  <button
                    onClick={() => handleOpenOriginalFile(previewMaterial)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Open Original File</span>
                  </button>
                )}

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
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 4. CHOOSE DOWNLOAD FORMAT MODAL */}
      {downloadModalMaterial && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDownloadModalMaterial(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-5">
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
                âœ•
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
                      Formatted printable PDF document
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

      {/* Assign Subject Modal (teacher assigns a subject to an uploaded material) */}
      {assignSubjectMat && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAssignSubjectMat(null);
          }}
        >
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
              <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Assign Course Subject</h3>
                <p className="text-xs text-muted-foreground">
                  Choose the assigned subject for "{assignSubjectMat.title}"
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-3 text-xs">
              <label className="block font-semibold text-foreground">Assigned Course Subject</label>
              <select
                value={assignSubjectId}
                onChange={(e) => setAssignSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-card text-foreground"
              >
                <option value="">-- Select Assigned Subject --</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Students of the selected subject will see this material.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => setAssignSubjectMat(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubject}
                disabled={isAssigningSubject || !assignSubjectId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span>{isAssigningSubject ? "Assigning..." : "Assign Subject"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Warning Modal */}
      {deleteConfirmMat && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmMat(null);
          }}
        >
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
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
