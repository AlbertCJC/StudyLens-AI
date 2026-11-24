import React from "react";
import type { Subject } from "../../../types";
import { CardDetailModal, DetailRow } from "../../../components/CardDetailModal";

interface AdminSubjectDetailCardProps {
  open: boolean;
  subjects: Subject[];
  onClose: () => void;
  onSubjectClick: (id: string) => void;
}

export const AdminSubjectDetailCard: React.FC<AdminSubjectDetailCardProps> = ({
  open,
  subjects,
  onClose,
  onSubjectClick,
}) => (
  <CardDetailModal
    open={open}
    title="Course Subjects"
    subtitle={`${subjects.length} course subject${subjects.length === 1 ? "" : "s"} in the catalog.`}
    onClose={onClose}
  >
    {subjects.length === 0 ? (
      <p className="text-xs text-muted-foreground">No course subjects in the catalog yet.</p>
    ) : (
      <ul className="space-y-2">
        {subjects.map((s) => (
          <li key={s.id}>
            <DetailRow
              label={`${s.code} — ${s.name}`}
              sublabel={s.teacherName || [s.semester, s.course].filter(Boolean).join(" • ")}
              trailing={
                <span className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300">
                    {s.studentCount ?? 0} student{(s.studentCount ?? 0) === 1 ? "" : "s"}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">
                    {s.materialCount ?? 0} material{(s.materialCount ?? 0) === 1 ? "" : "s"}
                  </span>
                </span>
              }
              onClick={() => onSubjectClick(s.id)}
            />
          </li>
        ))}
      </ul>
    )}
  </CardDetailModal>
);
