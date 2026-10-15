import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl, TextInput, Platform } from 'react-native';
import {
  Users,
  FileText,
  Megaphone,
  Trash2,
  Pencil,
  Activity,
  AlertTriangle,
  GraduationCap,
  ChevronRight,
  BookOpen,
  Search,
  KeyRound,
  Download,
  RotateCcw,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import {
  ActivityLog,
  Announcement,
  Subject,
  SubjectStudent,
  SystemSettings,
  User,
  UserRole,
  fetchAdminUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchLogs,
  clearLogs,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  fetchSubjectStudents,
  assignStudentsToSubject,
  removeStudentsFromSubject,
  resetUserPassword,
  fetchSystemSettings,
  saveSystemSettings,
  fetchSystemBackup,
} from '../services/api';
import { Card, Badge, LoadingView, Modal, Field, PrimaryButton, OutlineButton, SegmentedButtons, SectionHeader, EmptyState, StatCard } from '../components/ui';
import { formatRelative, formatExact } from '../utils/time';
import { saveTextFile } from '../utils/fileExport';
import { openSubject } from '../navigation/navigationRef';

type TabKey = 'overview' | 'users' | 'subjects' | 'logs' | 'announcements' | 'settings';

const ROLE_OPTIONS = [
  { key: 'student', label: 'Student' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'admin', label: 'Admin' },
];

const ALL_ROLES = [
  { key: 'all', label: 'All' },
  ...ROLE_OPTIONS,
];

const ALL_STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
];

const SEMESTER_OPTIONS = [
  { key: '1st Semester', label: '1st Sem' },
  { key: '2nd Semester', label: '2nd Sem' },
  { key: 'Summer', label: 'Summer' },
];

const COURSE_OPTIONS = [
  { key: 'BSIT', label: 'BSIT' },
  { key: 'BSCS', label: 'BSCS' },
  { key: 'BSIS', label: 'BSIS' },
  { key: 'BSCPE', label: 'BSCPE' },
];

const DEFAULT_SETTINGS: SystemSettings = {
  require2FA: false,
  maintenanceMode: false,
  sessionTimeoutMins: 60,
  autoAuditArchiving: true,
};

