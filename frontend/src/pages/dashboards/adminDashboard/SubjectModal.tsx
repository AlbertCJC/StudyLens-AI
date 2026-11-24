import React from "react";
import { X } from "lucide-react";
import type { Subject, User } from "../../../types";

interface SubjectModalProps {
  open: boolean;
  onClose: () => void;
  editingSubject: Subject | null;
  subCode: string;
  setSubCode: (value: string) => void;
  subName: string;
  setSubName: (value: string) => void;
  subDesc: string;
  setSubDesc: (value: string) => void;
  subTeacherId: string;
  setSubTeacherId: (value: string) => void;
  subSemester: string;
  setSubSemester: (value: string) => void;
  subCourse: string;
  setSubCourse: (value: string) => void;
  subYear: string;
  setSubYear: (value: string) => void;
  teachers: User[];
  subMsg: { type: "error" | "success"; text: string } | null;
  onSubmit: (e: React.FormEvent) => void;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  open,
  onClose,
  editingSubject,
  subCode,
  setSubCode,
  subName,
  setSubName,
  subDesc,
  setSubDesc,
  subTeacherId,
  setSubTeacherId,
  subSemester,
  setSubSemester,
  subCourse,
  setSubCourse,
  subYear,
  setSubYear,
  teachers,
  subMsg,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">{editingSubject ? "Edit Subject" : "Add New Subject"}</h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Subject Code</label>
              <input
                type="text"
                required
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                placeholder="e.g. CS 301"
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-mono font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Subject Name</label>
              <input
                type="text"
                required
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms"
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Description</label>
            <textarea
              rows={2}
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              placeholder="Brief description of the subject"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Assigned Teacher</label>
            <select
              value={subTeacherId}
              onChange={(e) => setSubTeacherId(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
            >
              {teachers.length === 0 ? (
                <option value="">No teacher accounts available</option>
              ) : (
                teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Semester</label>
              <select
                value={subSemester}
                onChange={(e) => setSubSemester(e.target.value)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
              >
                {["1st Semester", "2nd Semester", "Summer"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Course Program</label>
              <select
                value={subCourse}
                onChange={(e) => setSubCourse(e.target.value)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
              >
                {["BSIT", "BSCS", "BSIS", "BSCPE"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">School Year</label>
            <input
              type="text"
              value={subYear}
              onChange={(e) => setSubYear(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-mono font-medium focus:outline-none"
            />
          </div>

          {subMsg && (
            <p className={`text-xs font-bold ${subMsg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {subMsg.text}
            </p>
          )}

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={teachers.length === 0}
              className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
            >
              {editingSubject ? "Save Changes" : "Create Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
