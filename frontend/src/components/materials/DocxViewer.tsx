import { useEffect, useRef, useState } from "react";
import type { LearningMaterial } from "../../types";
import { fetchMaterialBlob } from "../../utils/materialFile";

interface DocxViewerProps {
  material: LearningMaterial;
  onError: () => void;
}

export function DocxViewer({ material, onError }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (container) container.innerHTML = "";

    const run = async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        const blob = await fetchMaterialBlob(material);
        if (cancelled || !container) return;
        await renderAsync(blob, container, container, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          useBase64URL: true,
        });
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("[DocxViewer] Failed to render document", err);
        if (!cancelled) onError();
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id]);

  return (
    <div className="relative h-[65vh] overflow-auto rounded-xl bg-slate-200 dark:bg-slate-900 p-2 sm:p-4">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-muted-foreground text-xs bg-slate-200 dark:bg-slate-900">
          <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Rendering document…</span>
        </div>
      )}
      <div ref={containerRef} className="docx-viewer mx-auto" />
    </div>
  );
}
