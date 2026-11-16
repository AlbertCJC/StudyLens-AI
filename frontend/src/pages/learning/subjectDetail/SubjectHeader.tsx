import { ArrowLeft } from "lucide-react";
import type { Subject } from "../../../types";

interface SubjectHeaderProps {
  subject: Subject;
  isStaff: boolean;
  navigate: (to: string) => void;
}

export function SubjectHeader({ subject, isStaff, navigate }: SubjectHeaderProps) {
  return (
    <>
      <button
        onClick={() => navigate("/subjects")}
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Subjects</span>
      </button>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center space-x-2 flex-wrap">
            <h1 className="text-base font-bold text-foreground leading-tight truncate">{subject.name}</h1>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold rounded-md">
              {subject.code}
            </span>
            {subject.semester && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-md uppercase tracking-wide">
                {subject.semester} • {subject.schoolYear || ""}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight max-w-2xl truncate">
            {subject.description || `Managed by ${isStaff ? "the faculty" : "your instructor"} • ${subject.studentCount} students • ${subject.materialCount} materials`}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0" />
      </div>
    </>
  );
}
