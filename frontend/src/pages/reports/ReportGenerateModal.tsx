import { Download, FileText, Loader2, X } from "lucide-react";
import type { ReportType } from "./reportMeta";
import type { QuizOption, StudentOption, SubjectOption } from "./reportUtils";

interface ReportGenerateModalProps {
  reportType: ReportType;
  title: string;
  targetId: string;
  students: StudentOption[];
  quizzes: QuizOption[];
  subjects: SubjectOption[];
  loadingStudents: boolean;
  loadingQuizzes: boolean;
  loadingSubjects: boolean;
  isTeacher: boolean;
  generating: boolean;
  onTitleChange: (value: string) => void;
  onTargetIdChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function ReportGenerateModal({
  reportType,
  title,
  targetId,
  students,
  quizzes,
  subjects,
  loadingStudents,
  loadingQuizzes,
  loadingSubjects,
  isTeacher,
  generating,
  onTitleChange,
  onTargetIdChange,
  onSubmit,
  onClose,
}: ReportGenerateModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={onSubmit} className="bg-card border border-border p-6 rounded-2xl max-w-lg w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Generate {reportType} Report</h3>
              <p className="text-xs text-muted-foreground">Compile academic data into a structured report</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Report Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {reportType === "Student Performance" && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Target Student (optional)</label>
              <select
                value={targetId}
                onChange={(e) => onTargetIdChange(e.target.value)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{loadingStudents ? "Loading students..." : "All students"}</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {reportType === "Quiz Analytics" && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Target Quiz (optional)</label>
              <select
                value={targetId}
                onChange={(e) => onTargetIdChange(e.target.value)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{loadingQuizzes ? "Loading quizzes..." : "All quizzes"}</option>
                {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.subjectName})</option>)}
              </select>
            </div>
          )}

          {reportType === "Subject Summary" && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Target Subject (optional)</label>
              <select
                value={targetId}
                onChange={(e) => onTargetIdChange(e.target.value)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{loadingSubjects ? "Loading subjects..." : "All subjects"}</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {reportType === "AI Usage" && (
            <p className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
              {isTeacher
                ? "Generates an AI Usage report for your own generated content."
                : "Generates an AI Usage report summarizing all AI-generated content across the platform."}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={generating}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{generating ? "Generating..." : "Generate Report"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
