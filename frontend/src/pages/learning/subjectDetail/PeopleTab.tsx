import { Mail, UserCheck, ShieldCheck, Users } from "lucide-react";
import { Pagination, slicePage } from "../../../components/Pagination";
import { avatarUrl, type EnrolledStudent } from "./subjectDetailUtils";

interface PeopleTabProps {
  students: EnrolledStudent[];
  studentsLoading: boolean;
  peoplePage: number;
  setPeoplePage: (page: number) => void;
  currentUser: { role: string | null | undefined; id: string | null | undefined } | null;
  subject: { teacherName: string; teacherAvatar?: string | null };
  openAssignStudents: () => void;
}

export function PeopleTab({
  students,
  studentsLoading,
  peoplePage,
  setPeoplePage,
  currentUser,
  subject,
  openAssignStudents,
}: PeopleTabProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>People in this Subject</span>
        </h2>
        <span className="flex items-center space-x-2">
          {currentUser?.role === "admin" && (
            <button
              onClick={openAssignStudents}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign Students</span>
            </button>
          )}
        </span>
      </div>

      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          {avatarUrl(subject.teacherAvatar) ? (
            <img
              src={avatarUrl(subject.teacherAvatar)!}
              alt={subject.teacherName}
              className="w-9 h-9 rounded-full object-cover border border-blue-500/20 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{subject.teacherName}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              Assigned instructor for this subject
            </p>
          </div>
        </div>
      </div>

      <div className="text-xs font-semibold text-muted-foreground pt-1">
        Enrolled Students ({students.length})
      </div>

      {studentsLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading enrolled students...</p>
      ) : students.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No students are enrolled in this subject yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Student</th>
                  <th className="py-2 pr-4 font-semibold">Student ID</th>
                  <th className="py-2 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody>
                {slicePage(students, peoplePage).map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-bold text-foreground">
                      <span className="flex items-center gap-2">
                        {avatarUrl(s.avatar) ? (
                          <img
                            src={avatarUrl(s.avatar)!}
                            alt={s.name}
                            className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>{s.name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-muted-foreground">{s.studentId || "â€”"}</td>
                    <td className="py-2.5 text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{s.email || "â€”"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={peoplePage} total={students.length} onPageChange={setPeoplePage} />
        </>
      )}
    </div>
  );
}
