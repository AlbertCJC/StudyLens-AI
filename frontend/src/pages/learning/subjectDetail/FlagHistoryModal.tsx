import { History, X } from "lucide-react";
import type { MaterialFlag, LearningMaterial } from "../../../types";

interface FlagHistoryModalProps {
  open: boolean;
  onClose: () => void;
  material: LearningMaterial;
  flags: MaterialFlag[];
}

export function FlagHistoryModal({ open, onClose, material, flags }: FlagHistoryModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Flag History</span>
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{material.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {flags.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No flags have been raised on this material.
          </p>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className="p-3.5 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      flag.status === "pending"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {flag.status === "pending" ? "Pending" : "Resolved"} Â· {flag.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(flag.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Flagged by: {flag.flaggedByName || flag.flaggedById}</p>
                {flag.note && <p className="text-xs text-foreground">"{flag.note}"</p>}
                {flag.status === "resolved" && (
                  <div className="pt-2 border-t border-border space-y-1">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Resolved by: {flag.resolvedByName || flag.resolvedById || "â€”"}
                    </p>
                    {flag.resolutionNote && (
                      <p className="text-[11px] text-muted-foreground">Resolution note: "{flag.resolutionNote}"</p>
                    )}
                    {flag.resolvedAt && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(flag.resolvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
