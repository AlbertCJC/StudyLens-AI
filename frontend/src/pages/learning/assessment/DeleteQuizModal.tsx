import { Trash2 } from "lucide-react";
import type { Quiz } from "../../../types";

interface DeleteQuizModalProps {
  quizToDelete: Quiz;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteQuizModal({ quizToDelete, onClose, onConfirm }: DeleteQuizModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border p-6 rounded-2xl max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Confirm Assessment Deletion</h3>
            <p className="text-xs text-muted-foreground">Are you sure you want to delete this learning material?</p>
          </div>
        </div>

        <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-foreground space-y-1">
          <p className="font-bold">{quizToDelete.title}</p>
          <p className="text-[11px] text-muted-foreground">{quizToDelete.subjectName} • {quizToDelete.questions.length} Questions</p>
        </div>

        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
          Warning: Deleting this quiz will remove it from the course catalog and clear any active saved progress. This action cannot be undone.
        </p>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer hover:bg-muted/80"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Yes, Delete Assessment</span>
          </button>
        </div>
      </div>
    </div>
  );
}
