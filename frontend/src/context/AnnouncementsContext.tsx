import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "./AuthContext";
import { authFetch } from "../utils/authFetch";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorId?: string;
  targetAudience: "all" | "students" | "teachers";
  priority: "high" | "medium" | "low";
  createdAt: string;
  tag?: string;
  subjectId?: string;
  subjectName?: string;
}

// A notification persisted in the shared `notifications` table (DB-backed).
export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  target?: string | null;
}

// Normalized entry shown in the header bell. It can come from either the
// notifications table (kind=notification) or an announcement (kind=announcement).
export interface BellItem {
  id: string;
  kind: "notification" | "announcement";
  title: string;
  content: string;
  createdAt: string;
  tag?: string;
  priority?: string;
  subjectName?: string;
  authorName?: string;
  announcementId?: string;
  target?: string | null;
}

interface AnnouncementsContextType {
  announcements: AnnouncementItem[];
  dbNotifications: NotificationItem[];
  // Merged feed that drives the header bell badge + dropdown: DB notifications
  // plus announcements visible to the current user (own posts excluded).
  notifications: BellItem[];
  addAnnouncement: (announcement: Omit<AnnouncementItem, "id" | "createdAt">) => Promise<void>;
  updateAnnouncement: (id: string, patch: Partial<AnnouncementItem>) => Promise<void>;
  deleteAnnouncement: (id: string) => void;
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined);

const readKeyFor = (userId: string) => `studylens_ann_read_${userId}`;

// Cache is scoped per account (id + role) so one user's feed can never leak
// into another user's session via shared local storage.
const listKeyFor = (userId: string, userRole: string) =>
  `studylens_announcements_${userRole}_${userId}`;

const POLL_INTERVAL_MS = 25000;

// Legacy demo seeds (ann-1/ann-2/ann-3) are no longer generated anywhere.
// They are only kept here so any cached copies in local storage from older
// builds are never re-merged into a user's feed.
const LEGACY_SEED_ANNOUNCEMENT_IDS = new Set(["ann-1", "ann-2", "ann-3"]);

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch {
    // ignore corrupt storage
  }
  return fallback;
}

