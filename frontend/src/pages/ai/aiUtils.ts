import { authFetch } from "../../utils/authFetch";

export const formatWait = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) {
    const s = Math.ceil(seconds);
    return `${s} second${s === 1 ? "" : "s"}`;
  }
  const m = Math.ceil(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
};

export const offlineBannerMessage = (reason?: string): string => {
  switch ((reason || "").toUpperCase()) {
    case "RATE_LIMITED":
      return "The AI provider's rate limit was reached — results came from the material's text content instead. Please try again in a moment.";
    case "NO_API_KEY":
      return "The AI service is not configured (no API key). Please contact your administrator.";
    case "SDK_MISSING":
      return "The AI service SDK is not installed on the server. Please contact your administrator.";
    case "BILLING_INACTIVE":
      return "The AI service billing is not active. Please contact your administrator.";
    default:
      return "AI service is offline — results were generated from the material's text content instead.";
  }
};

export const friendlyAiError = (message: string, code?: string, resetAtSeconds?: number): string => {
  const lower = message.toLowerCase();
  if (code === "COUNT_EXCEEDS_MAX") {
    return "You can generate up to 100 questions only. Please reduce the number and try again.";
  }
  if (code === "RATE_LIMITED" || lower.includes("too many ai requests")) {
    const wait = formatWait(resetAtSeconds);
    return wait
      ? `You've reached the AI limit for this minute. You can generate again in about ${wait}.`
      : "You've reached the AI limit for this minute. Please wait a moment and try again.";
  }
  if (lower.includes("payment") || lower.includes("billing") || code === "PAYMENT_REQUIRED") {
    return "The AI service is currently unavailable. Your request was handled locally instead, so generation is still allowed.";
  }
  if (lower.includes("limit") || lower.includes("rate limit")) {
    return "You have reached the AI generation limit for this session. Please wait a moment and try again.";
  }
  if (lower.includes("how many questions") || code === "COUNT_REQUIRED") {
    return "How many questions to make in your prompt (e.g. 'Make 10 multiple choice questions' or '5 identification, 10 multiple choice, 5 true or false').";
  }
  return message;
};

export const sanitizeFileName = (s: string): string => {
  return s.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60) || "studylens-quiz";
};

export const exportAiPdf = async (input: {
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

export const triggerPdfDownload = (blob: Blob, baseName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
