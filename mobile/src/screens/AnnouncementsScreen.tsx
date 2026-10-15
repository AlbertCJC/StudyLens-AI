import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Megaphone, Plus, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { createAnnouncement, updateAnnouncement, deleteAnnouncement, Announcement } from '../services/api';
import { formatRelative, formatExact } from '../utils/time';
import { Card, Badge, Modal, Field, LoadingView, EmptyState, SectionHeader, PrimaryButton, OutlineButton, SegmentedButtons } from '../components/ui';

interface ComposeDraft {
  mode: 'create' | 'edit';
  id?: string;
  title: string;
  content: string;
  audience: string;
  priority: string;
  subjectId?: string;
  subjectName?: string;
}

export default function AnnouncementsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { announcements, visibleAnnouncements, reloadAnnouncements, markAnnouncementRead, readAnnouncementIds } = useAnnouncements();

  const [detail, setDetail] = useState<Announcement | null>(null);
  const [compose, setCompose] = useState<ComposeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const isStaff = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const userId = currentUser?.id;

  const canManage = (a: Announcement) => !!userId && userId === a.authorId;

  const handleComposeSave = async () => {
    if (!compose) return;
    if (!compose.title.trim()) {
      showToast('Announcement title is required.', 'error');
      return;
    }
    if (!compose.content.trim()) {
      showToast('Announcement message is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (compose.mode === 'edit' && compose.id) {
        await updateAnnouncement(compose.id, {
          title: compose.title.trim(),
          content: compose.content.trim(),
          targetAudience: compose.audience,
          priority: compose.priority,
          subjectId: compose.subjectId,
          subjectName: compose.subjectName,
        });
        showToast('Announcement updated.');
      } else {
        await createAnnouncement({
          title: compose.title.trim(),
          content: compose.content.trim(),
          authorName: currentUser?.name || 'Administrator',
          targetAudience: compose.audience,
          priority: compose.priority,
          subjectId: compose.subjectId,
          subjectName: compose.subjectName,
        });
        showToast('Announcement published.');
      }
      reloadAnnouncements();
      setCompose(null);
    } catch (err) {
      showToast((err as Error).message || 'Could not save the announcement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: Announcement) => {
    try {
      await deleteAnnouncement(a.id);
      showToast('Announcement deleted.');
      reloadAnnouncements();
      if (detail?.id === a.id) setDetail(null);
    } catch (err) {
      showToast((err as Error).message || 'Could not delete the announcement.', 'error');
    }
  };

  const sorted = [...announcements].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Announcements feed: only official bulletin posts (DB notifications live on
  // the separate Notifications screen reached from the bell).
  const mergedFeed = visibleAnnouncements
    .map((a) => ({
      kind: 'announcement' as const,
      id: a.id,
      title: a.title,
      content: a.content,
      createdAt: a.createdAt,
      isUnread: !readAnnouncementIds.has(a.id),
      authorName: a.authorName,
      priority: a.priority,
      targetAudience: a.targetAudience,
      sourceId: a.id,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const unreadCount = visibleAnnouncements.filter((a) => !readAnnouncementIds.has(a.id)).length;

  if (loading) return <LoadingView label="Loading announcements..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <Megaphone size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Announcements</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{unreadCount} unread</Text>
        </View>
        {isStaff && (
          <TouchableOpacity
            onPress={() => setCompose({ mode: 'create', title: '', content: '', audience: 'all', priority: 'medium' })}
            style={[styles.composeBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Post</Text>
          </TouchableOpacity>
        )}
      </View>

      {mergedFeed.length === 0 ? (
        <EmptyState icon={<Megaphone size={36} color={colors.mutedForeground} />} title="No announcements" subtitle="Official announcements and bulletins will appear here." />
      ) : (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Announcements" subtitle={`${mergedFeed.length} post(s)`} actionLabel="Refresh" onAction={reloadAnnouncements} />
          {mergedFeed.map((item) => {
            const unread = item.isUnread;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  markAnnouncementRead(item.sourceId);
                  const ann = announcements.find((a) => a.id === item.sourceId);
                  if (ann) setDetail(ann);
                }}
                activeOpacity={0.85}
                style={[styles.itemCard, { backgroundColor: unread ? colors.surfaceAlt : colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.itemIcon, { backgroundColor: item.priority === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)' }]}>
                  <Megaphone size={16} color={item.priority === 'high' ? colors.danger : '#2563eb'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.annTop}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Badge text={item.priority} color={item.priority === 'high' ? colors.danger : colors.warning} bg={colors.card} />
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={2}>
                    {item.content}
                  </Text>
                  <View style={styles.annMeta}>
                    <Badge text={item.targetAudience} color={colors.primary} bg={colors.indigoSoft} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>
                      {item.authorName} · {formatRelative(item.createdAt)}
                    </Text>
                  </View>
                </View>
                {unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Modal
        visible={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        subtitle={detail ? `Announcement · ${formatExact(detail.createdAt)}` : ''}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 21 }}>{detail?.content}</Text>
        {detail && (
          <View style={styles.modalMeta}>
            <View style={styles.modalBadges}>
              <Badge text={detail.priority} color={detail.priority === 'high' ? colors.danger : colors.warning} bg={colors.warningSoft} />
              <Badge text={`Audience: ${detail.targetAudience}`} color={colors.primary} bg={colors.indigoSoft} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>Posted by {detail.authorName}</Text>
          </View>
        )}
        {(detail && canManage(detail)) && (
          <View style={styles.modalActions}>
            <OutlineButton
              label="Edit"
              onPress={() => {
                if (!detail) return;
                setCompose({
                  mode: 'edit',
                  id: detail.id,
                  title: detail.title,
                  content: detail.content,
                  audience: detail.targetAudience,
                  priority: detail.priority,
                  subjectId: detail.subjectId,
                  subjectName: detail.subjectName,
                });
                setDetail(null);
              }}
              style={{ flex: 1 }}
            />
            <OutlineButton label="Delete" color={colors.danger} onPress={() => detail && handleDelete(detail)} style={{ flex: 1 }} />
            <PrimaryButton label="Close" onPress={() => setDetail(null)} style={{ flex: 1 }} />
          </View>
        )}
        {(!detail || !canManage(detail)) && (
          <View style={styles.modalActions}>
            <PrimaryButton label="Close" onPress={() => setDetail(null)} style={{ flex: 1 }} />
          </View>
        )}
      </Modal>

      <Modal
        visible={!!compose}
        onClose={() => setCompose(null)}
        title={compose?.mode === 'edit' ? 'Edit Announcement' : 'Compose Announcement'}
        subtitle="Share a bulletin with your audience"
      >
        <View style={{ gap: 12 }}>
          <Field label="Title" value={compose?.title || ''} onChangeText={(v) => setCompose((c) => (c ? { ...c, title: v } : c))} placeholder="Announcement title" />
          <Field label="Message" value={compose?.content || ''} onChangeText={(v) => setCompose((c) => (c ? { ...c, content: v } : c))} placeholder="Write your announcement..." multiline />
          <View>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Audience</Text>
            <SegmentedButtons
              options={[
                { key: 'all', label: 'All' },
                { key: 'students', label: 'Students' },
                { key: 'teachers', label: 'Teachers' },
              ]}
              value={compose?.audience || 'all'}
              onChange={(k) => setCompose((c) => (c ? { ...c, audience: k } : c))}
            />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Priority</Text>
            <SegmentedButtons
              options={[
                { key: 'high', label: 'High' },
                { key: 'medium', label: 'Medium' },
                { key: 'low', label: 'Low' },
              ]}
              value={compose?.priority || 'medium'}
              onChange={(k) => setCompose((c) => (c ? { ...c, priority: k } : c))}
            />
          </View>
          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setCompose(null)} style={{ flex: 1 }} />
            <PrimaryButton label={compose?.mode === 'edit' ? 'Save Changes' : 'Publish'} onPress={handleComposeSave} loading={saving} disabled={saving} style={{ flex: 1 }} />
          </View>
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
  composeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  itemCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  annTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  annMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  modalMeta: { marginTop: 14 },
  modalBadges: { flexDirection: 'row', gap: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
