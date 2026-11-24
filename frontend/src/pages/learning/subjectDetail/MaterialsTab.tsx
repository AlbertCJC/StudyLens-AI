import { Download, FileText, Flag, History, Pencil, Trash2, CheckCircle2, Upload } from "lucide-react";
import { Pagination, slicePage } from "../../../components/Pagination";
import type { LearningMaterial, MaterialFlag } from "../../../types";
import { flagsForMaterial } from "./subjectDetailUtils";

interface MaterialsTabProps {
  materials: LearningMaterial[];
  materialsLoading: boolean;
  materialFlags: MaterialFlag[];
  highlightMaterialId: string | null;
  matPage: number;
  setMatPage: (page: number) => void;
  currentUser: { role: string | null | undefined } | null;
  canManage: boolean;
  onUpload: () => void;
  onPreview: (mat: LearningMaterial) => void;
  onFlag: (mat: LearningMaterial) => void;
  onEdit: (mat: LearningMaterial) => void;
  onDownload: (mat: LearningMaterial) => void;
  onDelete: (mat: LearningMaterial) => void;
  onViewHistory: (mat: LearningMaterial) => void;
  onResolveFlag: (flag: MaterialFlag) => void;
}

function fileTypeBadge(fileType: string) {
  const lower = (fileType || "").toLowerCase();
  if (lower === "pdf") {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
  if (lower === "doc" || lower === "docx") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  if (lower === "ppt" || lower === "pptx") {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  }
  if (lower === "txt") {
    return "bg-slate-500/10 text-muted-foreground border-slate-500/20";
  }
  return "bg-muted/40 text-muted-foreground dark:text-slate-400 border-border";
}

export function MaterialsTab({
  materials,
  materialsLoading,
  materialFlags,
  highlightMaterialId,
  matPage,
  setMatPage,
  currentUser,
  canManage,
  onUpload,
  onPreview,
  onFlag,
  onEdit,
  onDownload,
  onDelete,
  onViewHistory,
  onResolveFlag,
}: MaterialsTabProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Uploaded Materials</span>
        </h2>
        {canManage && (
          <button
            onClick={onUpload}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Material</span>
          </button>
        )}
      </div>

      {materialsLoading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Loading materials...</p>
      ) : materials.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          No materials uploaded for this subject yet. Upload lecture notes, slide decks, or PDFs.
        </p>
      ) : (
        <>
          {highlightMaterialId && materials.some((m) => m.id === highlightMaterialId) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/40 text-xs font-semibold text-primary">
              <Flag className="w-3.5 h-3.5" />
              <span>
                Reviewing "{materials.find((m) => m.id === highlightMaterialId)?.title}" from your notification.
              </span>
            </div>
          )}
          <div className="space-y-2.5">
            {slicePage(materials, matPage).map((mat) => {
              const matFlags = flagsForMaterial(mat.id, materialFlags);
              const pendingFlag = matFlags.find((f) => f.status === "pending");
              const resolvedFlags = matFlags.filter((f) => f.status === "resolved");
              const highlighted = mat.id === highlightMaterialId;
              return (
                <div
                  key={mat.id}
                  className={`rounded-xl border transition-all ${
                    pendingFlag ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-muted/30"
                  } ${highlighted ? "ring-2 ring-primary/60" : ""}`}
                >
                  <div
                    onClick={() => onPreview(mat)}
                    className="flex items-center justify-between p-3.5 rounded-xl gap-3 cursor-pointer hover:bg-muted/50 transition-all"
                    title="View material"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{mat.title}</p>
                          {(mat.fileType || "") !== "" && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${fileTypeBadge(mat.fileType || "")}`}
                            >
                              {(mat.fileType || "").toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {mat.fileType?.toUpperCase() || "TEXT"} {mat.fileSize ? `• ${mat.fileSize}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      {currentUser?.role === "admin" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFlag(mat);
                          }}
                          disabled={!!pendingFlag}
                          className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={pendingFlag ? "Already flagged" : "Flag for review"}
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(mat);
                            }}
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                            title="Edit Material"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownload(mat);
                            }}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                            title="Download Material"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(mat);
                            }}
                            className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {matFlags.length > 0 && (
                    <div className="px-3.5 pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start space-x-2 min-w-0">
                        <span
                          className={`p-1 rounded-lg shrink-0 ${
                            pendingFlag
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {pendingFlag ? <Flag className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          {pendingFlag ? (
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 leading-snug">
                              Pending review Â· {pendingFlag.category}
                              {pendingFlag.note ? ` â€” "${pendingFlag.note}"` : ""}
                            </p>
                          ) : (
                            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
                              Resolved Â· {resolvedFlags.length} flag{resolvedFlags.length > 1 ? "s" : ""} addressed
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Flagged by {pendingFlag?.flaggedByName || resolvedFlags[resolvedFlags.length - 1]?.flaggedByName || "Admin"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewHistory(mat);
                          }}
                          className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                          title="View flag history"
                        >
                          <History className="w-3 h-3" />
                          <span>History</span>
                        </button>
                        {pendingFlag && canManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResolveFlag(pendingFlag);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                            title="Resolve this flag"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Mark Resolved</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination page={matPage} total={materials.length} onPageChange={setMatPage} />
        </>
      )}
    </div>
  );
}
