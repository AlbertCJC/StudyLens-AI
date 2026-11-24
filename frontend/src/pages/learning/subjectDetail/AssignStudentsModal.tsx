import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";

interface AssignStudentsModalProps {
  open: boolean;
  onClose: () => void;
  subject: { code: string; name: string };
  allStudents: { id: string; name: string; email: string; studentId?: string | null }[];
  selectedStudentIds: Set<string>;
  setSelectedStudentIds: Dispatch<SetStateAction<Set<string>>>;
  assigningStudents: boolean;
  onConfirm: () => void;
}

export function AssignStudentsModal({
  open,
  onClose,
  subject,
  allStudents,
  selectedStudentIds,
  setSelectedStudentIds,
  assigningStudents,
  onConfirm,
}: AssignStudentsModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Assign Students</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select which students to enroll in {subject.code} - {subject.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            {selectedStudentIds.size} selected of {allStudents.length} students
          </p>
          <button
            onClick={() =>
              setSelectedStudentIds(
                selectedStudentIds.size === allStudents.length
                  ? new Set()
                  : new Set(allStudents.map((s) => s.id))
              )
            }
            className="text-[11px] font-bold text-primary dark:text-indigo-300 hover:underline cursor-pointer"
          >
            {selectedStudentIds.size === allStudents.length ? "Clear all" : "Select all"}
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {allStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No student accounts found. Create student accounts from the admin dashboard.
            </p>
          ) : (
            allStudents.map((s) => (
              <label
                key={s.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.has(s.id)}
                    onChange={() => {
                      setSelectedStudentIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      });
                    }}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg shrink-0">
                  {s.studentId || "â€”"}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="pt-2 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={assigningStudents}
            className="px-4 py-2 bg-cta-gradient hover:brightness-110 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
          >
            {assigningStudents ? "Saving..." : "Save Enrollment"}
          </button>
        </div>
      </div>
    </div>
  );
}
