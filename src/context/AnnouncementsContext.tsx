import React, { createContext, useContext, useState, useEffect } from "react";

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

export const AnnouncementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(() => {
    try {
      const saved = localStorage.getItem("studylens_announcements");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_ANNOUNCEMENTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("studylens_announcements", JSON.stringify(announcements));
    } catch (e) {
      console.error("Failed to save announcements to local storage", e);
    }
  }, [announcements]);

  // Fetch initial server announcements if needed
  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAnnouncements((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            const newServerItems: AnnouncementItem[] = data
              .filter((item) => !existingIds.has(item.id))
              .map((item) => ({
                id: item.id || `ann-${Date.now()}`,
                title: item.title,
                content: item.content,
                authorName: item.authorName || "Administrator",
                targetAudience: item.targetAudience || "all",
                priority: item.priority || "medium",
                createdAt: item.createdAt || "Recently",
                isRead: false,
                tag: item.priority === "high" ? "Urgent" : "Notice",
              }));
            return [...newServerItems, ...prev];
          });
        }
      })
      .catch(() => {});
  }, []);

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  const markAsRead = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
  };

  const markAsUnread = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: false } : a))
    );
  };

  const markAllAsRead = () => {
    setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
  };

  const addAnnouncement = (newAnn: Omit<AnnouncementItem, "id" | "createdAt" | "isRead">) => {
    const item: AnnouncementItem = {
      ...newAnn,
      id: `ann-${Date.now()}`,
      createdAt: "Just now",
      isRead: false,
    };
    setAnnouncements((prev) => [item, ...prev]);

    // Async sync with server endpoint
    fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }).catch(() => {});
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    fetch(`/api/announcements/${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements,
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

// eslint-disable-next-link-react-refresh/only-export-components
// eslint-disable-next-line react-refresh/only-export-components
export const useAnnouncements = () => {
  const context = useContext(AnnouncementsContext);
  if (!context) {
    throw new Error("useAnnouncements must be used within an AnnouncementsProvider");
  }
  return context;
};
