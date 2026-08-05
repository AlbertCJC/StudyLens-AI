import React, { useState, useEffect } from "react";
import {
  Sparkles,
  BookOpen,
  CheckSquare,
  Layers,
  FileText,
  Save,
  Check,
  Cpu,
  AlertCircle,
  UploadCloud,
  File,
  Paperclip,
  X,
  CheckCircle2,
  Download,
  FolderArchive,
  Eye,
  BookMarked,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { LearningMaterial, Subject, QuizQuestion } from "../../types";

interface GeneratedResult {
  questions?: QuizQuestion[];
  cards?: Array<{ question: string; answer: string; topicTag?: string }>;
  executiveSummary?: string;
  keyTakeaways?: string[];
  bulletPoints?: string[];
  overview?: string;
  topics?: Array<{ topic: string; overview: string; keyConcepts?: string[]; sampleQuestions?: string[] }>;
  practiceQuestions?: Array<{ question: string; sampleAnswer: string }>;
}

interface SavedItem {
  id: string;
  title: string;
  subjectName?: string;
  createdAt: string;
  type: "summary" | "reviewer" | "quiz" | "flashcard";
  contentPreview?: string;
  rawItem: Record<string, unknown>;
}

interface AIStudyAssistantPageProps {
  initialMaterial?: LearningMaterial | null;
}

export const AIStudyAssistantPage: React.FC<AIStudyAssistantPageProps> = ({ initialMaterial }) => {
  const { currentUser } = useAuth();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(initialMaterial?.id || "");
  const [customText, setCustomText] = useState<string>(initialMaterial?.extractedText || "");
  const [mode, setMode] = useState<"quiz" | "flashcards" | "summary" | "reviewer">("quiz");

  // Input Method & Upload State
  const [inputMethod, setInputMethod] = useState<"upload" | "saved" | "paste">("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Options
  const [quizCount, setQuizCount] = useState<number>(5);
  const [flashcardCount, setFlashcardCount] = useState<number>(5);
  const [subjectId, setSubjectId] = useState<string>("");

  // AI Output
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<GeneratedResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Teacher Editable State
  const [editTitle, setEditTitle] = useState("");
  const [isPublishedToggle, setIsPublishedToggle] = useState(true);

  // Saved Resources Library State
  const [showSavedLibrary, setShowSavedLibrary] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [selectedSavedItem, setSelectedSavedItem] = useState<SavedItem | null>(null);
  const [deleteSavedConfirmItem, setDeleteSavedConfirmItem] = useState<SavedItem | null>(null);

  const handleModeSelect = (newMode: "quiz" | "flashcards" | "summary" | "reviewer") => {
    setMode(newMode);
    setGeneratedOutput(null);
    setErrorMsg(null);
    setSavedSuccess(false);
  };

  const handleDeleteSavedResource = async (item: SavedItem) => {
    try {
      const endpoint = item.type === "summary" ? `/api/summaries/${item.id}` : `/api/reviewers/${item.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteSavedConfirmItem(null);
      }
    } catch (err) {
      console.error("Delete saved AI resource error:", err);
    }
  };

  const fetchSavedResources = async () => {
    setIsLoadingSaved(true);
    try {
      const [sumRes, revRes] = await Promise.all([
        fetch(`/api/summaries?userId=${currentUser?.id || ""}`),
        fetch(`/api/reviewers?userId=${currentUser?.id || ""}`),
      ]);

      const items: SavedItem[] = [];

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (Array.isArray(sumData)) {
          sumData.forEach((s) => {
            items.push({
              id: s.id,
              title: s.title || "AI Lecture Summary",
              subjectName: s.subjectName || "General Subject",
              createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Recent",
              type: "summary",
              contentPreview: s.executiveSummary || "Summary of lecture concepts...",
              rawItem: s,
            });
          });
        }
      }

      if (revRes.ok) {
        const revData = await revRes.json();
        if (Array.isArray(revData)) {
          revData.forEach((r) => {
            items.push({
              id: r.id,
              title: r.title || "AI Study Reviewer",
              subjectName: r.subjectName || "General Subject",
              createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Recent",
              type: "reviewer",
              contentPreview: r.overview || "Study reviewer and topic breakdown...",
              rawItem: r,
            });
          });
        }
      }

      setSavedItems(items);
    } catch (err) {
      console.error("Fetch saved AI resources error:", err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    const loadSaved = async () => {
      setIsLoadingSaved(true);
      try {
        const [sumRes, revRes] = await Promise.all([
          fetch(`/api/summaries?userId=${currentUser?.id || ""}`),
          fetch(`/api/reviewers?userId=${currentUser?.id || ""}`),
        ]);

        const items: SavedItem[] = [];

        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (Array.isArray(sumData)) {
            sumData.forEach((s) => {
              items.push({
                id: s.id,
                title: s.title || "AI Lecture Summary",
                subjectName: s.subjectName || "General Subject",
                createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Recent",
                type: "summary",
                contentPreview: s.executiveSummary || "Summary of lecture concepts...",
                rawItem: s,
              });
            });
          }
        }

        if (revRes.ok) {
          const revData = await revRes.json();
          if (Array.isArray(revData)) {
            revData.forEach((r) => {
              items.push({
                id: r.id,
                title: r.title || "AI Study Reviewer",
                subjectName: r.subjectName || "General Subject",
                createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Recent",
                type: "reviewer",
                contentPreview: r.overview || "Study reviewer and topic breakdown...",
                rawItem: r,
              });
            });
          }
        }

        if (isSubscribed) setSavedItems(items);
      } catch (err) {
        console.error("Fetch saved AI resources error:", err);
      } finally {
        if (isSubscribed) setIsLoadingSaved(false);
      }
    };

    loadSaved();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id]);

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
        console.error("Fetch AI Assistant data error:", err);
      }
    };

    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [subjectId, currentUser?.id, currentUser?.role]);

  const handleMaterialChange = (matId: string) => {
    setSelectedMaterialId(matId);
    setGeneratedOutput(null);
    setErrorMsg(null);
    setSavedSuccess(false);
    if (matId === "custom") {
      setCustomText("");
    } else {
      const mat = materials.find((m) => m.id === matId);
      if (mat) {
        setCustomText(mat.extractedText);
        setSubjectId(mat.subjectId);
      }
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploadingFile(true);
    setUploadSuccessMsg(null);
    setErrorMsg(null);

    try {
      const isPersonal = subjectId === "personal" || currentUser?.role !== "teacher";      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("subjectId", subjectId || subjects[0]?.id || "sub-101");
      formData.append("uploadedBy", currentUser?.name || "Student User");
      formData.append("uploaderRole", currentUser?.role || "student");
      formData.append("uploaderId", currentUser?.id || "usr-student-1");
      formData.append("materialType", isPersonal ? "personal" : "course");

      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type");
      let data: Record<string, unknown> | null = null;
      if (contentType && contentType.includes("application/json")) {
        data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      }

      if (res.ok && data) {
        const newMaterial = data as unknown as LearningMaterial;
        setMaterials((prev) => [newMaterial, ...prev]);
        setSelectedMaterialId(newMaterial.id);
        setCustomText(newMaterial.extractedText);
        setUploadSuccessMsg(`Successfully uploaded and extracted text from "${file.name}"!`);
      } else {
        const errDetail = data?.error || (await res.text().catch(() => "")) || `Server returned status ${res.status}`;
        setErrorMsg(errDetail);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Direct file upload error:", err);
      setErrorMsg("Upload failed: " + errorMsg);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleGenerate = async () => {
    if (!customText || customText.trim().length === 0) {
      setErrorMsg("Please select a lecture material or enter text content.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedOutput(null);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text: customText,
          quizCount,
          flashcardCount,
          subjectName: subjects.find((s) => s.id === subjectId)?.name || "General Subject",
        }),
      });

      const contentType = res.headers.get("content-type");
      let data: Record<string, unknown> | null = null;
      if (contentType && contentType.includes("application/json")) {
        data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      }

      if (res.ok && data) {
        setGeneratedOutput(data);
        setEditTitle(
          mode === "quiz"
            ? "Automated Assessment: " + (materials.find((m) => m.id === selectedMaterialId)?.title || "Lecture Notes")
            : mode === "flashcards"
            ? "Adaptive Flashcard Deck"
            : mode === "summary"
            ? "Executive Summary"
            : "Comprehensive Study Reviewer"
        );
      } else {
        const errDetail = data?.error || (await res.text().catch(() => "")) || `Server returned status ${res.status}`;
        setErrorMsg(errDetail || "Generation failed.");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("AI Generation error:", err);
      setErrorMsg("AI Generation error: " + errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadResource = (downloadTarget?: { title: string; type: string; itemData: Record<string, unknown> }) => {
    const selectedSubject = subjects.find((s) => s.id === subjectId) || subjects[0];
    
    let targetMode = mode;
    let targetData: GeneratedResult | Record<string, unknown> | null = generatedOutput;
    let docTitle = editTitle || (mode === "reviewer" ? "AI Study Reviewer" : "AI Lecture Summary");

    if (downloadTarget) {
      targetMode = downloadTarget.type as "summary" | "reviewer";
      targetData = downloadTarget.itemData;
      docTitle = downloadTarget.title;
    }

    if (!targetData) return;

    let content = `==================================================\n`;
    content += `${docTitle.toUpperCase()}\n`;
    content += `Subject: ${selectedSubject?.code || "StudyLens"} - ${selectedSubject?.name || "General Course"}\n`;
    content += `Generated Date: ${new Date().toLocaleString()}\n`;
    content += `Source Engine: StudyLens AI (Cerebras / Gemini 3.6 Flash)\n`;
    content += `==================================================\n\n`;

    const data = targetData as Record<string, unknown>;

    if (targetMode === "summary") {
      content += `SECTION 1: EXECUTIVE SUMMARY\n`;
      content += `--------------------------------------------------\n`;
      content += `${data.executiveSummary || ""}\n\n`;

      if (Array.isArray(data.keyTakeaways) && data.keyTakeaways.length > 0) {
        content += `SECTION 2: KEY TAKEAWAYS & HIGHLIGHTS\n`;
        content += `--------------------------------------------------\n`;
        data.keyTakeaways.forEach((k: string, i: number) => {
          content += `${i + 1}. ${k}\n`;
        });
        content += `\n`;
      }

      if (Array.isArray(data.bulletPoints) && data.bulletPoints.length > 0) {
        content += `SECTION 3: CORE BULLET POINTS & CONCEPTS\n`;
        content += `--------------------------------------------------\n`;
        data.bulletPoints.forEach((b: string) => {
          content += `• ${b}\n`;
        });
        content += `\n`;
      }
    } else if (targetMode === "reviewer") {
      content += `SECTION 1: CONCEPT OVERVIEW\n`;
      content += `--------------------------------------------------\n`;
      content += `${data.overview || ""}\n\n`;

      if (Array.isArray(data.topics) && data.topics.length > 0) {
        content += `SECTION 2: TOPIC-BY-TOPIC DETAILED BREAKDOWN\n`;
        content += `--------------------------------------------------\n\n`;
        data.topics.forEach((t: Record<string, unknown>, i: number) => {
          content += `TOPIC ${i + 1}: ${t.topic || t.topicName || "Study Topic"}\n`;
          if (t.overview) content += `Overview: ${t.overview}\n`;
          content += `--------------------------------------------------\n`;
          
          const keyPts = (t.keyConcepts || t.keyPoints) as string[] | undefined;
          if (Array.isArray(keyPts)) {
            content += `Key Concepts:\n`;
            keyPts.forEach((kp: string) => {
              content += `  - ${kp}\n`;
            });
          }

          const sampleQs = t.sampleQuestions as string[] | undefined;
          if (Array.isArray(sampleQs)) {
            content += `Sample Self-Check Questions:\n`;
            sampleQs.forEach((sq: string) => {
              content += `  [?] ${sq}\n`;
            });
          }
          content += `\n`;
        });
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeSubjectCode = selectedSubject?.code || "COURSE";
    const fileTimestamp = new Date().getTime();
    link.download = `${safeSubjectCode}_${targetMode.toUpperCase()}_${fileTimestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveResource = async () => {
    if (!generatedOutput) return;

    const selectedSubject = subjects.find((s) => s.id === subjectId) || subjects[0];

    try {
      let endpoint = "/api/quizzes";
      let payload: Record<string, unknown> = {};

      const isTeacher = currentUser?.role === "teacher";

      if (mode === "quiz") {
        endpoint = "/api/quizzes";
        payload = {
          title: editTitle || "AI Assessment",
          description: "Automated Bloom's taxonomy quiz generated via Cerebras/Gemini AI",
          subjectId: selectedSubject.id,
          questions: generatedOutput.questions || [],
          isPublished: isTeacher ? isPublishedToggle : false,
          createdById: currentUser?.id,
          createdByName: currentUser?.name,
          quizType: isTeacher ? "teacher" : "student",
          uploaderRole: currentUser?.role || "student",
          timeLimitMinutes: 15,
          passPercentage: 70,
        };
      } else if (mode === "flashcards") {
        endpoint = "/api/flashcards";
        payload = {
          title: editTitle || "AI Flashcards",
          subjectId: selectedSubject.id,
          subjectName: `${selectedSubject.code} - ${selectedSubject.name}`,
          cards: generatedOutput.cards || [],
          isPublished: isTeacher ? isPublishedToggle : false,
          createdById: currentUser?.id,
          uploaderRole: currentUser?.role || "student",
        };
      } else if (mode === "summary") {
        endpoint = "/api/summaries";
        payload = {
          title: editTitle || "AI Lecture Summary",
          subjectId: selectedSubject.id,
          subjectName: `${selectedSubject.code} - ${selectedSubject.name}`,
          executiveSummary: generatedOutput.executiveSummary,
          keyTakeaways: generatedOutput.keyTakeaways,
          bulletPoints: generatedOutput.bulletPoints,
          isPublished: isTeacher ? isPublishedToggle : false,
          createdById: currentUser?.id,
          uploaderRole: currentUser?.role || "student",
        };
      } else if (mode === "reviewer") {
        endpoint = "/api/reviewers";
        payload = {
          title: editTitle || "AI Study Reviewer",
          subjectId: selectedSubject.id,
          subjectName: `${selectedSubject.code} - ${selectedSubject.name}`,
          overview: generatedOutput.overview,
          topics: generatedOutput.topics,
          isPublished: isTeacher ? isPublishedToggle : false,
          createdById: currentUser?.id,
          uploaderRole: currentUser?.role || "student",
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Also save to Learning Materials repository for direct viewing
      if (mode === "summary" || mode === "reviewer") {
        const matPayload = {
          title: editTitle || (mode === "summary" ? "AI Lecture Summary" : "AI Study Reviewer"),
          description: mode === "summary" ? (generatedOutput.executiveSummary || "") : (generatedOutput.overview || ""),
          subjectId: isTeacher ? selectedSubject.id : "personal",
          textInput: mode === "summary" ? (generatedOutput.executiveSummary || "") : (generatedOutput.overview || ""),
          uploadedBy: currentUser?.name || "User",
          uploaderRole: currentUser?.role || "student",
          uploaderId: currentUser?.id || "usr-1",
          materialType: isTeacher ? "course" : "personal",
        };

        const formData = new FormData();
        Object.entries(matPayload).forEach(([k, v]) => formData.append(k, String(v)));
        fetch("/api/materials/upload", { method: "POST", body: formData }).catch(() => {});
      }

      if (res.ok) {
        setSavedSuccess(true);
        fetchSavedResources();
      }
    } catch (err) {
      console.error("Save resource error:", err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title Card */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50/50 border border-blue-200/80 text-slate-900 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-950 dark:border-blue-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg space-y-3 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200/80 dark:bg-blue-500/30 dark:text-blue-200 dark:border-blue-400/20 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
            <span>AI Powered Generation Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Study Assistant & Automated Resource Generator</h1>
          <p className="text-slate-600 dark:text-slate-300 text-xs max-w-2xl leading-relaxed">
            Transform raw text or uploaded documents into structured Bloom's taxonomy quizzes, executive summaries, study reviewers, or adaptive flashcards.
          </p>
        </div>

        {/* Button to toggle Saved AI Resources Repository */}
        <button
          onClick={() => {
            setShowSavedLibrary(!showSavedLibrary);
            if (!showSavedLibrary) fetchSavedResources();
          }}
          className="px-4 py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shadow-md shrink-0 cursor-pointer border border-blue-400/30"
        >
          <FolderArchive className="w-4 h-4 text-amber-300" />
          <span>{showSavedLibrary ? "Hide Saved Resources" : `Saved Resources Library (${savedItems.length})`}</span>
        </button>
      </div>

      {/* Saved AI Resources Library Drawer / Section */}
      {showSavedLibrary && (
        <div className="bg-card border border-primary/30 p-6 rounded-2xl shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-2">
              <BookMarked className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">My Saved AI Resources & Reviewers</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {savedItems.length} Saved
              </span>
            </div>
            <button
              onClick={() => setShowSavedLibrary(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoadingSaved ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading saved AI resources...</div>
          ) : savedItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <FolderArchive className="w-8 h-8 text-muted-foreground mx-auto opacity-50 mb-2" />
              <p className="font-bold">No saved AI resources yet</p>
              <p>Generate a summary, reviewer, or quiz below and save it to access it anytime here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{item.createdAt}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground font-semibold">{item.subjectName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3 bg-card p-2 rounded-lg border border-border/60">
                      {item.contentPreview}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/50">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setSelectedSavedItem(item)}
                        className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => setDeleteSavedConfirmItem(item)}
                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                        title="Delete Saved Resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        handleDownloadResource({
                          title: item.title,
                          type: item.type,
                          itemData: item.rawItem,
                        })
                      }
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Viewing Saved Resource Preview Modal */}
      {selectedSavedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-md">
                  Saved {selectedSavedItem.type}
                </span>
                <h3 className="text-lg font-bold text-foreground mt-1">{selectedSavedItem.title}</h3>
                <p className="text-xs text-muted-foreground">{selectedSavedItem.subjectName}</p>
              </div>
              <button
                onClick={() => setSelectedSavedItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl border border-border text-xs leading-relaxed space-y-3 font-mono whitespace-pre-wrap">
              {JSON.stringify(selectedSavedItem.rawItem, null, 2)}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedSavedItem(null)}
                className="px-4 py-2 bg-muted text-foreground font-semibold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() =>
                  handleDownloadResource({
                    title: selectedSavedItem.title,
                    type: selectedSavedItem.type,
                    itemData: selectedSavedItem.rawItem,
                  })
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Document (.txt)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Options Panel (1 col) */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-foreground border-b border-border pb-2">
            1. Configure AI Inputs
          </h3>

          {/* Select Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground">Target Resource Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeSelect("quiz")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  mode === "quiz"
                    ? "bg-primary/10 border-primary text-primary shadow-2xs"
                    : "bg-muted/40 border-border text-foreground hover:bg-muted"
                }`}
              >
                <CheckSquare className="w-4 h-4 text-primary" />
                <span>Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect("flashcards")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  mode === "flashcards"
                    ? "bg-primary/10 border-primary text-primary shadow-2xs"
                    : "bg-muted/40 border-border text-foreground hover:bg-muted"
                }`}
              >
                <Layers className="w-4 h-4 text-primary" />
                <span>Flashcards</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect("summary")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  mode === "summary"
                    ? "bg-primary/10 border-primary text-primary shadow-2xs"
                    : "bg-muted/40 border-border text-foreground hover:bg-muted"
                }`}
              >
                <FileText className="w-4 h-4 text-primary" />
                <span>Summary</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect("reviewer")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  mode === "reviewer"
                    ? "bg-primary/10 border-primary text-primary shadow-2xs"
                    : "bg-muted/40 border-border text-foreground hover:bg-muted"
                }`}
              >
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Reviewer</span>
              </button>
            </div>
          </div>

          {/* Select Material Source / Input Method */}
          <div className="space-y-3 text-xs">
            <label className="block font-bold text-foreground">Source Material Input Method</label>
            <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setInputMethod("upload")}
                className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                  inputMethod === "upload"
                    ? "bg-card text-foreground shadow-2xs border border-border font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">Upload File</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod("saved")}
                className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                  inputMethod === "saved"
                    ? "bg-card text-foreground shadow-2xs border border-border font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">Saved ({materials.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod("paste")}
                className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                  inputMethod === "paste"
                    ? "bg-card text-foreground shadow-2xs border border-border font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Paperclip className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="truncate">Paste Notes</span>
              </button>
            </div>

            {/* TAB 1: UPLOAD FILE */}
            {inputMethod === "upload" && (
              <div className="space-y-2">
                {isUploadingFile ? (
                  <div className="border-2 border-dashed border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 rounded-xl p-5 text-center transition-all relative">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-2.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full animate-bounce">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-foreground text-xs">
                        Extracting & Processing Material...
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Converting document into structured AI study context
                      </p>
                    </div>
                  </div>
                ) : uploadedFile || uploadSuccessMsg ? (
                  /* UPLOADED & EXTRACTED STATE */
                  <div className="border-2 border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl p-4 transition-all relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground text-xs truncate">
                            {uploadedFile?.name || "Uploaded Document"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> Extracted & Ready
                            </span>
                            {customText && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ({customText.length} chars)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <label className="px-2.5 py-1.5 bg-card hover:bg-muted border border-border text-foreground text-[11px] font-semibold rounded-lg cursor-pointer transition-all shadow-2xs hover:shadow-xs flex items-center space-x-1">
                          <span>Change File</span>
                          <input
                            type="file"
                            accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
                            onChange={handleDirectFileUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            setUploadSuccessMsg(null);
                            setCustomText("");
                          }}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition-all"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* DEFAULT DROPZONE STATE */
                  <div className="border-2 border-dashed border-blue-500/40 hover:border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 rounded-xl p-4 text-center transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
                      onChange={handleDirectFileUpload}
                      disabled={isUploadingFile}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-foreground text-xs">
                        Click or Drag File to Upload
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Supports PDF, DOCX, PPTX, TXT, PNG, JPG (Max 30MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SAVED MATERIALS */}
            {inputMethod === "saved" && (
              <div>
                <label className="block font-semibold text-foreground mb-1">Select Saved Material Document</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl"
                >
                  <option value="custom">-- Choose Material --</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.subjectName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentUser?.role === "teacher" && (
              <div>
                <label className="block font-semibold text-foreground mb-1">Target Resource Format & Course Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl"
                >
                  <option value="personal">✏️ Personal Faculty Note / Self-Study (Private)</option>
                  <optgroup label="🎓 Enrolled Course Subjects (Shared with Students)">
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {mode === "quiz" && (
              <div>
                <label className="block font-semibold text-foreground mb-1">Number of Quiz Questions</label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={quizCount}
                  onChange={(e) => setQuizCount(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl font-bold text-foreground"
                />
              </div>
            )}

            {mode === "flashcards" && (
              <div>
                <label className="block font-semibold text-foreground mb-1">Number of Flashcards</label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={flashcardCount}
                  onChange={(e) => setFlashcardCount(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl font-bold text-foreground"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-foreground">
                  Extracted Lecture Content
                </label>
                {customText && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {customText.length} chars ready
                  </span>
                )}
              </div>
              <textarea
                rows={5}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Upload a file above, select saved materials, or paste lecture notes here..."
                className="w-full p-3 border border-border bg-muted/40 rounded-xl text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isGenerating ? "Synthesizing AI Output..." : "Generate Resource"}</span>
            </button>
          </div>
        </div>

        {/* Right Output Panel (2 cols) */}
        <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-foreground">2. AI Generated Output & Inspection</h3>
            {generatedOutput && (
              <div className="flex items-center space-x-2">
                {(mode === "reviewer" || mode === "summary") && (
                  <button
                    onClick={() => handleDownloadResource()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    title={`Download ${mode === "reviewer" ? "Reviewer" : "Summary"} as formatted text file`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {mode === "reviewer" ? "Reviewer" : "Summary"} (.txt)</span>
                  </button>
                )}

                <button
                  onClick={handleSaveResource}
                  disabled={savedSuccess}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer ${
                    savedSuccess
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {currentUser?.role === "teacher"
                          ? "Published to LMS!"
                          : "Saved to Personal Resources!"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>
                        {currentUser?.role === "teacher"
                          ? "Save & Publish to LMS"
                          : "Save to My Personal Resources"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!generatedOutput && !isGenerating && !errorMsg && (
            <div className="py-20 text-center text-muted-foreground space-y-2">
              <Sparkles className="w-10 h-10 text-primary mx-auto opacity-50" />
              <p className="text-sm font-bold text-foreground">No output generated yet</p>
              <p className="text-xs">
                Select a lecture material on the left and click "Generate Resource" to build AI quizzes or summaries.
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="py-20 text-center text-primary space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-bold text-foreground">
                AI Socratic Engine is analyzing document structure...
              </p>
            </div>
          )}

          {generatedOutput && (
            <div className="space-y-6">
              {/* Title Editor */}
              <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-foreground">Resource Title (Editable)</label>
                  {currentUser?.role === "teacher" ? (
                    <label className="flex items-center space-x-2 font-semibold text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPublishedToggle}
                        onChange={(e) => setIsPublishedToggle(e.target.checked)}
                        className="rounded border-border text-blue-600 focus:ring-blue-500"
                      />
                      <span>Publish to Enrolled Students Immediately</span>
                    </label>
                  ) : (
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      🔒 Saved to Private Personal Notes
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quiz Render */}
              {mode === "quiz" && generatedOutput.questions && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Generated Quiz Questions ({generatedOutput.questions.length})
                  </h4>
                  {generatedOutput.questions.map((q, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">Question {idx + 1}</span>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-bold text-[10px]">
                          Bloom's: {q.bloomsLevel}
                        </span>
                      </div>
                      <p className="font-bold text-foreground">{q.question}</p>
                      {q.options && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`p-2 rounded-lg border text-[11px] ${
                                oIdx === q.correctAnswer
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                  : "bg-card border-border text-foreground"
                              }`}
                            >
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground pt-1">
                        <strong className="text-foreground">Explanation:</strong> {q.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Flashcards Render */}
              {mode === "flashcards" && generatedOutput.cards && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Generated Flashcards ({generatedOutput.cards.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {generatedOutput.cards.map((card, cIdx) => (
                      <div key={cIdx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-primary uppercase">Card #{cIdx + 1}</span>
                        <p className="font-bold text-foreground">Front: {card.question}</p>
                        <p className="text-muted-foreground pt-1 border-t border-border">Back: {card.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Render */}
              {mode === "summary" && (
                <div className="space-y-4 text-xs leading-relaxed text-foreground">
                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                    <h4 className="font-bold text-primary uppercase tracking-wider text-[11px]">Executive Summary</h4>
                    <p>{generatedOutput.executiveSummary}</p>
                  </div>

                  {generatedOutput.keyTakeaways && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground text-xs">Key Takeaways</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {generatedOutput.keyTakeaways.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Reviewer Render */}
              {mode === "reviewer" && (
                <div className="space-y-4 text-xs leading-relaxed text-foreground">
                  <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                    <h4 className="font-bold text-primary uppercase tracking-wider text-[11px]">Overview</h4>
                    <p>{generatedOutput.overview}</p>
                  </div>

                  {generatedOutput.topics?.map((topic, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border space-y-2">
                      <h4 className="font-bold text-sm text-foreground">{topic.topic}</h4>
                      <p className="text-muted-foreground">{topic.overview}</p>
                      {topic.keyConcepts && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {topic.keyConcepts.map((kc, kIdx) => (
                            <span key={kIdx} className="px-2 py-0.5 bg-primary/10 text-primary rounded font-semibold text-[10px]">
                              {kc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Saved AI Resource Confirmation Modal */}
      {deleteSavedConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Saved AI Resource?</h3>
                <p className="text-xs text-muted-foreground">Confirmation required</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1 text-xs text-rose-800 dark:text-rose-200">
              <p className="font-bold">Are you sure you want to delete this AI resource?</p>
              <p className="text-[11px] leading-relaxed opacity-90">
                "{deleteSavedConfirmItem.title}" will be permanently deleted from your saved library. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => setDeleteSavedConfirmItem(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSavedResource(deleteSavedConfirmItem)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Resource</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
