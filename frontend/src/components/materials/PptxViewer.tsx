import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PPTXViewer as PPTXViewerInstance } from "pptxviewjs";
import type { LearningMaterial } from "../../types";
import { fetchMaterialBlob } from "../../utils/materialFile";

interface PptxViewerProps {
  material: LearningMaterial;
  onError: () => void;
}

interface SlideSize {
  cx: number;
  cy: number;
}

// pptxviewjs keeps the parsed presentation on the viewer instance but doesn't
// expose it in its public typings. Read the slide size so the canvas can match
// the deck's aspect ratio instead of the canvas default (300x150).
function getSlideAspect(viewer: PPTXViewerInstance): number {
  const internals = viewer as unknown as {
    processor?: { getSlideDimensions?: () => SlideSize };
    presentation?: { slideSize?: SlideSize };
  };
  const size =
    internals.processor?.getSlideDimensions?.() ||
    internals.presentation?.slideSize;
  if (size && size.cx > 0 && size.cy > 0) return size.cx / size.cy;
  return 16 / 9;
}

export function PptxViewer({ material, onError }: PptxViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PPTXViewerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(1);
  const [slideCount, setSlideCount] = useState(0);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas element is not mounted yet.");

        const { PPTXViewer } = await import("pptxviewjs");
        if (cancelled) return;
        const blob = await fetchMaterialBlob(material);
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;

        const viewer = new PPTXViewer({
          canvas,
          enableThumbnails: false,
          slideSizeMode: "fit",
        });
        viewerRef.current = viewer;
        await viewer.loadFile(buffer);
        if (cancelled) {
          viewer.destroy();
          return;
        }

        const wrapper = wrapperRef.current;
        if (!wrapper) throw new Error("Canvas container is not mounted yet.");

        // Fit the slide to the largest rectangle with the deck's aspect ratio
        // inside the preview area. p-3 adds 12px of padding on each side.
        const aspect = getSlideAspect(viewer);
        const padding = 24;
        const maxWidth = Math.max(1, wrapper.clientWidth - padding);
        const maxHeight = Math.max(1, wrapper.clientHeight - padding);
        let width = maxWidth;
        let height = width / aspect;
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspect;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = `${Math.round(width)}px`;
        canvas.style.height = `${Math.round(height)}px`;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        await viewer.render(canvas);
        if (cancelled) return;
        setSlideCount(viewer.getSlideCount());
        setSlide(viewer.getCurrentSlideIndex() + 1);
        setLoading(false);
      } catch (err) {
        console.error("[PptxViewer] Failed to render presentation", err);
        if (!cancelled) onError();
      }
    };

    void run();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id]);

  const goTo = async (direction: 1 | -1) => {
    const viewer = viewerRef.current;
    if (!viewer || navigating) return;
    setNavigating(true);
    try {
      if (direction === 1) await viewer.nextSlide(canvasRef.current);
      else await viewer.previousSlide(canvasRef.current);
      setSlide(viewer.getCurrentSlideIndex() + 1);
    } finally {
      setNavigating(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-2 h-[65vh]">
      <div
        ref={wrapperRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-auto rounded-xl bg-slate-200 dark:bg-slate-900 p-3"
      >
        <canvas ref={canvasRef} className="max-w-full h-auto shadow-lg bg-white" />
      </div>
      <div className={`flex items-center justify-center gap-3 shrink-0 ${loading ? "invisible" : ""}`}>
        <button
          type="button"
          onClick={() => goTo(-1)}
          disabled={slide <= 1 || navigating}
          className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-40 hover:bg-slate-700 cursor-pointer disabled:cursor-not-allowed"
          title="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
          Slide {slide} / {slideCount || "?"}
        </span>
        <button
          type="button"
          onClick={() => goTo(1)}
          disabled={slideCount === 0 || slide >= slideCount || navigating}
          className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-40 hover:bg-slate-700 cursor-pointer disabled:cursor-not-allowed"
          title="Next slide"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 rounded-xl bg-slate-200/90 dark:bg-slate-900/90 text-muted-foreground text-xs">
          <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Rendering presentation…</span>
        </div>
      )}
    </div>
  );
}
