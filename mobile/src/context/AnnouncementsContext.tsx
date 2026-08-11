import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Announcement,
  Notification,
  fetchAnnouncements,
  fetchNotifications,
  markAnnouncementRead as apiMarkAnnouncementRead,
  markAnnouncementUnread as apiMarkAnnouncementUnread,
} from '../services/api';
import { STORAGE_KEYS, getStringSet, addToStringSet, removeFromStringSet, getJSON, setJSON } from '../utils/storage';
import { useAuth } from './AuthContext';

interface AnnouncementsContextType {
  announcements: Announcement[];
  reloadAnnouncements: () => void;
  readIds: Set<string>;
  unreadAnnouncements: number;
  markAnnouncementRead: (id: string) => void;
  markAnnouncementUnread: (id: string) => void;
  markAllAnnouncementsRead: () => void;
  notifications: Notification[];
  reloadNotifications: () => void;
  readNotificationIds: Set<string>;
  unreadNotifications: number;
  markNotificationRead: (id: string) => void;
  markNotificationUnread: (id: string) => void;
  addLocalAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => void;
}

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined);

export const AnnouncementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || 'usr-student-1';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    getStringSet(STORAGE_KEYS.readNotifications(userId)).then(setReadNotificationIds);
  }, [userId]);

  useEffect(() => {
    getStringSet(STORAGE_KEYS.readAnnouncements(userId)).then(setReadIds);
  }, [userId]);

  useEffect(() => {
    let active = true;
    fetchAnnouncements(userId).then((data) => {
      if (!active) return;
      setAnnouncements(data);
      setReadIds((prev) => {
        const next = new Set(prev);
        data.forEach((a) => {
          if ((a as unknown as { isRead?: boolean }).isRead) next.add(a.id);
        });
        return next;
      });
    });
    fetchNotifications(userId).then((data) => {
      if (active) setNotifications(data);
    });
    return () => {
      active = false;
    };
  }, [userId, reloadTick]);

  const markAnnouncementRead = useCallback(
    (id: string) => {
      const next = new Set(readIds);
      next.add(id);
      setReadIds(next);
      addToStringSet(STORAGE_KEYS.readAnnouncements(userId), id);
      apiMarkAnnouncementRead(id, userId).catch(() => {});
    },
    [readIds, userId]
  );

  const markAnnouncementUnread = useCallback(
    (id: string) => {
      const next = new Set(readIds);
      next.delete(id);
      setReadIds(next);
      removeFromStringSet(STORAGE_KEYS.readAnnouncements(userId), id);
      apiMarkAnnouncementUnread(id, userId).catch(() => {});
    },
    [readIds, userId]
  );

  const markAllAnnouncementsRead = useCallback(() => {
    const all = new Set(announcements.map((a) => a.id));
    setReadIds(all);
    setJSON(STORAGE_KEYS.readAnnouncements(userId), Array.from(all));
    announcements.forEach((a) => apiMarkAnnouncementRead(a.id, userId).catch(() => {}));
  }, [announcements, userId]);

  const markNotificationRead = useCallback(
    (id: string) => {
      const next = new Set(readNotificationIds);
      next.add(id);
      setReadNotificationIds(next);
      addToStringSet(STORAGE_KEYS.readNotifications(userId), id);
    },
    [readNotificationIds, userId]
  );

  const markNotificationUnread = useCallback(
    (id: string) => {
      const next = new Set(readNotificationIds);
      next.delete(id);
      setReadNotificationIds(next);
      removeFromStringSet(STORAGE_KEYS.readNotifications(userId), id);
    },
    [readNotificationIds, userId]
  );

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

  const unreadAnnouncements = announcements.filter((a) => !readIds.has(a.id)).length;
  const unreadNotifications = notifications.filter((n) => !n.isRead && !readNotificationIds.has(n.id)).length;

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements,
        reloadAnnouncements: reload,
        readIds,
        unreadAnnouncements,
        markAnnouncementRead,
        markAnnouncementUnread,
        markAllAnnouncementsRead,
        notifications,
        reloadNotifications: reload,
        readNotificationIds,
        unreadNotifications,
        markNotificationRead,
        markNotificationUnread,
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