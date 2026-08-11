import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, CheckCheck, Mail, MailOpen, Megaphone } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { Card, Badge, Modal, LoadingView, EmptyState, SectionHeader, PrimaryButton, OutlineButton } from '../components/ui';

interface DetailItem {
  id: string;
  kind: 'ann' | 'notif';
  title: string;
  message: string;
  createdAt: string;
  priority?: string;
}

export default function NotificationsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const {
    notifications,
    reloadNotifications,
    readNotificationIds,
    unreadNotifications,
    markNotificationRead,
    markNotificationUnread,
    announcements,
    reloadAnnouncements,
    readIds,
    unreadAnnouncements,
    markAnnouncementRead,
    markAnnouncementUnread,
    markAllAnnouncementsRead,
  } = useAnnouncements();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const notifUnread = (n: { id: string; isRead?: boolean }) => !n.isRead && !readNotificationIds.has(n.id);
  const annUnread = (a: { id: string }) => !readIds.has(a.id);

  const filteredNotifs = notifications.filter((n) => (filter === 'unread' ? notifUnread(n) : true));
  const filteredAnns = announcements.filter((a) => (filter === 'unread' ? annUnread(a) : true));

  if (loading) return <LoadingView label="Loading notifications..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <Bell size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Notifications & Announcements</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{unreadNotifications + unreadAnnouncements} unread item(s)</Text>
        </View>
        <TouchableOpacity onPress={markAllAnnouncementsRead} style={[styles.markBtn, { backgroundColor: colors.indigoSoft }]}>
          <CheckCheck size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { key: 'all', label: `All (${notifications.length + announcements.length})` },
            { key: 'unread', label: `Unread (${unreadNotifications + unreadAnnouncements})` },
          ] as const
        ).map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: filter === f.key ? '#fff' : colors.foreground }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredNotifs.length === 0 && filteredAnns.length === 0 ? (
        <EmptyState icon={<Bell size={36} color={colors.mutedForeground} />} title="You're all caught up!" subtitle="No unread items in this view." />
      ) : (
        <>
          <SectionHeader title="Notifications" subtitle={`${filteredNotifs.length} item(s)`} actionLabel="Refresh" onAction={() => {
            setLoading(true);
            Promise.all([reloadAnnouncements(), reloadNotifications()]).then(() => setLoading(false));
          }} />
          <View style={{ gap: 10 }}>
            {filteredNotifs.length === 0 ? (
              <EmptyState icon={<Bell size={28} color={colors.mutedForeground} />} title="No notifications" />
            ) : (
              filteredNotifs.map((n) => {
                const unread = notifUnread(n);
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => {
                      if (unread) markNotificationRead(n.id);
                      setDetail({ id: n.id, kind: 'notif', title: n.title, message: n.message, createdAt: n.createdAt });
                    }}
                    style={[styles.itemCard, { backgroundColor: unread ? colors.surfaceAlt : colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: unread ? colors.primary : colors.indigoSoft }]}>
                      {unread ? <Mail size={16} color="#fff" /> : <MailOpen size={16} color={colors.primary} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: unread ? '800' : '600' }} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={2}>
                        {n.message}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{new Date(n.createdAt).toLocaleString()}</Text>
                    </View>
                    {unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <SectionHeader title="Announcements" subtitle={`${filteredAnns.length} item(s)`} />
          <View style={{ gap: 10 }}>
            {filteredAnns.length === 0 ? (
              <EmptyState icon={<Megaphone size={28} color={colors.mutedForeground} />} title="No announcements" />
            ) : (
              filteredAnns.map((a) => {
                const unread = annUnread(a);
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => {
                      if (unread) markAnnouncementRead(a.id);
                      setDetail({ id: a.id, kind: 'ann', title: a.title, message: a.content, createdAt: a.createdAt, priority: a.priority });
                    }}
                    style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: a.priority === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)' }]}>
                      <Megaphone size={16} color={a.priority === 'high' ? colors.danger : '#2563eb'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.annTop}>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: unread ? '800' : '600' }} numberOfLines={1}>
                          {a.title}
                        </Text>
                        <Badge text={a.priority} color={a.priority === 'high' ? colors.danger : colors.warning} bg={colors.card} />
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={2}>
                        {a.content}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        {a.authorName} - {new Date(a.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {unread && <View style={[styles.unreadDot, { backgroundColor: colors.danger }]} />}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </>
      )}

      <Card style={[styles.aiCta, { backgroundColor: colors.card }]} onPress={() => onNavigate('ai-assistant')}>
        <Megaphone size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Create Study Resources with AI</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Turn new materials into quizzes, flashcards, and reviewers.</Text>
        </View>
      </Card>

      <Modal
        visible={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        subtitle={detail ? `${detail.kind === 'ann' ? 'Announcement' : 'Notification'} - ${new Date(detail.createdAt).toLocaleString()}` : ''}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 21 }}>{detail?.message}</Text>
        {detail?.priority && (
          <View style={styles.modalMeta}>
            <Badge text={`Priority: ${detail.priority}`} color={detail.priority === 'high' ? colors.danger : colors.warning} bg={colors.warningSoft} />
          </View>
        )}
        <View style={styles.modalActions}>
          <OutlineButton
            label="Mark Unread"
            onPress={() => {
              if (detail?.kind === 'ann') markAnnouncementUnread(detail.id);
              if (detail?.kind === 'notif') markNotificationUnread(detail.id);
              setDetail(null);
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton label="Close" onPress={() => setDetail(null)} style={{ flex: 1 }} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  itemCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  annTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aiCta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalMeta: { marginTop: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});