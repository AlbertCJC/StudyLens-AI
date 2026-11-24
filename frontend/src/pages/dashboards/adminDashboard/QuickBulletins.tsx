import React from "react";
import { Megaphone } from "lucide-react";
import { RelativeTime } from "../../../utils/time";
import type { AnnouncementItem } from "../../../context/AnnouncementsContext";

interface QuickBulletinsProps {
  announcements: AnnouncementItem[];
  onBroadcast: () => void;
  onManage: () => void;
}

export const QuickBulletins: React.FC<QuickBulletinsProps> = ({ announcements, onBroadcast, onManage }) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="p-2 bg-structure text-primary dark:text-indigo-300 rounded-xl">
          <Megaphone className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Recent Institutional Bulletins</h3>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onBroadcast}
          className="px-3 py-1.5 bg-structure hover:bg-structure-strong text-structure-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Broadcast Notice</span>
        </button>
        <button
          onClick={onManage}
          className="text-xs font-bold text-primary hover:text-primary/80 cursor-pointer"
        >
          Manage Bulletins →
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {announcements.length === 0 ? (
        <div className="col-span-2 p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border">
          No active announcements published. Click "Broadcast Notice" to post one.
        </div>
      ) : (
        announcements.slice(0, 4).map((ann) => (
          <div key={ann.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                ann.priority === "high" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : "bg-structure text-primary border border-structure-strong"
              }`}>
                {ann.priority || "medium"} Priority
              </span>
              <RelativeTime iso={ann.createdAt} className="text-[11px] text-muted-foreground" />
            </div>
            <h4 className="text-xs font-bold text-foreground line-clamp-1">{ann.title}</h4>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{ann.content}</p>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
              <span>By: {ann.authorName}</span>
              <span className="capitalize">Target: {ann.targetAudience}</span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
