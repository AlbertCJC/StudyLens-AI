import React from "react";
import { Plus, Pencil, Users, Trash2 } from "lucide-react";
import type { Subject } from "../../../types";
import { avatarUrl } from "../../learning/subjectDetail/subjectDetailUtils";

interface SubjectCatalogProps {
  subjects: Subject[];
  onAddSubject: () => void;
  onEditSubject: (sub: Subject) => void;
  onOpenRoster: (sub: Subject) => void;
  onDeleteSubject: (sub: Subject) => void;
}

export const SubjectCatalog: React.FC<SubjectCatalogProps> = ({
  subjects,
  onAddSubject,
  onEditSubject,
  onOpenRoster,
  onDeleteSubject,
}) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-foreground">Subject Catalog</h3>
      </div>

      <button
        onClick={onAddSubject}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
      >
        <Plus className="w-4 h-4" />
        <span>Add Subject</span>
      </button>
    </div>

    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
          <tr>
            <th className="p-3">Code</th>
            <th className="p-3">Subject & Description</th>
            <th className="p-3">Assigned Teacher</th>
            <th className="p-3">Semester / Course</th>
            <th className="p-3">Students</th>
            <th className="p-3">Materials</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {subjects.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-muted-foreground">
                No subjects yet. Click "Add Subject" to create the first course entry.
              </td>
            </tr>
          ) : (
            subjects.map((sub, index) => (
              <tr key={`${sub.id}-${index}`} className="hover:bg-muted/20">
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[11px] font-bold">
                    {sub.code}
                  </span>
                </td>
                <td className="p-3">
                  <p className="font-bold text-foreground">{sub.name}</p>
                  {sub.description && (
                    <p className="text-[11px] text-muted-foreground truncate max-w-xs">{sub.description}</p>
                  )}
                </td>
                <td className="p-3 font-semibold text-muted-foreground">
                  <span className="flex items-center gap-2">
                    {avatarUrl(sub.teacherAvatar) ? (
                      <img
                        src={avatarUrl(sub.teacherAvatar)!}
                        alt={sub.teacherName}
                        className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {sub.teacherName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate">{sub.teacherName}</span>
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  <p>{sub.semester || "1st Semester"}</p>
                  <p className="text-[11px]">{sub.course || "BSIT"} • {sub.schoolYear || "2026-2027"}</p>
                </td>
                <td className="p-3 font-bold text-foreground">{sub.studentCount}</td>
                <td className="p-3 font-bold text-foreground">{sub.materialCount}</td>
                <td className="p-3 text-right space-x-1.5">
                  <button
                    onClick={() => onEditSubject(sub)}
                    className="p-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors cursor-pointer"
                    title="Edit Subject"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenRoster(sub)}
                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-colors cursor-pointer"
                    title="Manage Class Roster"
                  >
                    <Users className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteSubject(sub)}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="Delete Subject"
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
  </div>
);
