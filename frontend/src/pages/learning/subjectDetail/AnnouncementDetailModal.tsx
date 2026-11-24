import { GraduationCap, X } from "lucide-react";
import type { AnnouncementItem } from "../../../context/AnnouncementsContext";

interface AnnouncementDetailModalProps {
  open: boolean;
  onClose: () => void;
  announcement: AnnouncementItem;
}

export function AnnouncementDetailModal({ open, onClose, announcement }: AnnouncementDetailModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <span
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                  announcement.priority === "high"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    : announcement.priority === "medium"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                }`}
              >
                {announcement.priority.toUpperCase()}
              </span>
              {announcement.subjectName && (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {announcement.subjectName}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground leading-snug">{announcement.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-foreground">{announcement.authorName}</p>
              <p className="text-[10px] text-muted-foreground">Announcement Author</p>
            </div>
          </div>
          <span className="font-medium text-foreground">{announcement.createdAt}</span>
        </div>

        <div className="bg-muted/20 p-4 rounded-xl border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-wrap min-h-[120px]">
          {announcement.content}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close Notice
          </button>
        </div>
      </div>
    </div>
  );
}
