import { useEffect, useState } from "react";
import type { LearningMaterial } from "../../types";
import { authFetch } from "../../utils/authFetch";
import {
  fetchMaterialBlob,
  materialKind,
  officeEmbedUrl,
  resolveFileUrl,
} from "../../utils/materialFile";
import { PptxViewer } from "./PptxViewer";
import { DocxViewer } from "./DocxViewer";

interface MaterialViewerProps {
  material: LearningMaterial;
}

function PaperText({
  title,
  text,
  note,
}: {
  title: string;
  text?: string;
  note?: string;
}) {
  return (
    <div className="bg-card p-8 rounded-lg border border-border shadow-md space-y-6 max-w-2xl mx-auto">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
        {note && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}
      </div>
      <div className="text-[13px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-7 font-sans font-normal tracking-wide">
        {text || "No readable document text available."}
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="h-[65vh] flex flex-col items-center justify-center space-y-2 text-muted-foreground text-xs">
      <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function PdfPreview({ material }: { material: LearningMaterial }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const blob = await fetchMaterialBlob(material);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [material]);

  if (loading) return <Loading label="Loading PDF…" />;
  if (failed || !url) return <PaperText title={material.title} text={material.extractedText} />;
  return <iframe src={url} title={material.title} className="w-full h-[65vh] rounded-lg" />;
}

function TextPreview({ material }: { material: LearningMaterial }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await authFetch(`/api/materials/${encodeURIComponent(material.id)}/download`);
        if (!res.ok) throw new Error(`Server returned status ${res.status}`);
        const body = await res.text();
        if (!cancelled) setText(body || material.extractedText);
      } catch {
        if (!cancelled) setText(material.extractedText);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [material]);

  if (loading) return <Loading label="Loading document…" />;
  return <PaperText title={material.title} text={text || material.extractedText} />;
}

function LegacyOfficePreview({ material }: { material: LearningMaterial }) {
  const embed = officeEmbedUrl(material);
  if (embed) {
    return (
      <iframe
        src={embed}
        title={material.title}
        className="w-full h-[65vh] rounded-lg bg-white"
      />
    );
  }
  return (
    <PaperText
      title={material.title}
      text={material.extractedText}
      note="This legacy Office format can't be rendered directly. Showing the extracted text instead."
    />
  );
}

function ImagePreview({ material }: { material: LearningMaterial }) {
  const src = resolveFileUrl(material);
  if (!src) return <PaperText title={material.title} text={material.extractedText} />;
  return (
    <div className="h-[65vh] flex items-center justify-center overflow-hidden rounded-xl bg-slate-900">
      <img src={src} alt={material.title} className="max-w-full max-h-full object-contain" />
    </div>
  );
}

function VideoPreview({ material }: { material: LearningMaterial }) {
  const src = resolveFileUrl(material);
  if (!src) return <PaperText title={material.title} text={material.extractedText} />;
  return (
    <div className="h-[65vh] flex items-center justify-center overflow-hidden rounded-xl bg-black">
      <video src={src} controls className="max-w-full max-h-full" />
    </div>
  );
}

export function MaterialViewer({ material }: MaterialViewerProps) {
  const kind = materialKind(material);
  const [renderFailed, setRenderFailed] = useState(false);

  switch (kind) {
    case "pdf":
      return <PdfPreview material={material} />;
    case "pptx":
      return renderFailed ? (
        <PaperText title={material.title} text={material.extractedText} />
      ) : (
        <PptxViewer material={material} onError={() => setRenderFailed(true)} />
      );
    case "docx":
      return renderFailed ? (
        <PaperText title={material.title} text={material.extractedText} />
      ) : (
        <DocxViewer material={material} onError={() => setRenderFailed(true)} />
      );
    case "ppt":
    case "doc":
      return <LegacyOfficePreview material={material} />;
    case "text":
      return <TextPreview material={material} />;
    case "image":
      return <ImagePreview material={material} />;
    case "video":
      return <VideoPreview material={material} />;
    case "ai":
    case "other":
    default:
      return <PaperText title={material.title} text={material.extractedText} />;
  }
}
