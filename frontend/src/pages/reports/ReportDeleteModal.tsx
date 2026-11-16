import { Loader2, Trash2, X } from "lucide-react";
import type { GeneratedReport } from "../../types";

interface ReportDeleteModalProps {
  report: GeneratedReport;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReportDeleteModal({ report, deleting, onCancel, onConfirm }: ReportDeleteModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" /> Delete Report
            </h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete "{report.title}"? This action cannot be undone.
            </p>
          </div>
          <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{deleting ? "Deleting..." : "Yes, Delete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
