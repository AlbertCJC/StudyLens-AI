import type { LearningMaterial } from "../types";
import { authFetch } from "./authFetch";

export type MaterialKind =
  | "ai"
  | "pdf"
  | "pptx"
  | "ppt"
  | "docx"
  | "doc"
  | "text"
  | "image"
  | "video"
  | "other";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
const VIDEO_EXTS = ["mp4", "webm", "ogg", "mov"];
const TEXT_EXTS = ["txt", "md", "csv", "json", "log", "rtf"];

// Vercel Functions reject request bodies above 4.5 MB before the Flask app sees
// them, so the UI enforces a slightly lower ceiling for uploads.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

export const uploadSizeError = (file: File | null | undefined): string | null => {
  if (!file || file.size <= MAX_UPLOAD_BYTES) return null;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  return `"${file.name}" is ${sizeMb} MB. The maximum upload size is ${MAX_UPLOAD_LABEL}.`;
};

export const getMaterialExt = (mat: LearningMaterial | null | undefined): string =>
  (mat?.fileType || "").toLowerCase().replace(/^\./, "");

export const isAiMaterial = (mat: LearningMaterial | null | undefined): boolean =>
  !!mat && (mat.fileType || "").toLowerCase().startsWith("ai-");

export const materialKind = (mat: LearningMaterial | null | undefined): MaterialKind => {
  if (!mat) return "other";
  if (isAiMaterial(mat)) return "ai";
  const ext = getMaterialExt(mat);
  if (ext === "pdf") return "pdf";
  if (ext === "pptx") return "pptx";
  if (ext === "ppt") return "ppt";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (TEXT_EXTS.includes(ext)) return "text";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  return "other";
};

export const resolveFileUrl = (mat: LearningMaterial | null | undefined): string | null => {
  const url = mat?.fileUrl;
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return `/${url.replace(/^\.?\//, "")}`;
};

export const fetchMaterialBlob = async (mat: LearningMaterial): Promise<Blob> => {
  const res = await authFetch(`/api/materials/${encodeURIComponent(mat.id)}/download`);
  if (!res.ok) throw new Error(`Server returned status ${res.status}`);
  return res.blob();
};

// Microsoft's Office viewer fetches the file server-side and cannot send an
// Authorization header. Exchange the session for a short-lived signed URL.
export const fetchMaterialViewUrl = async (
  mat: LearningMaterial | null | undefined
): Promise<string | null> => {
  if (!mat?.id) return null;
  const res = await authFetch(`/api/materials/${encodeURIComponent(mat.id)}/view-token`, {
    method: "POST",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url || null;
};

// Microsoft's Office viewer fetches the file server-side, so it only works when
// the file URL is publicly reachable (never for local /uploads or localhost).
export const officeEmbedUrl = (
  mat: LearningMaterial | null | undefined,
  signedViewUrl?: string | null
): string | null => {
  const url = signedViewUrl || resolveFileUrl(mat);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url)) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
};
