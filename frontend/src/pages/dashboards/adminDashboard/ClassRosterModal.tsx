import React from "react";
import { Search, X, RefreshCw, Plus, Trash2 } from "lucide-react";
import type { Subject } from "../../../types";
import type { User } from "../../../types";
import { avatarUrl } from "../../learning/subjectDetail/subjectDetailUtils";

interface ClassRosterModalProps {
  open: boolean;
  onClose: () => void;
  rosterSubject: Subject | null;
  rosterStudents: { id: string; name: string; email: string; avatar?: string | null; studentId?: string; dateEnrolled?: string }[];
  users: User[];
  assignStudentIds: string[];
  setAssignStudentIds: (ids: string[]) => void;
  assignFilter: "all" | "enrolled" | "unenrolled";
  setAssignFilter: (value: "all" | "enrolled" | "unenrolled") => void;
  assignSearch: string;
  setAssignSearch: (value: string) => void;
  rosterLoading: boolean;
  rosterMsg: { type: "error" | "success"; text: string } | null;
  handleAssignStudents: () => void;
  handleRemoveRosterStudent: (studentId: string) => void;
}

export const ClassRosterModal: React.FC<ClassRosterModalProps> = ({
  open,
  onClose,
  rosterSubject,
  rosterStudents,
  users,
  assignStudentIds,
  setAssignStudentIds,
  assignFilter,
  setAssignFilter,
  assignSearch,
  setAssignSearch,
  rosterLoading,
  rosterMsg,
  handleAssignStudents,
  handleRemoveRosterStudent,
}) => {
  if (!open || !rosterSubject) return null;

  const studentUsers = users.filter((u) => u.role === "student");
  const teacherUser = users.find((u) => u.id === rosterSubject.teacherId);
  const q = assignSearch.trim().toLowerCase();
  const filteredList = studentUsers.filter((student) => {
    const enrolled = rosterStudents.some((rs) => rs.id === student.id);
    if (assignFilter === "enrolled" && !enrolled) return false;
    if (assignFilter === "unenrolled" && enrolled) return false;
    if (q) {
      const haystack = `${student.name} ${student.email} ${student.studentId || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Class Roster</h3>
            <p className="text-xs text-muted-foreground">
              {rosterSubject.code} - {rosterSubject.name} • {rosterStudents.length} enrolled
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {rosterMsg && (
          <p className={`text-xs font-bold ${rosterMsg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
            {rosterMsg.text}
          </p>
        )}

        {teacherUser && (
          <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-2">
            <div className="flex items-center gap-3">
              {avatarUrl(teacherUser.avatar) ? (
                <img
                  src={avatarUrl(teacherUser.avatar)!}
                  alt={teacherUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                  {teacherUser.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-xs truncate">{teacherUser.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{teacherUser.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  {teacherUser.department ? `Department: ${teacherUser.department}` : "Department: General"}
                </p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300 shrink-0">
                Instructor
              </span>
            </div>
          </div>
        )}

        <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3">
          <p className="font-bold text-foreground text-xs">Assign Students</p>
          {studentUsers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No student accounts exist to assign.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    placeholder="Search students by name, email, or ID..."
                    className="w-full pl-8 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <select
                  value={assignFilter}
                  onChange={(e) => setAssignFilter(e.target.value as "all" | "enrolled" | "unenrolled")}
                  className="px-2.5 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
                >
                  <option value="all">All students</option>
                  <option value="unenrolled">Unenrolled</option>
                  <option value="enrolled">Enrolled</option>
                </select>
              </div>
              {filteredList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">
                  No students match the current filter/search.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {filteredList.map((student) => {
                    const alreadyEnrolled = rosterStudents.some((rs) => rs.id === student.id);
                    const checked = assignStudentIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border border-border bg-card cursor-pointer ${
                          alreadyEnrolled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyEnrolled}
                          onChange={(e) =>
                            setAssignStudentIds((prev) =>
                              e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id)
                            )
                          }
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        />
                        {avatarUrl(student.avatar) ? (
                          <img
                            src={avatarUrl(student.avatar)!}
                            alt={student.name}
                            className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-xs font-bold text-foreground flex-1">{student.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{student.studentId || student.email}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-end">
                <button
                  onClick={handleAssignStudents}
                  disabled={assignStudentIds.length === 0 || rosterLoading}
                  className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {rosterLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Assign Selected ({assignStudentIds.length})</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">Email</th>
                <th className="p-3">Enrolled</th>
                <th className="p-3 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rosterStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    {rosterLoading ? "Loading roster..." : "No students enrolled yet. Use the assign list above."}
                  </td>
                </tr>
              ) : (
                rosterStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/20">
                    <td className="p-3 font-bold text-foreground">
                      <span className="flex items-center gap-2">
                        {avatarUrl(student.avatar) ? (
                          <img
                            src={avatarUrl(student.avatar)!}
                            alt={student.name}
                            className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>{student.name}</span>
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-[11px]">{student.email}</td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {student.dateEnrolled ? new Date(student.dateEnrolled).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoveRosterStudent(student.id)}
                        disabled={rosterLoading}
                        className="p-1.5 bg-structure hover:bg-structure-strong text-primary rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Remove from subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-structure hover:bg-structure-strong text-structure-foreground text-xs font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
