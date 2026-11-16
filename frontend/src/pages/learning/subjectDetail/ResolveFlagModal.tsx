import { CheckCircle2, X, RefreshCw } from "lucide-react";
import type { MaterialFlag } from "../../../types";

interface ResolveFlagModalProps {
  open: boolean;
  onClose: () => void;
  flag: MaterialFlag;
  resolutionNote: string;
  setResolutionNote: (value: string) => void;
  resolving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ResolveFlagModal({
  open,
  onClose,
  flag,
  resolutionNote,
  setResolutionNote,
  resolving,
  onSubmit,
}: ResolveFlagModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Resolve Flag</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              The admin who flagged this material will be notified.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-0.5">
          <p className="text-xs font-bold text-foreground">
            {flag.category}
            {flag.note ? ` â€” "${flag.note}"` : ""}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Flagged by {flag.flaggedByName || "Admin"} on {new Date(flag.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Resolution note (optional)</label>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={3}
            placeholder="e.g. Replaced with the corrected file."
            className="w-full px-3 py-2 border border-border bg-muted/30 text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={resolving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
          >
            {resolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{resolving ? "Resolving..." : "Mark Resolved"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
