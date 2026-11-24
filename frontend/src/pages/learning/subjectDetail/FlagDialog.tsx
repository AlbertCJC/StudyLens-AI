import { X, Flag, RefreshCw } from "lucide-react";
import type { LearningMaterial } from "../../../types";

interface FlagDialogProps {
  open: boolean;
  onClose: () => void;
  material: LearningMaterial;
  category: string;
  setCategory: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function FlagDialog({
  open,
  onClose,
  material,
  category,
  setCategory,
  note,
  setNote,
  submitting,
  onSubmit,
}: FlagDialogProps) {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-foreground">Flag Material for Review</h3>
            <p className="text-xs text-muted-foreground">The teacher will be notified with this reason.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-muted/40 border border-border rounded-xl">
          <p className="font-bold text-foreground text-sm truncate">{material.title}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{material.subjectName || "Unassigned"}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option>Wrong file</option>
            <option>Wrong subject</option>
            <option>Incomplete content</option>
            <option>Other</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. The uploaded content belongs to a different subject."
            className="w-full px-3 py-2 border border-border bg-muted/30 text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
          >
            {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
            <span>{submitting ? "Flagging..." : "Flag Material"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