export default function AdminDashboardScreen({ onNavigate, initialTab }: { onNavigate?: (tab: string) => void; initialTab?: TabKey }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { announcements, reloadAnnouncements } = useAnnouncements();

  const [tab, setTab] = useState<TabKey>(initialTab || 'overview');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [detailCard, setDetailCard] = useState<'users' | 'subjects' | 'quizzes' | 'logs' | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Users filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department || '').toLowerCase().includes(q)) return false;
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
      if (userStatusFilter !== 'all' && (u.status || 'active') !== userStatusFilter) return false;
      return true;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter]);

  // Modals
  const [userModal, setUserModal] = useState<{ mode: 'create' } | { mode: 'edit'; user: User } | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [announceModal, setAnnounceModal] = useState<false | { mode: 'create' } | { mode: 'edit'; announcement: Announcement }>(false);
  const [deleteAnnTarget, setDeleteAnnTarget] = useState<Announcement | null>(null);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<User | null>(null);

  // Subjects modals
  const [subjectModal, setSubjectModal] = useState<{ mode: 'create' } | { mode: 'edit'; subject: Subject } | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<Subject | null>(null);
  const [rosterModalSubject, setRosterModalSubject] = useState<Subject | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, l, s, subs] = await Promise.all([
        fetchAdminUsers(),
        fetchLogs(),
        fetchSystemSettings(),
        fetchSubjects(),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setLogs(Array.isArray(l) ? l : []);
      setSettings(s && typeof s === 'object' ? s : null);
      setSubjectsList(Array.isArray(subs) ? subs : []);
    } catch (err) {
      setError((err as Error).message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const roleLabel = (role?: string) =>
    role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  const roleColor = (role?: string) =>
    role === 'admin' ? '#7c3aed' : role === 'teacher' ? '#2563eb' : colors.primary;

  const handleCreateUser = async (name: string, email: string, role: UserRole, department?: string) => {
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    try {
      await createUser({ name: name.trim(), email: email.trim(), role, department: department?.trim() || 'General', status: 'active' });
      await loadAll();
      setUserModal(null);
      showToast('User account created.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateUser = async (user: User, name: string, role: UserRole, department: string) => {
    try {
      await updateUser(user.id, {
        name: name.trim(),
        role,
        department: department.trim(),
        status: user.status,
      });
      await loadAll();
      setUserModal(null);
      showToast('User account updated.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await deleteUser(deleteUserTarget.id);
      await loadAll();
      setDeleteUserTarget(null);
      showToast('User account deleted.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleStatus = async (u: User) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateUser(u.id, { status: next });
      await loadAll();
      showToast(`User ${next === 'active' ? 'activated' : 'suspended'}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTarget) return;
    const tempPass = 'Pass-' + Math.floor(100000 + Math.random() * 900000);
    try {
      await resetUserPassword(resetPasswordTarget.id, tempPass);
      setResetPasswordTarget(null);
      showToast(`Temporary password for ${resetPasswordTarget.name}: ${tempPass}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateAnnouncement = async (a: { title: string; content: string; targetAudience: string; priority: string }) => {
    if (!a.title.trim()) {
      setError('Announcement title is required.');
      return;
    }
    try {
      await createAnnouncement({
        title: a.title.trim(),
        content: a.content.trim(),
        authorName: currentUser?.name || 'Administrator',
        targetAudience: a.targetAudience,
        priority: a.priority,
      });
      reloadAnnouncements();
      setAnnounceModal(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateAnnouncement = async (a: Announcement, patch: { title: string; content: string; targetAudience: string; priority: string }) => {
    if (!patch.title.trim()) {
      setError('Announcement title is required.');
      return;
    }
    try {
      await updateAnnouncement(a.id, {
        title: patch.title.trim(),
        content: patch.content.trim(),
        targetAudience: patch.targetAudience,
        priority: patch.priority,
      });
      reloadAnnouncements();
      setAnnounceModal(false);
      showToast('Announcement updated.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deleteAnnTarget) return;
    try {
      await deleteAnnouncement(deleteAnnTarget.id);
      reloadAnnouncements();
      setDeleteAnnTarget(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleClearLogs = async () => {
    try {
      await clearLogs();
      setLogs([]);
      setConfirmClearLogs(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    const timeout = settings.sessionTimeoutMins;
    if (timeout < 5 || timeout > 1440) {
      setError('Session timeout must be between 5 and 1440 minutes.');
      return;
    }
    try {
      const saved = await saveSystemSettings(settings);
      setSettings(saved);
      setError(null);
      showToast('System settings updated.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      const backup = await fetchSystemBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const ts = new Date().getTime();
      await saveTextFile(`StudyLens_System_Backup_${ts}.json`, jsonStr, 'application/json', 'System Backup');
      showToast('Full database backup downloaded.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBackupLoading(false);
    }
  };

  const setSetting = (patch: Partial<SystemSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s));

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}>
          <AlertTriangle size={15} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600', flex: 1 }}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '800' }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={colors.primary} />
      }>
        {/* Tabs */}
        <SegmentedButtons
          options={[
            { key: 'overview', label: 'Dashboard' },
            { key: 'users', label: 'Users' },
            { key: 'subjects', label: 'Subjects' },
            { key: 'logs', label: 'Logs' },
            { key: 'announcements', label: 'Bulletins' },
            { key: 'settings', label: 'Settings' },
          ]}
          value={tab}
          onChange={(k) => setTab(k as TabKey)}
        />

        {tab === 'overview' && (
          <View style={{ gap: 12, marginTop: 14 }}>
            <View style={styles.welcomeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                  Welcome back, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Admin'}!
                </Text>
                <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>
                  Here's what's happening across the platform today.
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity onPress={() => setUserModal({ mode: 'create' })} style={[styles.welcomeActionBtn, { backgroundColor: colors.primary }]}>
                  <Users size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add User</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAnnounceModal({ mode: 'create' })} style={[styles.welcomeActionBtn, { backgroundColor: colors.warning }]}>
                  <Megaphone size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Broadcast</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.grid}>
              <StatCard label="User Accounts" value={String(users.length)} icon={<Users size={18} color={colors.primary} />} onPress={() => setDetailCard('users')} />
              <StatCard label="Course Subjects" value={String(subjectsList.length)} icon={<GraduationCap size={18} color="#2563eb" />} iconBg="rgba(37,99,235,0.12)" onPress={() => setDetailCard('subjects')} />
              <StatCard label="Activity Events" value={String(logs.length)} icon={<Activity size={18} color={colors.success} />} iconBg={colors.successSoft} onPress={() => setTab('logs')} />
            </View>

            <Card style={{ gap: 10 }}>
              <View style={styles.recentHead}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>Recent Institutional Bulletins</Text>
                <TouchableOpacity onPress={() => setTab('announcements')}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>View All</Text>
                </TouchableOpacity>
              </View>
              {announcements.length === 0 ? (
                <EmptyState icon={<Megaphone size={30} color={colors.mutedForeground} />} title="No bulletins yet" subtitle="Announcements will appear here." />
              ) : (
                announcements.slice(0, 4).map((a) => (
                  <View key={a.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.rowBadges}>
                        <Badge text={a.priority} color={a.priority === 'high' ? colors.danger : colors.warning} bg={a.priority === 'high' ? colors.dangerSoft : colors.warningSoft} />
                        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{formatRelative(a.createdAt)}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{a.title}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{a.content}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{a.authorName}</Text>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card style={{ gap: 10 }}>
              <View style={styles.recentHead}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>Recent Activity</Text>
                <TouchableOpacity onPress={() => setTab('logs')}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>View All</Text>
                </TouchableOpacity>
              </View>
              {logs.length === 0 ? (
                <EmptyState icon={<Activity size={30} color={colors.mutedForeground} />} title="No activity yet" subtitle="Logs will appear here as events occur." />
              ) : (
                logs.slice(0, 5).map((l) => (
                  <TouchableOpacity key={l.id} onPress={() => setSelectedLog(l)} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.rowBadges}>
                        <Badge text={l.action} color={l.action === 'USER_LOGIN' ? colors.success : colors.primary} />
                        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{formatRelative(l.timestamp)}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{l.details}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{l.userName} · {l.userRole}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </Card>
          </View>
        )}

        {tab === 'users' && (
          <View style={{ gap: 12, marginTop: 14 }}>
            <SectionHeader title="User Management Directory" actionLabel="Add User" onAction={() => setUserModal({ mode: 'create' })} />
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search by name, email, or department..."
                placeholderTextColor={colors.mutedForeground}
                value={userSearch}
                onChangeText={setUserSearch}
              />
            </View>
            <View style={styles.filterRow}>
              <View style={{ flex: 1 }}>
                <SegmentedButtons options={ALL_ROLES} value={userRoleFilter} onChange={setUserRoleFilter} />
              </View>
            </View>
            <View style={styles.filterRow}>
              <View style={{ flex: 1 }}>
                <SegmentedButtons options={ALL_STATUSES} value={userStatusFilter} onChange={setUserStatusFilter} />
              </View>
            </View>
            {loading ? (
              <LoadingView label="Loading users..." />
            ) : filteredUsers.length === 0 ? (
              <EmptyState icon={<Users size={32} color={colors.mutedForeground} />} title="No users found" subtitle={userSearch || userRoleFilter !== 'all' || userStatusFilter !== 'all' ? "No users match the current filters." : "The directory is empty on the server."} />
            ) : (
              filteredUsers.map((u) => (
                <View key={u.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{u.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{u.email}</Text>
                    <View style={styles.rowBadges}>
                      <Badge text={roleLabel(u.role)} color={roleColor(u.role)} />
                      <TouchableOpacity onPress={() => handleToggleStatus(u)}>
                        <Badge text={u.status === 'suspended' ? 'Suspended' : 'Active'} color={u.status === 'suspended' ? colors.danger : colors.success} bg={u.status === 'suspended' ? colors.dangerSoft : colors.successSoft} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setResetPasswordTarget(u)} style={[styles.iconBtnSm, { backgroundColor: colors.surfaceAlt }]}>
                    <KeyRound size={15} color={colors.warning} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setUserModal({ mode: 'edit', user: u })} style={[styles.iconBtnSm, { backgroundColor: colors.surfaceAlt }]}>
                    <Pencil size={15} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDeleteUserTarget(u)} style={[styles.iconBtnSm, { backgroundColor: colors.dangerSoft }]}>
                    <Trash2 size={15} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'subjects' && (
          <View style={{ gap: 12, marginTop: 14 }}>
            <SectionHeader title="Subject Catalog" actionLabel="Add Subject" onAction={() => setSubjectModal({ mode: 'create' })} />
            {loading ? (
              <LoadingView label="Loading subjects..." />
            ) : subjectsList.length === 0 ? (
              <EmptyState icon={<BookOpen size={32} color={colors.mutedForeground} />} title="No subjects yet" subtitle="Create subjects to organize courses and rosters." />
            ) : (
              subjectsList.map((s) => (
                <Card key={s.id} style={{ gap: 8 }}>
                  <View style={styles.rowBadges}>
                    <Badge text={s.code} color="#2563eb" bg="rgba(37,99,235,0.12)" />
                    {s.semester && <Badge text={s.semester} color={colors.mutedForeground} bg={colors.surfaceAlt} />}
                    {s.course && <Badge text={s.course} color={colors.mutedForeground} bg={colors.surfaceAlt} />}
                    {s.schoolYear && <Badge text={s.schoolYear} color={colors.mutedForeground} bg={colors.surfaceAlt} />}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '700' }}>{s.name}</Text>
                  {s.description ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={2}>{s.description}</Text> : null}
                  <View style={styles.subjectMeta}>
                    {s.teacherName ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Teacher: {s.teacherName}</Text> : null}
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.studentCount} students · {s.materialCount} materials</Text>
                  </View>
                  <View style={styles.subjectActions}>
                    <TouchableOpacity onPress={() => setSubjectModal({ mode: 'edit', subject: s })} style={[styles.iconBtnSm, { backgroundColor: colors.surfaceAlt }]}>
                      <Pencil size={15} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setRosterModalSubject(s)} style={[styles.subjectRosterBtn, { backgroundColor: colors.indigoSoft }]}>
                      <Users size={13} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Roster</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDeleteSubjectTarget(s)} style={[styles.iconBtnSm, { backgroundColor: colors.dangerSoft }]}>
                      <Trash2 size={15} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {tab === 'logs' && (
          <View style={{ gap: 12, marginTop: 14 }}>
            <SectionHeader title="Activity Logs" actionLabel="Clear" onAction={() => setConfirmClearLogs(true)} />
            {loading ? (
              <LoadingView label="Loading logs..." />
            ) : logs.length === 0 ? (
              <EmptyState icon={<Activity size={32} color={colors.mutedForeground} />} title="No activity logs" />
            ) : (
              logs.map((l) => (
                <TouchableOpacity key={l.id} onPress={() => setSelectedLog(l)} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.rowBadges}>
                      <Badge text={l.action} color={l.action === 'USER_LOGIN' ? colors.success : colors.primary} />
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{formatExact(l.timestamp)}</Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{l.details}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{l.userName} · {l.userRole}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {tab === 'announcements' && (
          <View style={{ gap: 12, marginTop: 14 }}>
            <SectionHeader title="Announcements & Bulletins" actionLabel="Compose" onAction={() => setAnnounceModal({ mode: 'create' })} />
            {announcements.length === 0 ? (
              <EmptyState icon={<Megaphone size={32} color={colors.mutedForeground} />} title="No announcements yet" />
            ) : (
              announcements.map((a) => (
                <View key={a.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{a.title}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={2}>{a.content}</Text>
                    <View style={styles.rowBadges}>
                      <Badge text={a.targetAudience} color={colors.primary} />
                      <Badge text={a.priority} color={colors.warning} bg={colors.warningSoft} />
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{a.authorName}</Text>
                    </View>
                  </View>
                  {a.authorId === currentUser?.id && (
                    <>
                      <TouchableOpacity onPress={() => setAnnounceModal({ mode: 'edit', announcement: a })} style={[styles.iconBtnSm, { backgroundColor: colors.surfaceAlt }]}>
                        <Pencil size={15} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setDeleteAnnTarget(a)} style={[styles.iconBtnSm, { backgroundColor: colors.dangerSoft }]}>
                        <Trash2 size={15} color={colors.danger} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))
            )}
          </View>
        )}

{tab === 'settings' && (
          <View style={{ gap: 12, marginTop: 14 }}>
            <SectionHeader title="System Settings" />
            <Card style={{ gap: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                These settings are stored in the database and apply across the whole platform.
              </Text>

              <Field label="Session Timeout (minutes)" value={String(settings?.sessionTimeoutMins ?? '')} onChangeText={(v) => setSetting({ sessionTimeoutMins: Number(v) || 0 })} placeholder="60" keyboardType="numeric" />

              <ToggleRow
                label="Require Multi-Factor Authentication (2FA)"
                caption="Require a one-time 6-digit code after password login for faculty and administrators"
                value={!!settings?.require2FA}
                onValueChange={(v) => setSetting({ require2FA: v })}
                colors={colors}
              />
              <ToggleRow
                label="System Maintenance Mode"
                caption="Restrict all non-admin access while the platform is being updated"
                value={!!settings?.maintenanceMode}
                onValueChange={(v) => setSetting({ maintenanceMode: v })}
                colors={colors}
              />
              <ToggleRow
                label="Auto Audit Log Archiving"
                caption="Automatically archive activity logs after 90 days"
                value={!!settings?.autoAuditArchiving}
                onValueChange={(v) => setSetting({ autoAuditArchiving: v })}
                colors={colors}
              />

              <PrimaryButton label="Save Settings" onPress={handleSaveSettings} />
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>Backup & Maintenance</Text>
              <TouchableOpacity onPress={handleDownloadBackup} disabled={backupLoading} style={[styles.settingsAction, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Download size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{backupLoading ? 'Creating Backup...' : 'Download System Backup'}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Fetch the latest system backup data</Text>
                </View>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSettings(DEFAULT_SETTINGS)} style={[styles.settingsAction, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <RotateCcw size={18} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Reset to Defaults</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Restore default settings (unsaved until you click Save)</Text>
                </View>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* User create/edit modal */}
      {userModal && <UserFormModal
        mode={userModal.mode}
        user={userModal.mode === 'edit' ? userModal.user : undefined}
        onClose={() => setUserModal(null)}
        onSave={(name, email, role, dept) => {
          if (userModal.mode === 'edit') {
            handleUpdateUser(userModal.user, name, role, dept);
          } else {
            handleCreateUser(name, email, role, dept);
          }
        }}
        colors={colors}
      />}

      {/* Delete user confirm */}
      <Modal visible={!!deleteUserTarget} onClose={() => setDeleteUserTarget(null)} title="Delete user account?" subtitle={deleteUserTarget?.name}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          This removes the account from the platform directory. This action cannot be undone.
        </Text>
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={() => setDeleteUserTarget(null)} />
          <PrimaryButton label="Delete User" onPress={handleDeleteUser} color={colors.danger} />
        </View>
      </Modal>

      {/* Reset password confirm */}
      <Modal visible={!!resetPasswordTarget} onClose={() => setResetPasswordTarget(null)} title="Reset password?" subtitle={resetPasswordTarget?.name}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          A temporary password will be generated and shown to you. Share it securely with the user.
        </Text>
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={() => setResetPasswordTarget(null)} />
          <PrimaryButton label="Reset Password" onPress={handleResetPassword} color={colors.warning} />
        </View>
      </Modal>

      {/* Announcement compose/edit */}
      {announceModal && (
        <AnnouncementModal
          visible={true}
          onClose={() => setAnnounceModal(false)}
          mode={announceModal.mode}
          announcement={announceModal.mode === 'edit' ? announceModal.announcement : undefined}
          onSave={announceModal.mode === 'create' ? handleCreateAnnouncement : (patch) => {
            if (announceModal.mode === 'edit') handleUpdateAnnouncement(announceModal.announcement, patch);
          }}
          colors={colors}
        />
      )}

      {/* Delete announcement confirm */}
      <Modal visible={!!deleteAnnTarget} onClose={() => setDeleteAnnTarget(null)} title="Delete announcement?" subtitle={deleteAnnTarget?.title}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>This bulletin will be removed for all users.</Text>
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={() => setDeleteAnnTarget(null)} />
          <PrimaryButton label="Delete" onPress={handleDeleteAnnouncement} color={colors.danger} />
        </View>
      </Modal>

      {/* Subject create/edit */}
      {subjectModal && (
        <SubjectFormModal
          mode={subjectModal.mode}
          subject={subjectModal.mode === 'edit' ? subjectModal.subject : undefined}
          teachers={users.filter((u) => u.role === 'teacher')}
          onClose={() => setSubjectModal(null)}
          onSave={async (payload) => {
            try {
              if (subjectModal.mode === 'edit') {
                await updateSubject(subjectModal.subject.id, payload);
                showToast('Subject updated.');
              } else {
                await createSubject(payload);
                showToast('Subject created.');
              }
              setSubjectModal(null);
              await loadAll();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
          colors={colors}
        />
      )}

      {/* Delete subject confirm */}
      <Modal visible={!!deleteSubjectTarget} onClose={() => setDeleteSubjectTarget(null)} title="Delete subject?" subtitle={deleteSubjectTarget ? `${deleteSubjectTarget.code} — ${deleteSubjectTarget.name}` : undefined}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          This will remove the subject and its roster data. This action cannot be undone.
        </Text>
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={() => setDeleteSubjectTarget(null)} />
          <PrimaryButton label="Delete Subject" onPress={async () => {
            if (!deleteSubjectTarget) return;
            try {
              await deleteSubject(deleteSubjectTarget.id);
              await loadAll();
              setDeleteSubjectTarget(null);
              showToast('Subject deleted.');
            } catch (err) {
              setError((err as Error).message);
            }
          }} color={colors.danger} />
        </View>
      </Modal>

      {/* Class Roster */}
      {rosterModalSubject && (
        <ClassRosterModal
          subject={rosterModalSubject}
          students={users.filter((u) => u.role === 'student')}
          onClose={() => setRosterModalSubject(null)}
          colors={colors}
          onRefresh={loadAll}
        />
      )}

      {/* Clear logs confirm */}
      <Modal visible={confirmClearLogs} onClose={() => setConfirmClearLogs(false)} title="Clear activity logs?" subtitle="All audit records will be erased">
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={() => setConfirmClearLogs(false)} />
          <PrimaryButton label="Clear Logs" onPress={handleClearLogs} color={colors.danger} />
        </View>
      </Modal>

      {/* User Accounts drill-down */}
      <Modal visible={detailCard === 'users'} onClose={() => setDetailCard(null)} title="User Accounts" subtitle={`${users.length} registered account${users.length === 1 ? '' : 's'} in the system.`}>
        <View style={{ gap: 8 }}>
          {(['student', 'teacher', 'admin'] as UserRole[]).map((role) => {
            const count = users.filter((u) => u.role === role).length;
            const label = role === 'student' ? 'Students' : role === 'teacher' ? 'Teachers' : 'Administrators';
            return (
              <TouchableOpacity
                key={role}
                onPress={() => { setDetailCard(null); setUserRoleFilter(role); setUserStatusFilter('all'); setTab('users'); }}
                style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{label}</Text>
                </View>
                <Badge text={String(count)} color={colors.danger} bg={colors.dangerSoft} />
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => { setDetailCard(null); setUserRoleFilter('all'); setUserStatusFilter('suspended'); setTab('users'); }}
            style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Suspended Accounts</Text>
            </View>
            <Badge text={String(users.filter((u) => u.status === 'suspended').length)} color={colors.foreground} bg="rgba(148,163,184,0.15)" />
            <ChevronRight size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Course Subjects drill-down */}
      <Modal visible={detailCard === 'subjects'} onClose={() => setDetailCard(null)} title="Course Subjects" subtitle={`${subjectsList.length} course subject${subjectsList.length === 1 ? '' : 's'} in the catalog.`}>
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 8 }}>
          {subjectsList.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
              No course subjects in the catalog yet.
            </Text>
          ) : (
            subjectsList.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => { setDetailCard(null); openSubject(s); }}
                style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{s.code} — {s.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>
                    {s.teacherName || [s.semester, s.course].filter(Boolean).join(' • ') || 'Unassigned'}
                  </Text>
                  <View style={styles.rowBadges}>
                    <Badge text={`${s.studentCount ?? 0} students`} color="#2563eb" bg="rgba(37,99,235,0.12)" />
                    <Badge text={`${s.materialCount ?? 0} materials`} color={colors.mutedForeground} bg="rgba(148,163,184,0.15)" />
                  </View>
                </View>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Modal>

      {/* Audit Event Inspector */}
      <Modal visible={!!selectedLog} onClose={() => setSelectedLog(null)} title="Audit Event Inspector" subtitle={selectedLog ? selectedLog.action : undefined}>
        {selectedLog && (
          <View style={{ gap: 10 }}>
            <View style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Event Action</Text>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{selectedLog.action}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'monospace' }}>ID: {selectedLog.id}</Text>
              </View>
            </View>
            <View style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Triggered By</Text>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{selectedLog.userName}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Role: {selectedLog.userRole}</Text>
              </View>
            </View>
            <View style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Origin & Timestamp</Text>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', fontFamily: 'monospace' }}>
                  IP: {selectedLog.ipAddress || '127.0.0.1'}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'monospace' }}>
                  {formatExact(selectedLog.timestamp)}
                </Text>
              </View>
            </View>
            <View style={[styles.detailRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Event Description</Text>
                <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{selectedLog.details}</Text>
              </View>
            </View>
            <View style={styles.modalActions}>
              <PrimaryButton label="Close" onPress={() => setSelectedLog(null)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

function UserFormModal({ mode, user, onClose, onSave, colors }: {
  mode: 'create' | 'edit';
  user?: User;
  onClose: () => void;
  onSave: (name: string, email: string, role: UserRole, dept: string) => void;
  colors: any;
}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) || 'student');
  const [dept, setDept] = useState(user?.department || 'General');

  return (
    <Modal visible onClose={onClose} title={mode === 'create' ? 'Add User Account' : 'Edit User Account'} subtitle={mode === 'create' ? 'Create a new directory account' : user?.name}>
      <View style={{ gap: 12 }}>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Juan Dela Cruz" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="user@studylens.edu" keyboardType="email-address" />
        {mode === 'create' && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Role</Text>
            <SegmentedButtons options={ROLE_OPTIONS} value={role} onChange={(k) => setRole(k as UserRole)} />
          </View>
        )}
        <Field label="Department" value={dept} onChangeText={setDept} placeholder="College / Department" />
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={onClose} />
          <PrimaryButton label={mode === 'create' ? 'Create Account' : 'Save Changes'} onPress={() => onSave(name, email, role, dept)} />
        </View>
      </View>
    </Modal>
  );
}

function AnnouncementModal({ visible, onClose, mode, announcement, onSave, colors }: {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  announcement?: Announcement;
  onSave: (a: { title: string; content: string; targetAudience: string; priority: string }) => void;
  colors: any;
}) {
  const [title, setTitle] = useState(announcement?.title || '');
  const [content, setContent] = useState(announcement?.content || '');
  const [audience, setAudience] = useState(announcement?.targetAudience || 'all');
  const [priority, setPriority] = useState(announcement?.priority || 'medium');

  return (
    <Modal visible={visible} onClose={onClose} title={mode === 'create' ? 'Compose Announcement' : 'Edit Announcement'} subtitle={mode === 'create' ? 'Broadcast to students and teachers' : announcement?.title}>
      <View style={{ gap: 12 }}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Midterm Exam Rescheduled" />
        <Field label="Message" value={content} onChangeText={setContent} placeholder="Details of the announcement..." multiline />
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Audience</Text>
          <SegmentedButtons options={[{ key: 'all', label: 'All' }, { key: 'students', label: 'Students' }, { key: 'teachers', label: 'Teachers' }]} value={audience} onChange={setAudience} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Priority</Text>
          <SegmentedButtons options={[{ key: 'high', label: 'High' }, { key: 'medium', label: 'Medium' }, { key: 'low', label: 'Low' }]} value={priority} onChange={setPriority} />
        </View>
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={onClose} />
          <PrimaryButton label={mode === 'create' ? 'Publish' : 'Save Changes'} onPress={() => onSave({ title, content, targetAudience: audience, priority })} />
        </View>
      </View>
    </Modal>
  );
}

function SubjectFormModal({ mode, subject, teachers, onClose, onSave, colors }: {
  mode: 'create' | 'edit';
  subject?: Subject;
  teachers: User[];
  onClose: () => void;
  onSave: (payload: { code: string; name: string; description?: string; teacherId?: string; semester?: string; course?: string; schoolYear?: string }) => void;
  colors: any;
}) {
  const [code, setCode] = useState(subject?.code || '');
  const [name, setName] = useState(subject?.name || '');
  const [description, setDescription] = useState(subject?.description || '');
  const [teacherId, setTeacherId] = useState(subject?.teacherId || '');
  const [semester, setSemester] = useState(subject?.semester || '1st Semester');
  const [course, setCourse] = useState(subject?.course || 'BSIT');
  const [schoolYear, setSchoolYear] = useState(subject?.schoolYear || '2026-2027');

  const selectedTeacher = teachers.find((t) => t.id === teacherId);

  return (
    <Modal visible onClose={onClose} title={mode === 'create' ? 'Add Subject' : 'Edit Subject'} subtitle={mode === 'create' ? 'Create a new subject entry' : subject?.name}>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
        <Field label="Code" value={code} onChangeText={setCode} placeholder="e.g. CS 301" />
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Data Structures" />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional course description" multiline />
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Assigned Teacher</Text>
          {teachers.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No teachers available.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 6 }}>
              {teachers.map((t) => {
                const active = t.id === teacherId;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setTeacherId(active ? '' : t.id)}
                    style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.border }]}
                  >
                    <Text style={{ color: active ? '#fff' : colors.foreground, fontSize: 11, fontWeight: '700' }}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {selectedTeacher && <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Selected: {selectedTeacher.name}</Text>}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Semester</Text>
          <SegmentedButtons options={SEMESTER_OPTIONS} value={semester} onChange={setSemester} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Course Program</Text>
          <SegmentedButtons options={COURSE_OPTIONS} value={course} onChange={setCourse} />
        </View>
        <Field label="School Year" value={schoolYear} onChangeText={setSchoolYear} placeholder="2026-2027" />
        <View style={styles.modalActions}>
          <OutlineButton label="Cancel" onPress={onClose} />
          <PrimaryButton label={mode === 'create' ? 'Create Subject' : 'Save Changes'} onPress={() => {
            if (!code.trim() || !name.trim()) return;
            onSave({ code: code.trim(), name: name.trim(), description: description.trim() || undefined, teacherId: teacherId || undefined, semester, course, schoolYear });
          }} />
        </View>
      </ScrollView>
    </Modal>
  );
}

function ClassRosterModal({ subject, students, onClose, colors, onRefresh }: {
  subject: Subject;
  students: User[];
  onClose: () => void;
  colors: any;
  onRefresh: () => void;
}) {
  const { showToast } = useToast();
  const [roster, setRoster] = useState<SubjectStudent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingRoster, setLoadingRoster] = useState(true);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const data = await fetchSubjectStudents(subject.id);
      setRoster(data);
    } catch {
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [subject.id]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const enrolledIds = useMemo(() => new Set(roster.map((s) => s.id)), [roster]);

  const availableStudents = useMemo(
    () => students.filter((s) => !enrolledIds.has(s.id)),
    [students, enrolledIds]
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    try {
      await assignStudentsToSubject(subject.id, Array.from(selected));
      setSelected(new Set());
      await loadRoster();
      await onRefresh();
      showToast(`${selected.size} student(s) enrolled.`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleRemove = async (studentId: string) => {
    try {
      await removeStudentsFromSubject(subject.id, [studentId]);
      await loadRoster();
      await onRefresh();
      showToast('Student removed.');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  return (
    <Modal visible onClose={onClose} title={`${subject.code} Roster`} subtitle={`${subject.name} · ${roster.length} enrolled`}>
      <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Assign Students</Text>
          {availableStudents.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>All students are already enrolled.</Text>
          ) : (
            availableStudents.map((s) => {
              const sel = selected.has(s.id);
              return (
                <TouchableOpacity key={s.id} onPress={() => toggleSelect(s.id)} style={[styles.detailRow, { borderColor: colors.border, backgroundColor: sel ? colors.indigoSoft : 'transparent' }]}>
                  <View style={[styles.checkCircle, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent' }]}>
                    {sel && <Check size={12} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{s.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{s.email}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          {selected.size > 0 && (
            <PrimaryButton label={`Assign Selected (${selected.size})`} onPress={handleAssign} />
          )}
        </View>
        {roster.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Enrolled ({roster.length})</Text>
            {loadingRoster ? (
              <LoadingView label="Loading roster..." />
            ) : (
              roster.map((s) => (
                <View key={s.id} style={[styles.detailRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{s.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{s.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(s.id)} style={[styles.iconBtnSm, { backgroundColor: colors.dangerSoft }]}>
                    <Trash2 size={13} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </Modal>
  );
}

function ToggleRow({ label, caption, value, onValueChange, colors }: {
  label: string;
  caption: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
}) {
  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, padding: 12 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{caption}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onValueChange(!value)}
        style={[
          { minWidth: 44, minHeight: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
          { backgroundColor: value ? colors.primary : colors.border },
        ]}
      >
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{value ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 32, gap: 4 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  welcomeSub: { fontSize: 13, marginTop: 4 },
  welcomeActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  iconBtnSm: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginTop: 8, borderRadius: 12, padding: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  detailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 8 },
  subjectMeta: { flexDirection: 'row', gap: 12 },
  subjectActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  subjectRosterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  settingsAction: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
