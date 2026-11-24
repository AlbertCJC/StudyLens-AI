import { BookOpen } from "lucide-react";
import type { LearningMaterial, Subject } from "../../../types";

interface AssignSubjectModalProps {
  material: LearningMaterial;
  subjects: Subject[];
  selectedSubjectId: string;
  assigning: boolean;
  onSubjectIdChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AssignSubjectModal({
  material,
  subjects,
  selectedSubjectId,
  assigning,
  onSubjectIdChange,
  onConfirm,
  onClose,
}: AssignSubjectModalProps) {
  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Assign Course Subject</h3>
            <p className="text-xs text-muted-foreground">
              Choose the assigned subject for "{material.title}"
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-3 text-xs">
          <label className="block font-semibold text-foreground">Assigned Course Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => onSubjectIdChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
          >
            <option value="">No Subject Assigned</option>
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} - {sub.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Students of the selected subject will see this material.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={assigning || !selectedSubjectId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <BookOpen className="w-4 h-4" />
            <span>{assigning ? "Assigning..." : "Assign Subject"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
