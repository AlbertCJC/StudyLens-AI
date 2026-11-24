import React from "react";
import { X } from "lucide-react";

interface EditAnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  editAnnTitle: string;
  setEditAnnTitle: (value: string) => void;
  editAnnContent: string;
  setEditAnnContent: (value: string) => void;
  editAnnAudience: "all" | "students" | "teachers";
  setEditAnnAudience: (value: "all" | "students" | "teachers") => void;
  editAnnPriority: "high" | "medium" | "low";
  setEditAnnPriority: (value: "high" | "medium" | "low") => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const EditAnnouncementModal: React.FC<EditAnnouncementModalProps> = ({
  open,
  onClose,
  editAnnTitle,
  setEditAnnTitle,
  editAnnContent,
  setEditAnnContent,
  editAnnAudience,
  setEditAnnAudience,
  editAnnPriority,
  setEditAnnPriority,
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
          <h3 className="text-base font-bold text-foreground">Edit Bulletin Announcement</h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold mb-1">Title</label>
            <input
              type="text"
              required
              value={editAnnTitle}
              onChange={(e) => setEditAnnTitle(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Target Audience</label>
              <select
                value={editAnnAudience}
                onChange={(e) => setEditAnnAudience(e.target.value as "all" | "students" | "teachers")}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
              >
                <option value="all">Everyone</option>
                <option value="students">Students</option>
                <option value="teachers">Faculty</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Priority</label>
              <select
                value={editAnnPriority}
                onChange={(e) => setEditAnnPriority(e.target.value as "high" | "medium" | "low")}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Content</label>
            <textarea
              required
              rows={4}
              value={editAnnContent}
              onChange={(e) => setEditAnnContent(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
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
              Save Announcement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
