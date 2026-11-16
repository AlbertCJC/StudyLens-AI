import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningMaterial, User } from "../../../types";
import { authFetch } from "../../../utils/authFetch";

type ToastFn = (message: string, type?: "info" | "error" | "success") => void;

interface UseMaterialUploadOptions {
  currentUser: User | null;
  showToast: ToastFn;
  onUploaded: (material: LearningMaterial) => void;
}

export function useMaterialUpload({ currentUser, showToast, onUploaded }: UseMaterialUploadOptions) {
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [rawText, setRawText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadAbortedRef = useRef(false);

  const uploadDirty =
    !!file || title.trim().length > 0 || description.trim().length > 0 || rawText.trim().length > 0;

  const resetDraft = useCallback(() => {
    setDiscardOpen(false);
    setShowUpload(false);
    setFile(null);
    setTitle("");
    setDescription("");
    setRawText("");
    setSubjectId("");
  }, []);

  const requestCloseUpload = useCallback(() => {
    if (uploadDirty) {
      setDiscardOpen(true);
      return;
    }
    resetDraft();
  }, [uploadDirty, resetDraft]);

  const confirmUploadDiscard = () => {
    uploadAbortRef.current?.abort();
    uploadAbortedRef.current = true;
    setDiscardOpen(false);
    resetDraft();
  };

  const cancelUploadDiscard = () => {
    uploadAbortedRef.current = false;
    setDiscardOpen(false);
  };

  const openUpload = () => {
    setShowUpload(true);
    setFile(null);
    setTitle("");
    setDescription("");
    setRawText("");
    setSubjectId("");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !rawText) {
      showToast("Please upload a file (PDF, DOCX, PPTX, TXT) or paste lecture text.", "info");
      return;
    }
    if (!title.trim()) {
      showToast("Document title is required before publishing.", "info");
      return;
    }

    setIsUploading(true);
    setDiscardOpen(false);

    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const chosenSubject = subjectId || "";
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
        signal: controller.signal,
      });

      if (res.ok) {
        if (uploadAbortedRef.current) {
          uploadAbortedRef.current = false;
          return;
        }
        const newMat = await res.json();
        onUploaded(newMat);
        showToast(
          isPersonalType
            ? "Personal study material saved successfully to your repository!"
            : "Course material successfully published to enrolled students!"
        );
        setFile(null);
        setTitle("");
        setDescription("");
        setRawText("");
        setShowUpload(false);
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
      if (uploadAbortedRef.current) {
        uploadAbortedRef.current = false;
      } else if (errorMsg !== "AbortError" && errorMsg !== "The user aborted a request.") {
        showToast("Upload error: " + errorMsg, "error");
      }
    } finally {
      setIsUploading(false);
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
    }
  };

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    setRawText("");
    if (selected) setTitle(selected.name.replace(/\.[^/.]+$/, ""));
  };

  useEffect(() => {
    if (!showUpload) return;
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
  }, [showUpload, discardOpen, requestCloseUpload]);

  useEffect(() => {
    if (!showUpload || !uploadDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [showUpload, uploadDirty]);

  return {
    showUpload,
    file,
    title,
    description,
    subjectId,
    rawText,
    isUploading,
    discardOpen,
    setTitle,
    setDescription,
    setSubjectId,
    setRawText,
    openUpload,
    requestCloseUpload,
    confirmUploadDiscard,
    cancelUploadDiscard,
    handleUpload,
    handleFileChange,
  };
}
