import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  authorName: string;
  targetAudience: "all" | "students" | "teachers";
  priority: "high" | "medium" | "low";
  createdAt: string;
  isRead: boolean;
  tag?: string;
  subjectId?: string;
  subjectName?: string;
}

interface AnnouncementsContextType {
  announcements: AnnouncementItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  addAnnouncement: (announcement: Omit<AnnouncementItem, "id" | "createdAt" | "isRead">) => void;
  deleteAnnouncement: (id: string) => void;
}

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined);

const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-1",
    title: "Midterm Examination Schedule & Coverage Released",
    content: "The official midterm exam schedule for CS and IT courses is now uploaded under Subjects and Assessment management.",
    authorName: "Academic Affairs",
    targetAudience: "all",
    priority: "high",
    createdAt: "Today, 10:00 AM",
    isRead: false,
    tag: "Exam Notice",
  },
  {
    id: "ann-2",
    title: "StudyLens AI Engine Upgraded to Gemini 3.6 Flash",
    content: "You can now generate Bloom's taxonomy quizzes, automatic flashcard decks, and summary notes 3x faster.",
    authorName: "System Administrator",
    targetAudience: "all",
    priority: "medium",
    createdAt: "Yesterday, 3:30 PM",
    isRead: false,
    tag: "AI Update",
  },
  {
    id: "ann-3",
    title: "Faculty Workshop: Creating Adaptive Quizzes",
    content: "All instructors are invited to join the online session on setting up difficulty tags and topic mappings.",
    authorName: "Dean's Office",
    targetAudience: "teachers",
    priority: "low",
    createdAt: "3 days ago",
    isRead: false,
    tag: "Faculty",
  },
];

const LIST_KEY = "studylens_announcements";
const readKeyFor = (userId: string) => `studylens_announcements_read_${userId}`;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch {
    // ignore corrupt storage
  }
  return fallback;
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
}

export const AnnouncementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || "guest";

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(() =>
    loadJSON<AnnouncementItem[]>(LIST_KEY, INITIAL_ANNOUNCEMENTS)
  );
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const list = loadJSON<string[]>(readKeyFor(userId), []);
    return new Set(list);
  });

  // Re-load read state when the signed-in user/role changes
  useEffect(() => {
    const list = loadJSON<string[]>(readKeyFor(userId), []);
    setReadIds(new Set(list));
  }, [userId]);

  // Persist read state per user so one role's reads never leak into another
  useEffect(() => {
    saveJSON(readKeyFor(userId), Array.from(readIds));
  }, [readIds, userId]);

  // Fetch announcements from the server (per-user isRead) when the user changes
  useEffect(() => {
    let active = true;
    fetch(`/api/announcements?userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const serverIds = new Set<string>();
        const serverItems: AnnouncementItem[] = data.map((item) => {
          const id = item.id || "";
          if (id) serverIds.add(id);
          return {
            id,
            title: item.title || "Announcement",
            content: item.content || "",
            authorName: item.authorName || "Administrator",
            targetAudience: item.targetAudience || "all",
            priority: item.priority || "medium",
            createdAt: item.createdAt || "Recently",
            isRead: !!item.isRead,
            tag: item.priority === "high" ? "Urgent" : "Notice",
            subjectId: item.subjectId,
            subjectName: item.subjectName,
          };
        });
        if (serverIds.size > 0) {
          setReadIds((prev) => {
            const next = new Set(prev);
            data.forEach((item) => {
              if (item.isRead && item.id) next.add(item.id);
            });
            return next;
          });
        }
        // Server is the source of truth; keep any locally-created items not on the server.
        setAnnouncements((prev) => [
          ...serverItems,
          ...prev.filter((a) => !serverIds.has(a.id)),
        ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  // Attach per-user read state to the displayed items
  const visibleAnnouncements = announcements.map((a) => ({ ...a, isRead: readIds.has(a.id) }));
  const unreadCount = visibleAnnouncements.filter((a) => !a.isRead).length;

  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      fetch(`/api/announcements/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    },
    [userId]
  );

  const markAsUnread = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetch(`/api/announcements/${id}/unread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    },
    [userId]
  );

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      announcements.forEach((a) => next.add(a.id));
      return next;
    });
    announcements.forEach((a) => {
      fetch(`/api/announcements/${a.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    });
  }, [announcements, userId]);

  const addAnnouncement = useCallback(
    (newAnn: Omit<AnnouncementItem, "id" | "createdAt" | "isRead">) => {
      const optimistic: AnnouncementItem = {
        ...newAnn,
        id: `ann-${Date.now()}`,
        createdAt: "Just now",
        isRead: false,
      };
      setAnnouncements((prev) => [optimistic, ...prev]);

      fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optimistic),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const created = await res.json().catch(() => null);
          if (!created || !created.id) return;
          // Replace the optimistic item with the server-authoritative record
          setAnnouncements((prev) =>
            prev.map((a) =>
              a.id === optimistic.id ? { ...a, id: created.id, createdAt: created.createdAt || a.createdAt } : a
            )
          );
        })
        .catch(() => {});
    },
    []
  );

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    fetch(`/api/announcements/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements: visibleAnnouncements,
        unreadCount,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        addAnnouncement,
        deleteAnnouncement,
      }}
    >
      {children}
    </AnnouncementsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAnnouncements = () => {
  const context = useContext(AnnouncementsContext);
  if (!context) {
    throw new Error("useAnnouncements must be used within an AnnouncementsProvider");
  }
  return context;
};