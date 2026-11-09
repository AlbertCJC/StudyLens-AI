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

// Microsoft's Office viewer fetches the file server-side, so it only works when
// the file URL is publicly reachable (never for local /uploads or localhost).
export const officeEmbedUrl = (mat: LearningMaterial | null | undefined): string | null => {
  const url = resolveFileUrl(mat);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url)) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
};
