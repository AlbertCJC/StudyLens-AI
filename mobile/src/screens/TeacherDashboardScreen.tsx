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
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { fetchSubjects, fetchMaterials, fetchQuizzes } from '../services/api';
import { Card, Badge, SectionHeader, LoadingView } from '../components/ui';

export default function TeacherDashboardScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { announcements } = useAnnouncements();

  const [subjects, setSubjects] = useState(0);
  const [materials, setMaterials] = useState(0);
  const [quizzes, setQuizzes] = useState(0);
  const [students, setStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSubjects(), fetchMaterials(), fetchQuizzes()]).then(([subs, mats, quiz]) => {
      setSubjects(subs.length);
      setMaterials(mats.length);
      setQuizzes(quiz.length);
      setStudents(subs.reduce((sum, s) => sum + (s.studentCount || 0), 0));
      setLoading(false);
    });
  }, []);

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Professor';

  const metrics = [
    { label: 'Subjects Managed', value: String(subjects || 3), delta: 'all active', icon: <FolderKanban size={20} color={colors.primary} />, bg: colors.indigoSoft },
    { label: 'Learning Materials', value: String(materials || 12), delta: 'in library', icon: <BookOpen size={20} color={colors.success} />, bg: colors.successSoft },
    { label: 'Active Students', value: String(students || 151), delta: 'enrolled', icon: <Users size={20} color={colors.warning} />, bg: colors.warningSoft },
    { label: 'AI Assessments', value: String(quizzes || 8), delta: 'generated', icon: <CheckSquare size={20} color={colors.danger} />, bg: colors.dangerSoft },
  ];

  const recentActivities = [
    { action: 'Uploaded Module 4: Relational Algebra & Normalization', tag: 'DB 204', time: '2 hours ago' },
    { action: 'Generated Bloom\'s Taxonomy quiz for Graph Traversal', tag: 'CS 301', time: '5 hours ago' },
    { action: 'Synthesized "Data Structures Reviewer" via Groq AI', tag: 'AI 402', time: 'Yesterday' },
    { action: 'Published new announcement for all students', tag: 'All', time: '2 days ago' },
  ];

  const quickActions = [
    { label: 'Upload Material', icon: <UploadCloud size={16} color="#fff" />, tab: 'materials', bg: colors.primary },
    { label: 'Create Quiz with AI', icon: <Sparkles size={16} color="#fff" />, tab: 'ai-assistant', bg: '#d97706' },
    { label: 'Manage Subjects', icon: <FolderKanban size={16} color="#fff" />, tab: 'subjects', bg: colors.success },
    { label: 'View Notifications', icon: <Bell size={16} color="#fff" />, tab: 'notifications', bg: '#2563eb' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Welcome back, Prof. {firstName}!</Text>
          <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>Here's an overview of your classes and AI-generated resources.</Text>
        </View>
        <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.aiPill, { backgroundColor: colors.successSoft }]}>
          <Cpu size={14} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>Groq AI</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingView label="Loading teacher overview..." />
      ) : (
        <>
          <View style={styles.metricsGrid}>
            {metrics.map((m, idx) => (
              <View key={idx} style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                  <Text style={[styles.metricValue, { color: colors.foreground }]}>{m.value}</Text>
                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: '600' }}>{m.delta}</Text>
                </View>
                <View style={[styles.metricIcon, { backgroundColor: m.bg }]}>{m.icon}</View>
              </View>
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
              {recentActivities.map((a, idx) => (
                <View key={idx} style={[styles.activityRow, idx < recentActivities.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={[styles.activityIcon, { backgroundColor: colors.indigoSoft }]}>
                    <Activity size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.activityTitle, { color: colors.foreground }]}>{a.action}</Text>
                    <View style={styles.activityMetaRow}>
                      <Badge text={a.tag} color={colors.primary} />
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.time}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
            <SectionHeader title="Announcements to Students" subtitle={`${announcements.length} published post(s)`} actionLabel="Open Notifications" onAction={() => onNavigate('notifications')} />
            {announcements.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No announcements yet. Use the notifications screen to review posts.</Text>
            ) : (
              announcements.slice(0, 3).map((a) => (
                <TouchableOpacity key={a.id} onPress={() => onNavigate('notifications')} style={[styles.annRow, { borderColor: colors.border }]}>
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
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
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
});