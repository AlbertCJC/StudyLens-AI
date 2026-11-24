import type { Dispatch, SetStateAction } from "react";
import { BarChart2, ChevronDown, ChevronRight } from "lucide-react";
import type { SubjectGrades } from "../../../types";
import { groupAttemptsByQuiz } from "./subjectDetailUtils";

interface GradesTabProps {
  grades: SubjectGrades | null;
  gradesLoading: boolean;
  isStaff: boolean;
  expandedGradeStudents: Record<string, boolean>;
  setExpandedGradeStudents: Dispatch<SetStateAction<Record<string, boolean>>>;
}

export function GradesTab({
  grades,
  gradesLoading,
  isStaff,
  expandedGradeStudents,
  setExpandedGradeStudents,
}: GradesTabProps) {
  if (gradesLoading) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Loading grades...</p>;
  }

  if (isStaff) {
    return (
      <div className="space-y-3">
        {(grades?.students || []).map((st) => {
          const isExpanded = !!expandedGradeStudents[st.studentId];
          return (
            <div key={st.studentId} className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
              <button
                type="button"
                onClick={() =>
                  setExpandedGradeStudents((prev) => ({ ...prev, [st.studentId]: !isExpanded }))
                }
                className="w-full flex items-center justify-between gap-3 cursor-pointer group"
                title={isExpanded ? "Hide grades" : "Show grades"}
              >
                <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {st.studentName}
                </p>
                <span className="text-muted-foreground shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              </button>
              {isExpanded && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-muted-foreground">{st.attemptCount} attempt(s)</p>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                        st.averagePercentage >= 75
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : st.averagePercentage >= 60
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      Final Grade: {st.averagePercentage}%
                    </span>
                  </div>
                  {st.attempts.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      {groupAttemptsByQuiz(st.attempts).map((grp) => (
                        <div key={grp.entries[0].id} className="space-y-1">
                          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/60">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-foreground truncate">
                                {grp.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{grp.entries[0].completedAt}</p>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[11px] font-mono font-bold text-foreground">
                                {grp.entries[0].score}/{grp.entries[0].maxScore}
                              </span>
                              <span className={`text-[10px] font-bold ${grp.entries[0].passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {grp.entries[0].percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    grades && (grades.attempts || []).length === 0 ? (
      <p className="text-xs text-muted-foreground py-6 text-center">
        You haven't taken any quizzes in this subject yet. Take a quiz to see your grade.
      </p>
    ) : (
      <div className="space-y-4">
        <div className="p-5 rounded-xl border border-structure-strong bg-structure flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Final Grade (average of all quiz scores)
            </p>
            <p className="text-3xl font-black text-foreground mt-1">
              {grades?.averagePercentage || 0}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {grades?.attemptCount || 0} quiz attempt(s)
            </p>
          </div>
          <BarChart2 className="w-10 h-10 text-primary dark:text-indigo-300" />
        </div>

        <div className="space-y-3">
          {groupAttemptsByQuiz(grades?.attempts || []).map((grp) => (
            <div key={grp.entries[0].id} className="space-y-1.5">
              <div
                className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{grp.title}</p>
                  <p className="text-[10px] text-muted-foreground">{grp.entries[0].completedAt}</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[11px] font-mono font-bold text-foreground">
                    {grp.entries[0].score}/{grp.entries[0].maxScore}
                  </span>
                  <span className={`text-[10px] font-bold ${grp.entries[0].passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {grp.entries[0].percentage}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  );
}
