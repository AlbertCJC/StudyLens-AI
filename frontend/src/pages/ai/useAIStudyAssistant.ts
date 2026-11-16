import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import type { LearningMaterial } from "../../types";
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
  EMPTY_QUIZ_COUNTS,
  type AIMode,
  type AIGeneratedResult,
  type QuizCounts,
} from "../../utils/aiWorkspaceCache";
import { exportAiPdf, friendlyAiError, sanitizeFileName, triggerPdfDownload } from "./aiUtils";
import { MAX_AI_FLASHCARDS, MAX_AI_QUESTIONS } from "./aiLimits";

export interface AIStudyAssistantInitialProps {
  initialMaterial?: LearningMaterial | null;
  initialTopic?: string | null;
  onSeedConsumed?: () => void;
}

export function useAIStudyAssistant({
  initialMaterial,
  initialTopic,
  onSeedConsumed,
}: AIStudyAssistantInitialProps) {
  const { currentUser } = useAuth();
  const promptInputRef = useRef<HTMLInputElement | null>(null);
  const [, setMaterials] = useState<LearningMaterial[]>([]);

  const cachedWs = (() => (currentUser?.id ? getWorkspace(currentUser.id) : null))();
  const initialWs = cachedWs ? { ...cachedWs } : emptyWorkspace();
  const hasCachedSource = Boolean(initialWs.sourceText && !initialMaterial);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(initialMaterial?.id || initialWs.selectedMaterialId || "");
  const [sourceText, setSourceText] = useState<string>(initialMaterial?.extractedText || initialWs.sourceText || "");
  const [prompt, setPrompt] = useState<string>(initialWs.prompt || "");
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const requestedAIMode: AIMode | null =
    requestedMode === "quiz" ||
    requestedMode === "flashcards" ||
    requestedMode === "summary" ||
    requestedMode === "reviewer"
      ? requestedMode
      : null;
  const [mode, setMode] = useState<AIMode>(requestedAIMode ?? initialWs.mode ?? "quiz");

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(initialWs.uploadedFileName || null);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(hasCachedSource && initialWs.uploadedFileName ? `Restored extracted text from "${initialWs.uploadedFileName}".` : null);

  const [flashcardCount, setFlashcardCount] = useState<string>(initialWs.flashcardCount || "5");
  const [quizCounts, setQuizCounts] = useState<QuizCounts>({
    ...EMPTY_QUIZ_COUNTS,
    ...(initialWs.quizCounts || {}),
  });
  const [quizRevealAnswers] = useState<boolean>(initialWs.quizRevealAnswers ?? true);

  const [isGenerating, setIsGenerating] = useState<boolean>(Boolean(currentUser?.id && isJobRunning(currentUser.id)) || initialWs.pending === true);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<AIGeneratedResult | null>(initialWs.generatedOutput || null);
  const [drafts, setDrafts] = useState<Partial<Record<AIMode, AIGeneratedResult | null>>>(initialWs.drafts || {});
  const [draftTitles, setDraftTitles] = useState<Partial<Record<AIMode, string>>>(initialWs.draftTitles || {});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<Partial<Record<AIMode, boolean>>>(initialWs.savedDrafts || {});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(initialWs.offlineNotice === true);
  const [offlineReason, setOfflineReason] = useState<string>(initialWs.offlineReason || "");
  const [titleExists, setTitleExists] = useState(initialWs.titleExists === true);
  const [editTitle, setEditTitle] = useState(initialWs.editTitle || (initialWs.generatedOutput ? (draftTitles[initialWs.mode] ?? "") : ""));
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const mountedRef = useRef(true);
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
    saveWorkspace(uid, {
      mode,
      prompt,
      sourceText,
      selectedMaterialId,
      uploadedFileName: uploadedFileName || undefined,
      quizCounts,
      flashcardCount,
      quizRevealAnswers,
      drafts,
      draftTitles,
      savedDrafts,
      generatedOutput,
      editTitle,
      offlineNotice,
      offlineReason,
      titleExists,
      pending: isJobRunning(uid),
    });
  };

  useEffect(() => {
    persistWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode, prompt, sourceText, selectedMaterialId, uploadedFileName,
    quizCounts, flashcardCount, quizRevealAnswers,
    drafts, draftTitles, savedDrafts, generatedOutput, editTitle,
    offlineNotice, offlineReason, titleExists, currentUser?.id,
  ]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (isJobRunning(currentUser.id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsGenerating(true);
    }
  }, [currentUser?.id]);

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
          setOfflineReason(ws.offlineReason || "");
          setTitleExists(ws.titleExists === true);
          setIsGenerating(false);
          setSavedSuccess(false);
        }
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      const cached = getWorkspace(currentUser.id);
      if (cached && !cached.generatedOutput && !cached.prompt && !cached.sourceText && !Object.keys(cached.drafts || {}).length && !isJobRunning(currentUser.id)) {
        clearWorkspace(currentUser.id);
      }
    }
  }, [currentUser?.id]);

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
  }, [initialTopic, onSeedConsumed]);

  const handleModeSelect = (newMode: AIMode) => {
    setMode(newMode);
    setGeneratedOutput(drafts[newMode] ?? null);
    setEditTitle(draftTitles[newMode] ?? "");
    setErrorMsg(null);
    setSavedSuccess(false);
    setSaveSuccessMsg(null);
    setOfflineNotice(false);
    setOfflineReason("");
  };

  const generateAbortRef = useRef<AbortController | null>(null);

  const handleCancelGenerate = useCallback(() => {
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
  }, [currentUser?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isGenerating) handleCancelGenerate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isGenerating, handleCancelGenerate]);

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

    const parsedQuizCounts = {
      multiple_choice: parseInt(quizCounts.multiple_choice || "0", 10) || 0,
      identification: parseInt(quizCounts.identification || "0", 10) || 0,
      true_false: parseInt(quizCounts.true_false || "0", 10) || 0,
    };
    const quizTotal = Object.values(parsedQuizCounts).reduce((sum, count) => sum + Math.max(0, count), 0);
    if (mode === "quiz" && quizTotal > MAX_AI_QUESTIONS) {
      setErrorMsg(`You can generate a maximum of ${MAX_AI_QUESTIONS} questions only. Please reduce the number and try again.`);
      return;
    }
    const explicitQuizCounts = Object.fromEntries(
      Object.entries(parsedQuizCounts).filter(([, count]) => count > 0)
    );
    const parsedFlashcardCount = parseInt(flashcardCount, 10);
    const requestedFlashcardCount = Number.isNaN(parsedFlashcardCount) ? 5 : parsedFlashcardCount;
    if (mode === "flashcards" && requestedFlashcardCount > MAX_AI_FLASHCARDS) {
      setErrorMsg(`You can generate a maximum of ${MAX_AI_FLASHCARDS} flashcards only. Please reduce the number and try again.`);
      return;
    }

    const genMode = mode;
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedOutput(null);
    setSavedSuccess(false);
    setSavedDrafts((prev) => ({ ...prev, [genMode]: false }));
    setOfflineNotice(false);
    setOfflineReason("");
    setTitleExists(false);

    const controller = new AbortController();
    generateAbortRef.current = controller;
    registerJob(uid, genMode, controller);

    try {
      const res = await authFetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: genMode,
          text: content,
          instructions: prompt.trim(),
          save: false,
          flashcardCount: requestedFlashcardCount,
          quizCounts: genMode === "quiz" && Object.keys(explicitQuizCounts).length > 0 ? explicitQuizCounts : undefined,
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
        const computedTitle = result.title || "AI Quiz";

        const existing = getWorkspace(uid) ?? emptyWorkspace();
        existing.mode = genMode;
        existing.generatedOutput = result;
        existing.drafts = { ...existing.drafts, [genMode]: result };
        existing.draftTitles = { ...existing.draftTitles, [genMode]: computedTitle };
        existing.editTitle = computedTitle;
        existing.sourceText = sourceText || existing.sourceText;
        const offlineFallback = data.source === "offline-fallback";
        const offlineReasonValue = typeof data.offlineReason === "string" ? data.offlineReason : "";
        existing.offlineNotice = offlineFallback;
        existing.offlineReason = offlineReasonValue;
        existing.titleExists = data.titleExists === true;
        existing.completedAt = Date.now();
        saveWorkspace(uid, existing);

        if (mountedRef.current) {
          setGeneratedOutput(result);
          setDrafts((prev) => ({ ...prev, [genMode]: result }));
          setOfflineNotice(offlineFallback);
          setOfflineReason(offlineReasonValue);
          setTitleExists(data.titleExists === true);
          setEditTitle(computedTitle);
          setDraftTitles((prev) => ({ ...prev, [genMode]: computedTitle }));
          setSavedSuccess(false);
        }
      } else if (data) {
        const rawError = typeof data.error === "string" ? data.error : `Server returned status ${res.status}`;
        const errorCode = typeof data.code === "string" ? data.code : "";
        const resetAtSeconds = typeof data.resetAtSeconds === "number" ? data.resetAtSeconds : undefined;
        if (mountedRef.current) setErrorMsg(friendlyAiError(rawError, errorCode, resetAtSeconds));
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
    let docTitle = editTitle || (mode === "reviewer" ? "AI Study Reviewer" : mode === "quiz" ? "AI Quiz" : "AI Lecture Summary");

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
      triggerPdfDownload(blob, sanitizeFileName(docTitle));
    } catch (err) {
      setErrorMsg((err as Error).message || "Could not export the PDF.");
    }
  };

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
    setFlashcardCount("5");
    setQuizCounts({ ...EMPTY_QUIZ_COUNTS });
    setGeneratedOutput(null);
    setDrafts({});
    setDraftTitles({});
    setSavedDrafts({});
    setEditTitle("");
    setOfflineNotice(false);
    setOfflineReason("");
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
        const resetAtSeconds = typeof data?.resetAtSeconds === "number" ? data.resetAtSeconds : undefined;
        setErrorMsg(friendlyAiError(rawError, code, resetAtSeconds));
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

  return {
    currentUser,
    promptInputRef,
    selectedMaterialId,
    setSelectedMaterialId,
    sourceText,
    setSourceText,
    prompt,
    setPrompt,
    mode,
    uploadedFile,
    setUploadedFile,
    uploadedFileName,
    setUploadedFileName,
    isUploadingFile,
    uploadSuccessMsg,
    setUploadSuccessMsg,
    flashcardCount,
    setFlashcardCount,
    quizCounts,
    setQuizCounts,
    isGenerating,
    isSavingResource,
    errorMsg,
    generatedOutput,
    savedSuccess,
    savedDrafts,
    saveSuccessMsg,
    offlineNotice,
    offlineReason,
    titleExists,
    editTitle,
    setEditTitle,
    showAttachMenu,
    setShowAttachMenu,
    handleModeSelect,
    handleCancelGenerate,
    handleDirectFileUpload,
    handleGenerate,
    handleDownloadResource,
    saveDestinationLabel,
    handleSaveResource,
    handleDiscardResource,
  };
}

export type AIStudyAssistantController = ReturnType<typeof useAIStudyAssistant>;
