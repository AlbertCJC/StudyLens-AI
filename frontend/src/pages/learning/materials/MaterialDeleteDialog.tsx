import { Trash2 } from "lucide-react";
import type { LearningMaterial } from "../../../types";

interface MaterialDeleteDialogProps {
  material: LearningMaterial;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}

export function MaterialDeleteDialog({ material, onCancel, onConfirm }: MaterialDeleteDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
          <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Delete Learning Material?</h3>
            <p className="text-xs text-muted-foreground">Confirmation required</p>
          </div>
        </div>

        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1 text-xs text-rose-800 dark:text-rose-200">
          <p className="font-bold">Are you sure you want to delete this learning material?</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            "{material.title}" will be permanently removed from learning materials. This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(material.id)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Material</span>
          </button>
        </div>
      </div>
    </div>
  );
}
