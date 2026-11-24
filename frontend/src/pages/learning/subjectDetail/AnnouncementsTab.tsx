import { Bell, Megaphone, Pencil, Trash2 } from "lucide-react";
import { Pagination, slicePage } from "../../../components/Pagination";
import type { AnnouncementItem } from "../../../context/AnnouncementsContext";

interface AnnouncementsTabProps {
  subjectAnnouncements: AnnouncementItem[];
  annPage: number;
  setAnnPage: (page: number) => void;
  currentUser: { id: string | null | undefined; role: string | null | undefined } | null;
  subject: { teacherId: string };
  canManage: boolean;
  onPost: () => void;
  onDetail: (a: AnnouncementItem) => void;
  onEdit: (a: AnnouncementItem) => void;
  onRequestDelete: (a: AnnouncementItem) => void;
}

function priorityBadge(priority: string) {
  if (priority === "high") {
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  if (priority === "medium") {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "bg-slate-500/10 text-muted-foreground";
}

export function AnnouncementsTab({
  subjectAnnouncements,
  annPage,
  setAnnPage,
  currentUser,
  subject,
  canManage,
  onPost,
  onDetail,
  onEdit,
  onRequestDelete,
}: AnnouncementsTabProps) {
  const canManageAnn = (a: AnnouncementItem) =>
    (a.authorId && a.authorId === currentUser?.id) ||
    (currentUser?.role === "teacher" && currentUser.id === subject.teacherId);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
          <Bell className="w-4 h-4 text-primary dark:text-indigo-300" />
          <span>Class Announcements</span>
        </h2>
        {canManage && (
          <button
            onClick={onPost}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Post Announcement</span>
          </button>
        )}
      </div>

      {subjectAnnouncements.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          No announcements posted for this subject yet.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            {slicePage(subjectAnnouncements, annPage).map((a) => {
              const canManage = canManageAnn(a);
              return (
                <div
                  key={a.id}
                  onClick={() => onDetail(a)}
                  className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1.5 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{a.title}</p>
                      {a.subjectName && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300 shrink-0">
                          {a.subjectName}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full shrink-0 ${priorityBadge(a.priority)}`}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{a.content}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {a.authorName} • {a.createdAt}
                    </p>
                    {canManage && (
                      <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onEdit(a)}
                          className="p-1.5 text-amber-600 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                          title="Edit Announcement"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRequestDelete(a)}
                          className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination page={annPage} total={subjectAnnouncements.length} onPageChange={setAnnPage} />
        </>
      )}
    </div>
  );
}
