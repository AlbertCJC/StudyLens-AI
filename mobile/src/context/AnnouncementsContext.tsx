import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  Announcement,
  Notification,
  fetchAnnouncements,
  fetchNotifications,
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
} from '../services/api';
import { STORAGE_KEYS, getStringSet, addToStringSet, removeFromStringSet, getJSON, setJSON } from '../utils/storage';
import { useAuth } from './AuthContext';

const POLL_INTERVAL_MS = 25000;

export interface BellItem {
  id: string;
  kind: 'notification' | 'announcement';
  title: string;
  content: string;
  createdAt: string;
  tag?: string;
  priority?: string;
  subjectName?: string;
  authorName?: string;
  target?: string | null;
  announcementId?: string;
  notificationId?: string;
  isRead: boolean;
}

interface AnnouncementsContextType {
  announcements: Announcement[];
  // DB-backed notifications shown in the bell alongside announcements.
  notifications: Notification[];
  // Merged bell feed (DB notifications + announcements), newest first.
  bellItems: BellItem[];
  // Feed for the announcements screen: excludes the current user's own posts
  // and hides everything from admins (their record lives in audit logs).
  visibleAnnouncements: Announcement[];
  reloadAnnouncements: () => void;
  readAnnouncementIds: Set<string>;
  // Unread totals for the bell badge (announcements + DB notifications).
  unreadAnnouncements: number;
  unreadNotifications: number;
  unreadCount: number;
  markAnnouncementRead: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllAnnouncementsRead: () => void;
  markAllNotificationsRead: () => void;
  addLocalAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => void;
}

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined);

export const AnnouncementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? '';
  const userRole = currentUser?.role || '';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(new Set());
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) return;
    getStringSet(STORAGE_KEYS.readAnnouncements(userId)).then(setReadAnnouncementIds);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadAnn = () =>
      fetchAnnouncements(userId, userRole).then((data) => {
        if (active) setAnnouncements(data);
      });
    const loadNotif = () =>
      fetchNotifications().then((data) => {
        if (active) setNotifications(data);
      });

    loadAnn();
    loadNotif();

    // Live sync: refresh on a light poll and whenever the app returns to the
    // foreground so mobile mirrors web / the shared DB promptly.
    const interval = setInterval(() => {
      loadAnn();
      loadNotif();
    }, POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadAnn();
        loadNotif();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [userId, reloadTick]);

  const markAnnouncementRead = useCallback(
    (id: string) => {
      const next = new Set(readAnnouncementIds);
      next.add(id);
      setReadAnnouncementIds(next);
      addToStringSet(STORAGE_KEYS.readAnnouncements(userId), id);
    },
    [readAnnouncementIds, userId]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    apiMarkNotificationRead(id).catch(() => {});
  }, []);

  const markAllAnnouncementsRead = useCallback(() => {
    setReadAnnouncementIds((prev) => {
      const ids = new Set(announcements.filter((a) => !a.authorId || a.authorId !== userId).map((a) => a.id));
      (async () => {
        await setJSON(STORAGE_KEYS.readAnnouncements(userId), Array.from(ids));
      })();
      return ids;
    });
  }, [announcements, userId]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.isRead ? n : { ...n, isRead: true })));
    apiMarkAllNotificationsRead().catch(() => {});
  }, []);

  const addLocalAnnouncement = useCallback(
    (a: Omit<Announcement, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => {
      const local: Announcement = {
        ...a,
        id: a.id || `local-${Date.now()}`,
        createdAt: a.createdAt || new Date().toISOString(),
      };
      setAnnouncements((prev) => [local, ...prev]);
      getJSON<Announcement[]>(STORAGE_KEYS.localAnnouncements).then((list) => {
        const next = [local, ...(list || [])];
        setJSON(STORAGE_KEYS.localAnnouncements, next);
      });
    },
    []
  );

  const visibleAnnouncements = useMemo(
    () =>
      userRole === 'admin'
        ? []
        : announcements.filter((a) => !a.authorId || a.authorId !== userId),
    [announcements, userId, userRole]
  );

  const unreadAnnouncements = visibleAnnouncements.filter((a) => !readAnnouncementIds.has(a.id)).length;
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  // Merged bell feed, newest first — mirrors the web's merged bell so
  // announcements and DB notifications share one list.
  const bellItems = useMemo<BellItem[]>(() => {
    const fromNotifications: BellItem[] = notifications.map((n) => ({
      id: `notif-${n.id}`,
      kind: 'notification',
      title: n.title,
      content: n.message,
      createdAt: n.createdAt,
      tag: 'Notice',
      target: n.target || null,
      notificationId: n.id,
      isRead: n.isRead,
    }));
    const fromAnnouncements: BellItem[] = visibleAnnouncements.map((a) => ({
      id: `ann-${a.id}`,
      kind: 'announcement',
      title: a.title,
      content: a.content,
      createdAt: a.createdAt,
      tag: a.priority,
      priority: a.priority,
      subjectName: a.subjectName,
      authorName: a.authorName,
      announcementId: a.id,
      isRead: readAnnouncementIds.has(a.id),
    }));
    return [...fromNotifications, ...fromAnnouncements].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [notifications, visibleAnnouncements, readAnnouncementIds]);

  const unreadCount = unreadAnnouncements + unreadNotifications;

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements,
        notifications,
        bellItems,
        visibleAnnouncements,
        reloadAnnouncements: reload,
        readAnnouncementIds,
        unreadAnnouncements,
        unreadNotifications,
        unreadCount,
        markAnnouncementRead,
        markNotificationRead,
        markAllAnnouncementsRead,
        markAllNotificationsRead,
        addLocalAnnouncement,
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
    throw new Error('useAnnouncements must be used within an AnnouncementsProvider');
  }
  return context;
};
