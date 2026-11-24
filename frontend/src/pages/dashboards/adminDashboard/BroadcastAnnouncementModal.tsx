import React from "react";
import { X } from "lucide-react";
import type { Subject } from "../../../types";

interface BroadcastAnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  annTitle: string;
  setAnnTitle: (value: string) => void;
  annContent: string;
  setAnnContent: (value: string) => void;
  annAudience: "all" | "students" | "teachers";
  setAnnAudience: (value: "all" | "students" | "teachers") => void;
  annPriority: "high" | "medium" | "low";
  setAnnPriority: (value: "high" | "medium" | "low") => void;
  annSubjectId: string;
  setAnnSubjectId: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const BroadcastAnnouncementModal: React.FC<BroadcastAnnouncementModalProps> = ({
  open,
  onClose,
  subjects,
  annTitle,
  setAnnTitle,
  annContent,
  setAnnContent,
  annAudience,
  setAnnAudience,
  annPriority,
  setAnnPriority,
  annSubjectId,
  setAnnSubjectId,
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
          <h3 className="text-base font-bold text-foreground">Broadcast Institutional Notice</h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold mb-1">Notice Title</label>
            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="e.g. System Maintenance & Exam Schedule"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Target Audience</label>
              <select
                value={annAudience}
                onChange={(e) => setAnnAudience(e.target.value as "all" | "students" | "teachers")}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
              >
                <option value="all">Everyone (All Roles)</option>
                <option value="students">Students Only</option>
                <option value="teachers">Faculty / Teachers Only</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Priority Level</label>
              <select
                value={annPriority}
                onChange={(e) => setAnnPriority(e.target.value as "high" | "medium" | "low")}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
              >
                <option value="high">High / Urgent</option>
                <option value="medium">Medium</option>
                <option value="low">Low / Info</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Associated Course Subject</label>
            <select
              value={annSubjectId}
              onChange={(e) => setAnnSubjectId(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground"
            >
              <option value="">-- Institutional / All Subjects --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">Notice Body Content</label>
            <textarea
              required
              rows={4}
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              placeholder="Details of the announcement bulletin..."
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

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
              className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Publish Bulletin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
