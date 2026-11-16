import { BookOpen, X } from "lucide-react";
import type { Quiz, Subject, User } from "../../../types";

interface AssignQuizSubjectModalProps {
  assignQuiz: Quiz;
  assignQuizSubjectId: string;
  isAssigningQuizSubject: boolean;
  assignQuizMsg: string | null;
  subjects: Subject[];
  currentUser: User | null;
  onSubjectChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AssignQuizSubjectModal({
  assignQuiz,
  assignQuizSubjectId,
  isAssigningQuizSubject,
  assignQuizMsg,
  subjects,
  currentUser,
  onSubjectChange,
  onConfirm,
  onClose,
}: AssignQuizSubjectModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Assign Subject</h3>
              <p className="text-[11px] text-muted-foreground">Publish this quiz to students of the selected subject.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-0.5">
          <p className="text-xs font-bold text-foreground">{assignQuiz.title}</p>
          <p className="text-[11px] text-muted-foreground">{assignQuiz.questions?.length || 0} Questions</p>
        </div>

        {assignQuizMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold">
            {assignQuizMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Assigned Course Subject</label>
          <select
            value={assignQuizSubjectId}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select a subject —</option>
            {subjects
              .filter((sub) => currentUser?.role !== "teacher" || sub.teacherId === currentUser.id)
              .map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} — {sub.name}
                </option>
              ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            The quiz is published to students of the selected subject.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-1">
          <button
            onClick={onClose}
            className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isAssigningQuizSubject}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isAssigningQuizSubject ? "Assigning..." : "Assign Subject"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
