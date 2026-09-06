import React, { useState, useEffect, useRef } from "react";
import { Sparkles, BookOpen, CheckSquare, Layers, FileText, Save, Check, AlertCircle, UploadCloud, X, CheckCircle2, Download, Plus, AlertTriangle,} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import {
  getWorkspace,
  saveWorkspace,
  clearWorkspace,
  registerJob,
  clearJob,
  isJobRunning,
  getActiveJob,
  subscribe,
  emptyWorkspace,
  type AIMode,
  type AIGeneratedResult,
} from "../../utils/aiWorkspaceCache";
import type { LearningMaterial } from "../../types";

const friendlyAiError = (message: string, code?: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes("payment") || lower.includes("billing") || code === "PAYMENT_REQUIRED") {
    return "The AI service is currently unavailable. Your request was handled locally instead, so generation is still allowed.";
  }
  if (lower.includes("limit") || lower.includes("rate limit") || code === "RATE_LIMITED") {
    return "You have reached the AI generation limit for this session. Please wait a moment and try again.";
  }
  return message;
};

const slugifyName = (s: string): string => {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return slug || "studylens-resource";
};

const exportAiPdf = async (input: {
  mode: "summary" | "reviewer" | "quiz" | "flashcards";
  title: string;
  subjectName?: string;
  data: Record<string, unknown>;
}): Promise<Blob> => {
  const res = await authFetch("/api/ai/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = "PDF export failed.";
    try {
      const body = await res.json();
      if (typeof body.error === "string") msg = body.error;
    } catch {
      // keep default message
    }
    throw new Error(msg);
  }
  return res.blob();
};