// Older builds stored display strings like "Just now" as createdAt and even
// persisted them to the server. Normalize any unparseable value to a real
// ISO timestamp once on load so relative-time labels behave correctly.
function normalizeTimestamps(items: AnnouncementItem[]): AnnouncementItem[] {
  let mutated = false;
  const next = items.map((item) => {
    if (item.createdAt && !isNaN(new Date(item.createdAt).getTime())) return item;
    mutated = true;
    return { ...item, createdAt: new Date().toISOString() };
  });
  return mutated ? next : items;
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
  const userRole = currentUser?.role || "";

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [dbNotifications, setDbNotifications] = useState<NotificationItem[]>([]);

  // Reset the feed when the signed-in identity changes so cached items from a
  // previous account are never shown to the next one.
  const identityRef = useRef(`${userRole}:${userId}`);
  useEffect(() => {
    const identity = `${userRole}:${userId}`;
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    try {
      localStorage.removeItem("studylens_announcements");
    } catch { /* ignore */ }
    setAnnouncements(
      normalizeTimestamps(loadJSON<AnnouncementItem[]>(listKeyFor(userId, userRole), []))
    );
    setDbNotifications([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]);

  // Per-user viewed sets (lazily hydrated from localStorage on first read).
  // Used to track which ANNOUNCEMENTS have been seen (the DB only tracks
  // read state for notifications).
  const [viewedByUser, setViewedByUser] = useState<Record<string, string[]>>({});
  const viewedIds = useMemo(
    () => new Set(viewedByUser[userId] || loadJSON<string[]>(readKeyFor(userId), [])),
    [viewedByUser, userId]
  );

  const markViewed = useCallback(
    (next: Set<string>) => {
      setViewedByUser((prev) => ({ ...prev, [userId]: [...next] }));
      saveJSON(readKeyFor(userId), [...next]);
    },
    [userId]
  );

  // Announcements visible in the bell: excludes the user's own posts and hides
  // everything from admins (their record lives in audit logs).
  const bellAnnouncements = useMemo(
    () =>
      userRole === "admin"
        ? []
        : announcements.filter((a) => !a.authorId || a.authorId !== userId),
    [announcements, userId, userRole]
  );

  // Merged bell feed, newest first.
  const notifications = useMemo<BellItem[]>(() => {
    const fromNotifications: BellItem[] = dbNotifications.map((n) => ({
      id: `notif-${n.id}`,
      kind: "notification",
      title: n.title,
      content: n.content,
      createdAt: n.createdAt,
      tag: "Notice",
      target: n.target || null,
    }));
    const fromAnnouncements: BellItem[] = bellAnnouncements.map((a) => ({
      id: `ann-${a.id}`,
      kind: "announcement",
      title: a.title,
      content: a.content,
      createdAt: a.createdAt,
      tag: a.tag || a.priority,
      priority: a.priority,
      subjectName: a.subjectName,
      authorName: a.authorName,
      announcementId: a.id,
    }));
    return [...fromNotifications, ...fromAnnouncements]
      .filter((i) => i.id && !LEGACY_SEED_ANNOUNCEMENT_IDS.has(i.announcementId || ""))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [dbNotifications, bellAnnouncements]);

  // Unread count = unread DB notifications + unread announcements.
  const unreadAnnouncements = bellAnnouncements.filter((a) => a.id && !viewedIds.has(a.id)).length;
  const unreadNotifications = dbNotifications.filter((n) => !n.isRead).length;
  const unreadCount = unreadAnnouncements + unreadNotifications;

  const markAnnouncementsViewed = useCallback(
    (ids: string[]) => {
      markViewed(new Set([...viewedIds, ...ids.filter(Boolean)]));
    },
    [markViewed, viewedIds]
  );

  // Mark a single DB notification read (persisted to the backend).
  const markNotificationRead = useCallback(
    (id: string) => {
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      authFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" }).catch(() => {});
    },
    []
  );

  const markAllNotificationsRead = useCallback(() => {
    markAnnouncementsViewed(bellAnnouncements.map((a) => a.id));
    if (unreadNotifications > 0) {
      setDbNotifications((prev) => prev.map((n) => (n.isRead ? n : { ...n, isRead: true })));
      authFetch("/api/notifications/read-all", { method: "PUT" }).catch(() => {});
    }
  }, [bellAnnouncements, unreadNotifications, markAnnouncementsViewed]);

  // Fetch announcements + notifications from the server; poll lightly and
  // refresh when the tab regains focus so both platforms stay in sync.
  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    const loadAnnouncements = () =>
      authFetch(`/api/announcements?userId=${encodeURIComponent(userId)}&userRole=${encodeURIComponent(userRole)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (!active || !Array.isArray(data)) return;
          const serverItems: AnnouncementItem[] = data
            .filter((item: any) => item && !LEGACY_SEED_ANNOUNCEMENT_IDS.has(item.id))
            .map((item: any) => {
              const rawCreatedAt: string = item.createdAt || "";
              const createdAt =
                rawCreatedAt && !isNaN(new Date(rawCreatedAt).getTime())
                  ? rawCreatedAt
                  : new Date().toISOString();
              return {
                id: item.id || "",
                title: item.title || "Announcement",
                content: item.content || "",
                authorName: item.authorName || "Administrator",
                authorId: item.teacherId || item.authorId,
                targetAudience: item.targetAudience || "all",
                priority: item.priority || "medium",
                createdAt,
                tag: item.priority === "high" ? "Urgent" : "Notice",
                subjectId: item.subjectId,
                subjectName: item.subjectName,
              };
            });
          // Server is the source of truth; never merge stale local items.
          setAnnouncements(serverItems);
        })
        .catch(() => {});

    const loadNotifications = () =>
      authFetch(`/api/notifications`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (!active || !Array.isArray(data)) return;
          setDbNotifications(
            data.map((n: any) => ({
              id: n.id || "",
              userId: n.userId || "",
              title: n.title || "",
              content: n.message || n.content || "",
              isRead: !!n.isRead,
              createdAt: n.createdAt || "",
              target: n.target || null,
            }))
          );
        })
        .catch(() => {});

    loadAnnouncements();
    loadNotifications();
    const interval = setInterval(() => {
      loadAnnouncements();
      loadNotifications();
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      loadAnnouncements();
      loadNotifications();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]);

  const addAnnouncement = useCallback(
    async (newAnn: Omit<AnnouncementItem, "id" | "createdAt">): Promise<void> => {
      const optimistic: AnnouncementItem = {
        ...newAnn,
        id: `ann-${Date.now()}`,
        createdAt: new Date().toISOString(),
        authorId: currentUser?.id || newAnn.authorId,
      };
      setAnnouncements((prev) => [optimistic, ...prev]);

      try {
        const res = await authFetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(optimistic),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          // Remove the optimistic entry: the server rejected the post.
          setAnnouncements((prev) => prev.filter((a) => a.id !== optimistic.id));
          throw new Error(err?.error || `Could not post the announcement (status ${res.status}).`);
        }
        const created = await res.json().catch(() => null);
        if (!created || !created.id) return;
        // Replace the optimistic item with the server-authoritative record
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === optimistic.id
              ? { ...a, id: created.id, createdAt: created.createdAt || a.createdAt, authorId: created.teacherId || a.authorId }
              : a
          )
        );
      } catch (err) {
        if (err instanceof TypeError) {
          // Network failure: drop the optimistic entry and surface the error.
          setAnnouncements((prev) => prev.filter((a) => a.id !== optimistic.id));
          throw new Error("Could not reach the announcement service.");
        }
        throw err;
      }
    },
    [currentUser]
  );

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    const qs = currentUser
      ? `?userId=${encodeURIComponent(currentUser.id)}&userRole=${encodeURIComponent(currentUser.role)}`
      : "";
    authFetch(`/api/announcements/${id}${qs}`, { method: "DELETE" }).catch(() => {});
  }, [currentUser]);

  const updateAnnouncement = useCallback(
    async (id: string, patch: Partial<AnnouncementItem>): Promise<void> => {
      const snapshot = announcements.find((a) => a.id === id);
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      const qs = currentUser
        ? `?userId=${encodeURIComponent(currentUser.id)}&userRole=${encodeURIComponent(currentUser.role)}`
        : "";
      try {
        const res = await authFetch(`/api/announcements/${id}${qs}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          // Roll back the optimistic edit: the server rejected the change.
          if (snapshot) setAnnouncements((prev) => prev.map((a) => (a.id === id ? snapshot : a)));
          throw new Error(err?.error || `Could not save the announcement (status ${res.status}).`);
        }
        const updated = await res.json().catch(() => null);
        if (updated && updated.id) {
          setAnnouncements((prev) =>
            prev.map((a) => (a.id === id ? { ...a, ...patch, id: updated.id } : a))
          );
        }
      } catch (err) {
        if (err instanceof TypeError) {
          if (snapshot) setAnnouncements((prev) => prev.map((a) => (a.id === id ? snapshot : a)));
          throw new Error("Could not reach the announcement service.");
        }
        throw err;
      }
    },
    [announcements, currentUser]
  );

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements,
        dbNotifications,
        notifications,
        addAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
        unreadCount,
        markNotificationRead,
        markAllNotificationsRead,
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
