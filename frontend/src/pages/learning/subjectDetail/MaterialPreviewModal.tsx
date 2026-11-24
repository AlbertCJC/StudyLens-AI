import { Download, FileText, Trash2, X } from "lucide-react";
import type { LearningMaterial, User } from "../../../types";
import { MaterialViewer } from "../../../components/materials/MaterialViewer";
import { downloadLabel, isAiMaterial } from "./subjectDetailUtils";

interface MaterialPreviewModalProps {
  open: boolean;
  onClose: () => void;
  material: LearningMaterial;
  currentUser: User | null;
  previewTimestamp: string | null;
  onDownload: (material: LearningMaterial) => void;
  onDownloadAsPdf: (material: LearningMaterial) => void;
  onDelete: (material: LearningMaterial) => void;
}

export function MaterialPreviewModal({
  open,
  onClose,
  material,
  currentUser,
  previewTimestamp,
  onDownload,
  onDownloadAsPdf,
  onDelete,
}: MaterialPreviewModalProps) {
  if (!open) return null;

  const ext = (material.fileType || "").toLowerCase().replace(/^\./, "");
  const canDelete = currentUser?.role !== "admin" && material.uploaderId === currentUser?.id;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-2xl max-w-4xl w-full shadow-xl border border-border max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-slate-900 p-5 text-white">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                {!isAiMaterial(material) && material.subjectName && (
                  <span className="text-[11px] text-slate-300 font-semibold">{material.subjectName}</span>
                )}

                {material.fileType && !isAiMaterial(material) && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-md border border-rose-500/30">
                    {material.fileType.toUpperCase()}
                  </span>
                )}

              </div>
              <div className="flex items-baseline gap-2 flex-wrap mt-0.5 min-w-0">
                <h3 className="text-base font-bold text-white truncate">{material.title}</h3>
                {previewTimestamp && (
                  <span className="text-[10px] font-normal text-slate-400 whitespace-nowrap">
                    {previewTimestamp}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onDownload(material)}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Download this material"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{downloadLabel(material)}</span>
            </button>
            {(ext === "docx" || ext === "doc") && (
              <button
                onClick={() => onDownloadAsPdf(material)}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
                title="Download as PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download as PDF</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(material)}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
                title="Delete this material"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950">
          <MaterialViewer key={material.id} material={material} />
        </div>
      </div>
    </div>
  );
}