const triggerPdfDownload = (blob: Blob, baseName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface AIStudyAssistantPageProps {
  initialMaterial?: LearningMaterial | null;
  // Weak-topic hand-off from the student dashboard: pre-fills a tailored
  // study prompt so the student just presses Generate.
  initialTopic?: string | null;
  onSeedConsumed?: () => void;
}

export const AIStudyAssistantPage: React.FC<AIStudyAssistantPageProps> = ({
  initialMaterial,
  initialTopic,
  onSeedConsumed,
}) => {
  const { currentUser } = useAuth();
  const promptInputRef = useRef<HTMLInputElement | null>(null);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);

  // Restore the last AI workspace for this user (survives navigating away and
  // page refreshes), so previously generated results reappear on return.
  const cachedWs = (() => (currentUser?.id ? getWorkspace(currentUser.id) : null))();
  const initialWs = cachedWs ? { ...cachedWs } : emptyWorkspace();
  const hasCachedSource = Boolean(initialWs.sourceText && !initialMaterial);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(initialMaterial?.id || initialWs.selectedMaterialId || "");
  const [sourceText, setSourceText] = useState<string>(initialMaterial?.extractedText || initialWs.sourceText || "");
  const [prompt, setPrompt] = useState<string>(initialWs.prompt || "");
  const [mode, setMode] = useState<AIMode>(initialWs.mode || "quiz");

  // Input Content State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(initialWs.uploadedFileName || null);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(hasCachedSource && initialWs.uploadedFileName ? `Restored extracted text from "${initialWs.uploadedFileName}".` : null);

  // Options
  const [quizCount, setQuizCount] = useState<string>(initialWs.quizCount || "5");
  const [flashcardCount, setFlashcardCount] = useState<string>(initialWs.flashcardCount || "5");
  const [quizRevealAnswers] = useState<boolean>(initialWs.quizRevealAnswers ?? true);

  // AI Output
  const [isGenerating, setIsGenerating] = useState<boolean>(Boolean(currentUser?.id && isJobRunning(currentUser.id)) || initialWs.pending === true);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<AIGeneratedResult | null>(initialWs.generatedOutput || null);
  // Per-format draft cache: switching formats preserves each generated draft
  // instead of resetting it, so users can bounce between Quiz/Flashcards/
  // Summary/Reviewer without losing work.
  const [drafts, setDrafts] = useState<Partial<Record<AIMode, AIGeneratedResult | null>>>(initialWs.drafts || {});
  const [draftTitles, setDraftTitles] = useState<Partial<Record<AIMode, string>>>(initialWs.draftTitles || {});
  const [savedSuccess, setSavedSuccess] = useState(false);
  // Remembers which formats already had their current draft saved so returning
  // to that format shows a disabled "Saved" state instead of offering a re-save.
  const [savedDrafts, setSavedDrafts] = useState<Partial<Record<AIMode, boolean>>>(initialWs.savedDrafts || {});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(initialWs.offlineNotice === true);
  const [titleExists, setTitleExists] = useState(initialWs.titleExists === true);

  // Teacher Editable State
  const [editTitle, setEditTitle] = useState(initialWs.editTitle || (initialWs.generatedOutput ? (draftTitles[initialWs.mode] ?? "") : ""));

  // Source attach menu state
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Reflect whether the component is currently mounted (avoids setting React
  // state after navigating away while a background generation finishes).
  const mountedRef = useRef(true);
  // Tracks the newest persisted completion so the completion listener only
  // reacts to genuinely new results (prevents update loops).
  const lastCompletedRef = useRef<number>(initialWs.completedAt || 0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistWorkspace = () => {
    const uid = currentUser?.id;
    if (!uid) return;
    const ws = {
      mode,
      prompt,
      sourceText,
      selectedMaterialId,
      uploadedFileName: uploadedFileName || undefined,
      quizCount,
      flashcardCount,
      quizRevealAnswers,
      drafts,
      draftTitles,
      savedDrafts,
      generatedOutput,
      editTitle,
      offlineNotice,
      titleExists,
      pending: isJobRunning(uid),
    };
    saveWorkspace(uid, ws);
  };

  // Persist the workspace whenever any part of it changes.
  useEffect(() => {
    persistWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode, prompt, sourceText, selectedMaterialId, uploadedFileName,
    quizCount, flashcardCount, quizRevealAnswers,
    drafts, draftTitles, savedDrafts, generatedOutput, editTitle,
    offlineNotice, titleExists, currentUser?.id,
  ]);

  // On mount, if a background generation is still running, keep the spinner
  // up; the finished result is written into the cache by the module-level
  // completion handler and picked up when the user returns.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (isJobRunning(currentUser.id)) {
      setIsGenerating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Subscribe to workspace updates so that a generation that finishes in the
  // background (while this page is mounted again) refreshes the view.
  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) return;
    const unsubscribe = subscribe(uid, (ws) => {
      const completed = ws.completedAt || 0;
      if (completed > lastCompletedRef.current) {
        lastCompletedRef.current = completed;
        if (mountedRef.current && ws.generatedOutput) {
          const wsMode: AIMode = ws.mode || mode;
          setGeneratedOutput(ws.generatedOutput);
          setDrafts((prev) => ({ ...prev, [wsMode]: ws.generatedOutput }));
          const title = ws.editTitle || ws.draftTitles?.[wsMode] || "";
          setEditTitle(title);
          setDraftTitles((prev) => ({ ...prev, [wsMode]: title }));
          setOfflineNotice(ws.offlineNotice === true);
          setTitleExists(ws.titleExists === true);
          setIsGenerating(false);
          setSavedSuccess(false);
        }
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Clear the persisted workspace for a previous user so accounts never leak.
  useEffect(() => {
    if (currentUser?.id) {
      const cached = getWorkspace(currentUser.id);
      // A fresh pre-seed that was never saved should not resurrect old data.
      if (cached && !cached.generatedOutput && !cached.prompt && !cached.sourceText && !Object.keys(cached.drafts || {}).length && !isJobRunning(currentUser.id)) {
        clearWorkspace(currentUser.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Weak-topic seed: drop a ready-to-run study prompt into the generator.
  const seededTopicRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialTopic || seededTopicRef.current === initialTopic) return;
    seededTopicRef.current = initialTopic;
    setMode("reviewer");
    setPrompt(
      `I'm struggling with "${initialTopic}". Explain it simply, give me a step-by-step study plan, and include practice questions to test my understanding.`
    );
    const timer = setTimeout(() => {
      promptInputRef.current?.focus();
      onSeedConsumed?.();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic]);

  const handleModeSelect = (newMode: AIMode) => {
    setMode(newMode);
    setGeneratedOutput(drafts[newMode] ?? null);
    setEditTitle(draftTitles[newMode] ?? "");
    setErrorMsg(null);
    setSavedSuccess(false);
    setSaveSuccessMsg(null);
    setOfflineNotice(false);
  };

  const generateAbortRef = useRef<AbortController | null>(null);

  const handleCancelGenerate = () => {
    const uid = currentUser?.id;
    if (uid) {
      const job = getActiveJob(uid);
      if (job?.controller) job.controller.abort();
      clearJob(uid);
    }
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
      generateAbortRef.current = null;
    }
    setIsGenerating(false);
    setErrorMsg("AI generation cancelled.");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isGenerating) handleCancelGenerate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isGenerating]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const matRes = await authFetch(`/api/materials?userId=${currentUser?.id || ""}&userRole=${currentUser?.role || ""}`);
        if (matRes.ok) {
          const matData = await matRes.json();
          if (isSubscribed) setMaterials(matData);
        }
      } catch (err) {
        console.error("Fetch AI Assistant data error:", err);
      }
    };

    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id, currentUser?.role]);

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isGenerating) {
      setErrorMsg("Finish or cancel generation before uploading a new file.");
      return;
    }

    setUploadedFile(file);
    setUploadedFileName(file.name);
    setIsUploadingFile(true);
    setUploadSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Attachments are generation-only inputs: extract their text WITHOUT
      // persisting anything into Learning Materials.
      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetch("/api/materials/extract", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type");
      let data: Record<string, unknown> | null = null;
      if (contentType && contentType.includes("application/json")) {
        data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      }

      if (res.ok && data) {
        const extractedText = String((data as { text?: string }).text || "");
        if (!extractedText.trim()) {
          setErrorMsg(`Could not extract any readable text from "${file.name}". Try pasting the content instead.`);
          return;
        }
        setSourceText(extractedText);
        setUploadSuccessMsg(`Extracted text from "${file.name}" — ready to generate. Nothing was saved to your materials.`);
      } else {
        const errDetail = String(data?.error || "Upload failed. Please check the server connection and try again.");
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
    const content = (sourceText || "").trim() || prompt.trim();
    if (!content) {
      setErrorMsg("Type a prompt, attach a file, or load a saved material to generate from.");
      return;
    }
    const uid = currentUser?.id;
    if (!uid) {
      setErrorMsg("You must be signed in to generate resources.");
      return;
    }

    const genMode = mode;
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedOutput(null);
    setSavedSuccess(false);
    setSavedDrafts((prev) => ({ ...prev, [genMode]: false }));
    setOfflineNotice(false);
    setTitleExists(false);

    const controller = new AbortController();
    generateAbortRef.current = controller;
    registerJob(uid, genMode, controller);

    try {
      const requestedQuizCount = parseInt(quizCount, 10);
      const requestedFlashcardCount = parseInt(flashcardCount, 10);
      const res = await authFetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: genMode,
          text: content,
          instructions: prompt.trim(),
          // Draft by default: nothing is persisted until the user presses "Save Resource".
          save: false,
          quizCount: Number.isNaN(requestedQuizCount) ? 5 : requestedQuizCount,
          flashcardCount: Number.isNaN(requestedFlashcardCount) ? 5 : requestedFlashcardCount,
          materialId: selectedMaterialId && selectedMaterialId !== "custom" ? selectedMaterialId : undefined,
          createdById: currentUser?.id || "usr-1",
          createdByName: currentUser?.name || "User",
          userRole: currentUser?.role || "student",
          quizType: currentUser?.role === "teacher" ? "teacher" : "student",
          revealAnswers: genMode === "quiz" ? quizRevealAnswers : undefined,
          difficulty: "medium",
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type");
      let data: Record<string, unknown> | null = null;
      if (contentType && contentType.includes("application/json")) {
        data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      }

      if (res.ok && data) {
        const result = data as AIGeneratedResult;
        const modeLabel =
          genMode === "quiz" ? "Quiz" : genMode === "flashcards" ? "Flashcard Deck" : genMode === "summary" ? "Summary" : "Reviewer";
        const fileBase = uploadedFile?.name?.replace(/\.[^/.]+$/, "") || "";
        const promptBase = prompt.trim().slice(0, 60);
        const sourceTitle = fileBase || promptBase || (materials.find((m) => m.id === selectedMaterialId)?.title ?? "");
        const computedTitle = sourceTitle ? `${modeLabel}: ${sourceTitle}` : result.title || modeLabel;

        // Persist to the workspace cache so the result survives navigating away.
        // This runs even if the component unmounted mid-generation.
        const existing = getWorkspace(uid) ?? emptyWorkspace();
        existing.mode = genMode;
        existing.generatedOutput = result;
        existing.drafts = { ...existing.drafts, [genMode]: result };
        existing.draftTitles = { ...existing.draftTitles, [genMode]: computedTitle };
        existing.editTitle = computedTitle;
        existing.sourceText = sourceText || existing.sourceText;
        existing.offlineNotice = data.source === "offline-fallback";
        existing.titleExists = data.titleExists === true;
        existing.completedAt = Date.now();
        saveWorkspace(uid, existing);

        if (mountedRef.current) {
          setGeneratedOutput(result);
          setDrafts((prev) => ({ ...prev, [genMode]: result }));
          setOfflineNotice(data.source === "offline-fallback");
          setTitleExists(data.titleExists === true);
          setEditTitle(computedTitle);
          setDraftTitles((prev) => ({ ...prev, [genMode]: computedTitle }));
          setSavedSuccess(false);
        }
      } else if (data) {
        const rawError = typeof data.error === "string" ? data.error : `Server returned status ${res.status}`;
        const errorCode = typeof data.code === "string" ? data.code : "";
        if (mountedRef.current) setErrorMsg(friendlyAiError(rawError, errorCode));
      } else if (mountedRef.current) {
        setErrorMsg("The server returned an invalid response. Please ensure the Flask backend is running.");
      }
    } catch (err: unknown) {
      const abortName = (err as { name?: string } | null)?.name;
      if (generateAbortRef.current === controller) generateAbortRef.current = null;
      if (abortName === "AbortError") {
        if (mountedRef.current) setErrorMsg("AI generation cancelled.");
        return;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("AI Generation error:", err);
      if (mountedRef.current) setErrorMsg("AI Generation error: " + errorMsg);
    } finally {
      if (generateAbortRef.current === controller) generateAbortRef.current = null;
      clearJob(uid);
      if (mountedRef.current) setIsGenerating(false);
    }
  };

  const handleDownloadResource = async (downloadTarget?: { title: string; type: string; itemData: Record<string, unknown> }) => {
    let targetMode: AIMode | "flashcard" = mode;
    let targetData: AIGeneratedResult | Record<string, unknown> | null = generatedOutput;
    let docTitle = editTitle || (mode === "reviewer" ? "AI Study Reviewer" : "AI Lecture Summary");

    if (downloadTarget) {
      targetMode = downloadTarget.type as AIMode | "flashcard";
      targetData = downloadTarget.itemData;
      docTitle = downloadTarget.title;
    }

    if (!targetData) return;

    let pdfMode: "summary" | "reviewer" | "quiz" | "flashcards";
    if (targetMode === "flashcard") pdfMode = "flashcards";
    else if (targetMode === "summary") pdfMode = "summary";
    else if (targetMode === "reviewer") pdfMode = "reviewer";
    else if (targetMode === "quiz") pdfMode = "quiz";
    else pdfMode = "summary";

    try {
      const blob = await exportAiPdf({
        mode: pdfMode,
        title: docTitle,
        data: targetData as Record<string, unknown>,
      });
      triggerPdfDownload(blob, slugifyName(docTitle));
    } catch (err) {
      setErrorMsg((err as Error).message || "Could not export the PDF.");
    }
  };

  // Saved resources live directly in their destinations (sidebar sections), so
  // the save action names exactly where the resource will land.
  const isStaffAccount = currentUser?.role === "teacher" || currentUser?.role === "admin";
  const saveDestinationLabel = (() => {
    if (mode === "quiz") return isStaffAccount ? "Save to Assessment Management" : "Save to Take Quizzes & Tests";
    if (mode === "flashcards") return isStaffAccount ? "Save to Flashcards" : "Save to Flashcards";
    return isStaffAccount ? "Save to Upload & Manage Materials" : "Save to Learning Materials";
  })();

  const resetWorkspace = () => {
    if (currentUser?.id) clearWorkspace(currentUser.id);
    setSelectedMaterialId("");
    setSourceText("");
    setPrompt("");
    setMode("quiz");
    setUploadedFile(null);
    setUploadedFileName(null);
    setQuizCount("5");
    setFlashcardCount("5");
    setGeneratedOutput(null);
    setDrafts({});
    setDraftTitles({});
    setSavedDrafts({});
    setEditTitle("");
    setOfflineNotice(false);
    setTitleExists(false);
    setErrorMsg(null);
  };

  const handleSaveResource = async () => {
    if (!generatedOutput) return;
    setIsSavingResource(true);
    setErrorMsg(null);

    try {
      const res = await authFetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...generatedOutput,
          mode,
          title: editTitle || generatedOutput.title,
          userRole: currentUser?.role || "student",
          quizType: currentUser?.role === "teacher" ? "teacher" : "student",
          revealAnswers: mode === "quiz" ? quizRevealAnswers : undefined,
        }),
      });

      let data: Record<string, unknown> | null = null;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      }

      if (res.ok && data) {
        setSavedSuccess(true);
        setSavedDrafts((prev) => ({ ...prev, [mode]: true }));
        if (mode === "quiz") {
          setSaveSuccessMsg(
            isStaffAccount
              ? "Quiz saved to Assessment Management, where you can edit or publish it."
              : "Quiz saved to Take Quizzes & Tests, where you can practice anytime."
          );
        } else if (mode === "flashcards") {
          setSaveSuccessMsg(
            isStaffAccount
              ? "Flashcards saved to Flashcards — view and study them anytime."
              : "Flashcards saved to Flashcards."
          );
        } else {
          setSaveSuccessMsg(
            isStaffAccount
              ? `${mode === "reviewer" ? "Reviewer" : "Summary"} saved to Upload & Manage Materials — assign a subject there.`
              : `${mode === "reviewer" ? "Reviewer" : "Summary"} saved to Learning Materials.`
          );
        }
        resetWorkspace();
      } else {
        const rawError = typeof data?.error === "string" ? data.error : `Server returned status ${res.status}`;
        const code = typeof data?.code === "string" ? data.code : "";
        setErrorMsg(friendlyAiError(rawError, code));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Save AI resource error:", err);
      setErrorMsg("Save failed: " + errorMsg);
    } finally {
      setIsSavingResource(false);
    }
  };

  const handleDiscardResource = () => {
    resetWorkspace();
    setSavedSuccess(false);
    setSaveSuccessMsg(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Options Panel (1 col) */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-foreground border-b border-border pb-2">
            Inputs
          </h3>

          {/* Select Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground">Format</label>
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

          {/* Prompt + Source Material (attach via +) */}
          <div className="space-y-3 text-xs">
            {/* ATTACH FILE — shown once attached */}
            <div className="space-y-2">
              {isUploadingFile ? (
                <div className="border-2 border-dashed border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 rounded-xl p-4 text-center transition-all relative">
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <div className="p-2.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full animate-bounce">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-foreground text-xs">Extracting & Processing Material...</p>
                  </div>
                </div>
              ) : uploadedFile || uploadSuccessMsg ? (
                <div className="flex items-center justify-between gap-2 border-2 border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl p-3 transition-all relative">
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-xs truncate">{uploadedFile?.name || uploadedFileName || "Uploaded Document"}</p>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <Check className="w-3 h-3" /> Extracted & Ready {sourceText ? `(${sourceText.length} chars)` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <label className="px-2.5 py-1.5 bg-card hover:bg-muted border border-border text-foreground text-[11px] font-semibold rounded-lg cursor-pointer transition-all hover:shadow-xs flex items-center space-x-1">
                      <span>Change</span>
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
                        setUploadedFileName(null);
                        setUploadSuccessMsg(null);
                        setSourceText("");
                        setSelectedMaterialId("");
                      }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition-all"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {mode === "quiz" && (
              <div>
                <label className="block font-semibold text-foreground mb-1">Number of Quiz Questions</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={quizCount}
                  onChange={(e) => setQuizCount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isGenerating) handleGenerate();
                  }}
                  className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl font-bold text-foreground"
                />
              </div>
            )}

            {mode === "flashcards" && (
              <div>
                <label className="block font-semibold text-foreground mb-1">Number of Flashcards</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={flashcardCount}
                  onChange={(e) => setFlashcardCount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isGenerating) handleGenerate();
                  }}
                  className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl font-bold text-foreground"
                />
              </div>
            )}

            {/* Prompt field with + attach menu */}
            <div>
              <label className="block font-semibold text-foreground mb-1">Prompt</label>
              <div className="flex items-stretch gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu((v) => !v)}
                    className="w-10 h-full min-h-[36px] flex items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground hover:bg-muted hover:border-primary/50 transition-all cursor-pointer"
                    title="Attach a file"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  {showAttachMenu && (
                    <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[180px] space-y-0.5 animate-in fade-in zoom-in-95">
                      <label className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-all font-semibold text-foreground">
                        <UploadCloud className="w-4 h-4 text-blue-500" />
                        <span>Attach File</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            setShowAttachMenu(false);
                            handleDirectFileUpload(e);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  ref={promptInputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isGenerating) handleGenerate();
                  }}
                  placeholder="e.g. Focus on database normalization: 3 conceptual and 2 applied questions."
                  className="flex-1 min-w-0 px-3 py-2 border border-border bg-muted/40 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!sourceText?.trim() && !prompt.trim())}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isGenerating ? "Generating your study resource..." : "Generate Resource"}</span>
            </button>
            {isGenerating && (
              <button
                type="button"
                onClick={handleCancelGenerate}
                className="w-full py-2 bg-muted/60 border border-border text-foreground font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Cancel Generation (Press Esc)</span>
              </button>
            )}
            {offlineNotice && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-[11px] font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  AI service is offline — results were generated from the material's text content instead.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Output Panel (2 cols) */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-xs flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-bold text-foreground whitespace-nowrap">Generated Output</h3>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {generatedOutput && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {(mode === "reviewer" || mode === "summary") && (
                    <button
                      onClick={() => handleDownloadResource()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                      title={`Download ${mode === "reviewer" ? "Reviewer" : "Summary"} as a PDF document`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Download {mode === "reviewer" ? "Reviewer" : "Summary"} (PDF)</span>
                    </button>
                  )}

                  <button
                    onClick={handleSaveResource}
                    disabled={savedSuccess || savedDrafts[mode] || isSavingResource}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer ${
                      savedSuccess || savedDrafts[mode]
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {isSavingResource
                        ? "Saving..."
                        : savedSuccess || savedDrafts[mode]
                          ? "Saved ✓"
                          : saveDestinationLabel}
                    </span>
                  </button>

                  {!savedSuccess && !savedDrafts[mode] && (
                    <button
                      onClick={handleDiscardResource}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-all flex items-center space-x-1.5 cursor-pointer"
                      title="Discard this draft. Nothing is saved until you press Save."
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </button>
                  )}
                </div>
              )}

              {saveSuccessMsg && savedSuccess && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{saveSuccessMsg}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 p-5 space-y-4 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">
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
              <p className="text-xs">Enter a prompt and click "Generate Resource" to build quizzes or summaries.</p>
            </div>
          )}

          {isGenerating && (
            <div className="py-20 text-center text-primary space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-bold text-foreground">
                Generating your study resource... This may take a few minutes.
              </p>
            </div>
          )}

          {generatedOutput && (
            <div className="space-y-6">
              {/* Title Editor */}
              <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-foreground">Resource Title (Editable)</label>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {titleExists && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      A quiz with this title already exists in your library — consider renaming it before saving.
                    </span>
                  </div>
                )}
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
                        <span className="text-[10px] font-bold text-primary uppercase">{cIdx + 1}.</span>
                        <p className="font-bold text-foreground">{card.question}</p>
                        <p className="text-muted-foreground pt-1 border-t border-border">{card.answer}</p>
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

                      {topic.sampleQuestions && topic.sampleQuestions.length > 0 && (
                        <div className="pt-2 space-y-2">
                          <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                            Sample Self-Check Questions
                          </h5>
                          {topic.sampleQuestions.map((sq, sIdx) => {
                            const questionText =
                              typeof sq === "string" ? sq : sq?.question || "";
                            const answerText = typeof sq === "object" && sq ? sq.answer : "";
                            return (
                              <div key={sIdx} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5">
                                <p className="font-semibold text-foreground flex items-start space-x-2">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px] mt-0.5 shrink-0">Q</span>
                                  <span>{questionText}</span>
                                </p>
                                {answerText && (
                                  <p className="text-muted-foreground pl-7 flex items-start space-x-1.5">
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">A:</span>
                                    <span>{answerText}</span>
                                  </p>
                                )}
                              </div>
                            );
                          })}
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
      </div>
    </div>
  );
};
