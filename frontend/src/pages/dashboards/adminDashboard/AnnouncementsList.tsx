import React from "react";
import { RelativeTime } from "../../../utils/time";
import { Pencil, Trash2 } from "lucide-react";
import type { AnnouncementItem } from "../../../context/AnnouncementsContext";

interface AnnouncementsListProps {
  announcements: AnnouncementItem[];
  onEditAnn: (ann: AnnouncementItem) => void;
  onDeleteAnnouncement: (id: string) => void;
}

export const AnnouncementsList: React.FC<AnnouncementsListProps> = ({
  announcements,
  onEditAnn,
  onDeleteAnnouncement,
}) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base font-bold text-foreground">Global Institutional Bulletins</h3>
      </div>
    </div>

    <div className="space-y-3">
      {announcements.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-border">
          No active announcements published yet. Click "Broadcast Notice" above to send an update.
        </div>
      ) : (
        announcements.map((ann) => (
          <div
            key={ann.id}
            className="p-5 rounded-2xl border border-border bg-card hover:bg-muted/10 space-y-3 transition-all hover:border-primary/50 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/50">
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    ann.priority === "high"
                      ? "bg-structure text-primary dark:text-indigo-300 border border-structure-strong"
                      : ann.priority === "medium"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-structure text-primary dark:text-indigo-300 border border-structure-strong"
                  }`}
                >
                  {ann.priority || "medium"} Priority
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border/50 capitalize">
                  Audience: {ann.targetAudience}
                </span>
                {ann.tag && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-structure text-primary dark:text-indigo-300 border border-structure-strong">
                    {ann.tag}
                  </span>
                )}
                {ann.subjectName && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-structure text-primary dark:text-indigo-300 border border-structure-strong">
                    {ann.subjectName}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
                <RelativeTime iso={ann.createdAt} className="text-xs text-muted-foreground" />
                <div className="flex items-center space-x-1 border-l border-border pl-2">
                  <button
                    onClick={() => onEditAnn(ann)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                    title="Edit Bulletin"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteAnnouncement(ann.id)}
                    className="p-1.5 text-primary hover:text-primary/80 hover:bg-structure-strong rounded-lg transition-colors cursor-pointer"
                    title="Delete Bulletin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-base font-bold text-foreground tracking-tight">{ann.title}</h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">{ann.content}</p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/30">
              <span className="flex items-center space-x-1">
                <span>Published by:</span>
                <strong className="text-foreground font-semibold">{ann.authorName}</strong>
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
