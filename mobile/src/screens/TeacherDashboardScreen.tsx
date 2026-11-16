import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  FolderKanban,
  BookOpen,
  CheckSquare,
  Users,
  Layers,
  Sparkles,
  UploadCloud,
  Bell,
  Cpu,
  ArrowRight,
  Megaphone,
  Activity,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { fetchSubjects, fetchMaterials, fetchQuizzes, Subject, Material, Quiz } from '../services/api';
import { formatRelative, isNewUser } from '../utils/time';
import { Card, Badge, SectionHeader, LoadingView, Modal } from '../components/ui';

interface ActivityEntry {
  key: string;
  action: string;
  tag: string;
  createdAt: string;
}

type DetailCard = 'courses' | 'materials' | 'students' | 'assessments' | null;

export default function TeacherDashboardScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { announcements } = useAnnouncements();

  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [quizzesList, setQuizzesList] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCard, setDetailCard] = useState<DetailCard>(null);

  useEffect(() => {
    Promise.all([fetchSubjects(), fetchMaterials(), fetchQuizzes(currentUser?.role, currentUser?.id)]).then(([subs, mats, quiz]) => {
      setSubjectsList(subs);
      setMaterialsList(mats);
      setQuizzesList(quiz);
      setLoading(false);
    });
  }, [currentUser?.role, currentUser?.id]);

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Professor';

  const enrolledStudents = subjectsList.reduce((sum, s) => sum + (s.studentCount || 0), 0);

  const metrics: { key: DetailCard; label: string; value: string; delta: string; icon: React.ReactNode; bg: string }[] = [
    { key: 'courses', label: 'Assigned Courses', value: String(subjectsList.length), delta: 'active', icon: <FolderKanban size={20} color={colors.primary} />, bg: colors.indigoSoft },
    { key: 'materials', label: 'Learning Materials', value: String(materialsList.length), delta: 'in library', icon: <BookOpen size={20} color={colors.success} />, bg: colors.successSoft },
    { key: 'students', label: 'Active Students', value: String(enrolledStudents), delta: 'enrolled', icon: <Users size={20} color={colors.warning} />, bg: colors.warningSoft },
    { key: 'assessments', label: 'Assessments Created', value: String(quizzesList.length), delta: 'total', icon: <CheckSquare size={20} color={colors.danger} />, bg: colors.dangerSoft },
  ];

  const recentActivities: ActivityEntry[] = React.useMemo(() => {
    const entries: ActivityEntry[] = [
      ...subjectsList.map((s) => ({ key: `sub-${s.id}`, action: `Added course ${s.code} — ${s.name}`, tag: s.code, createdAt: s.createdAt })),
      ...materialsList.map((m) => ({ key: `mat-${m.id}`, action: `Uploaded material "${m.title}"`, tag: m.subjectName || 'Library', createdAt: m.createdAt })),
      ...quizzesList.map((q) => ({ key: `quiz-${q.id}`, action: `Created assessment "${q.title}"`, tag: q.subjectName || 'Assessments', createdAt: q.createdAt })),
    ];
    return entries
      .filter((e) => e.createdAt && !isNaN(new Date(e.createdAt).getTime()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [subjectsList, materialsList, quizzesList]);

  const quickActions = [
    { label: 'Upload Material', icon: <UploadCloud size={16} color="#fff" />, tab: 'materials', bg: colors.primary },
    { label: 'Create Quiz with AI', icon: <Sparkles size={16} color="#fff" />, tab: 'ai-assistant', bg: '#d97706' },
    { label: 'Manage Subjects', icon: <FolderKanban size={16} color="#fff" />, tab: 'subjects', bg: colors.success },
    { label: 'View Announcements', icon: <Bell size={16} color="#fff" />, tab: 'announcements', bg: '#2563eb' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>{isNewUser(currentUser?.createdAt) ? 'Welcome' : 'Welcome back'}, Prof. {firstName}!</Text>
          <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>Here's an overview of your classes and learning resources.</Text>
        </View>
      </View>

      {loading ? (
        <LoadingView label="Loading teacher overview..." />
      ) : (
        <>
          <View style={styles.metricsGrid}>
            {metrics.map((m) => (
              <TouchableOpacity
                key={m.label}
                onPress={() => setDetailCard(m.key)}
                style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                  <Text style={[styles.metricValue, { color: colors.foreground }]}>{m.value}</Text>
                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: '600' }}>{m.delta}</Text>
                </View>
                <View style={[styles.metricIcon, { backgroundColor: m.bg }]}>{m.icon}</View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
            <SectionHeader title="Quick Actions" subtitle="Jump straight into your tools" />
            <View style={styles.quickGrid}>
              {quickActions.map((qa, idx) => (
                <TouchableOpacity key={idx} onPress={() => onNavigate(qa.tab)} style={[styles.quickBtn, { backgroundColor: qa.bg }]}>
                  {qa.icon}
                  <Text style={styles.quickText}>{qa.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>Recent Activities</Text>
              <TouchableOpacity onPress={() => onNavigate('analytics')}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 14 }}>
              {recentActivities.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  No recent activity yet. Uploaded materials, created assessments, and subject changes will appear here.
                </Text>
              ) : (
                recentActivities.map((a, idx) => (
                  <View key={a.key} style={[styles.activityRow, idx < recentActivities.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[styles.activityIcon, { backgroundColor: colors.indigoSoft }]}>
                      <Activity size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.activityTitle, { color: colors.foreground }]}>{a.action}</Text>
                      <View style={styles.activityMetaRow}>
                        <Badge text={a.tag} color={colors.primary} />
                        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{formatRelative(a.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
            <SectionHeader title="Announcements to Students" subtitle={`${announcements.length} published post(s)`} actionLabel="Open Announcements" onAction={() => onNavigate('announcements')} />
            {announcements.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No announcements yet. Use the announcements screen to review posts.</Text>
            ) : (
              announcements.slice(0, 3).map((a) => (
                <TouchableOpacity key={a.id} onPress={() => onNavigate('announcements')} style={[styles.annRow, { borderColor: colors.border }]}>
                  <View style={[styles.annIcon, { backgroundColor: a.priority === 'high' ? 'rgba(239,68,68,0.12)' : colors.indigoSoft }]}>
                    <Megaphone size={16} color={a.priority === 'high' ? colors.danger : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>
                      {a.content}
                    </Text>
                  </View>
                  <Badge text={a.priority} color={a.priority === 'high' ? colors.danger : colors.warning} bg={colors.card} />
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
            <View style={styles.aiBanner}>
              <View style={[styles.aiIcon, { backgroundColor: colors.successSoft }]}>
                <Sparkles size={18} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>Automated Resource Generator</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                  Turn uploaded PDFs into Bloom's Taxonomy quizzes, flashcards, and exam reviewers automatically.
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.launchBtn, { backgroundColor: colors.primary }]}>
              <Cpu size={15} color="#fff" />
              <Text style={styles.launchText}>Launch AI Generator</Text>
              <ArrowRight size={15} color="#fff" />
            </TouchableOpacity>
          </View>

          <Modal
            visible={detailCard === 'courses'}
            onClose={() => setDetailCard(null)}
            title="Assigned Courses"
            subtitle={`You are currently assigned to ${subjectsList.length} course subject${subjectsList.length === 1 ? '' : 's'}.`}
          >
            <View style={{ gap: 8 }}>
              {subjectsList.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No assigned subjects yet.</Text>
              ) : (
                subjectsList.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.detailRow, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDetailCard(null);
                      onNavigate('subjects');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                        {s.code} — {s.name}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Tap to open subject</Text>
                    </View>
                    <ChevronRight size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </Modal>

          <Modal
            visible={detailCard === 'materials'}
            onClose={() => setDetailCard(null)}
            title="Learning Materials"
            subtitle={`${materialsList.length} learning material${materialsList.length === 1 ? '' : 's'} in your library.`}
          >
            <View style={{ gap: 8 }}>
              {materialsList.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No materials uploaded yet.</Text>
              ) : (
                materialsList.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.detailRow, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDetailCard(null);
                      onNavigate('materials');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                        {m.title}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{m.subjectName || 'Library'}</Text>
                    </View>
                    <ChevronRight size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </Modal>

          <Modal
            visible={detailCard === 'students'}
            onClose={() => setDetailCard(null)}
            title="Active Students"
            subtitle={`${enrolledStudents} student${enrolledStudents === 1 ? '' : 's'} enrolled across your ${subjectsList.length} subject${subjectsList.length === 1 ? '' : 's'}.`}
          >
            <View style={{ gap: 8 }}>
              {subjectsList.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No assigned subjects yet.</Text>
              ) : (
                subjectsList.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.detailRow, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDetailCard(null);
                      onNavigate('subjects');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                        {s.code} — {s.name}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Tap to view roster</Text>
                    </View>
                    <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>{s.studentCount || 0} enrolled</Text>
                    <ChevronRight size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </Modal>

          <Modal
            visible={detailCard === 'assessments'}
            onClose={() => setDetailCard(null)}
            title="Assessments Created"
            subtitle={`${quizzesList.length} assessment${quizzesList.length === 1 ? '' : 's'} total.`}
          >
            <View style={{ gap: 8 }}>
              {quizzesList.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No assessments created yet.</Text>
              ) : (
                quizzesList.map((q) => (
                  <TouchableOpacity
                    key={q.id}
                    style={[styles.detailRow, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDetailCard(null);
                      onNavigate('quiz');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                        {q.title}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{q.subjectName}</Text>
                    </View>
                    <Badge text={q.isPublished ? 'Published' : 'Draft'} color={q.isPublished ? colors.success : colors.mutedForeground} bg={q.isPublished ? colors.successSoft : colors.surfaceAlt} />
                    <ChevronRight size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </Modal>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  welcomeSub: { fontSize: 13, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '48%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  metricValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 17, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12 },
  quickText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  activityRow: { flexDirection: 'row', gap: 12, paddingBottom: 12 },
  activityIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 13, fontWeight: '700' },
  activityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  annRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  annIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiBanner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13 },
  launchText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
});
