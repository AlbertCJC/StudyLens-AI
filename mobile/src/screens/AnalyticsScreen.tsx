import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { TrendingUp, Download, Award, Flame, Target, BookOpen, Sparkles, FileText } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, StatCard, SectionHeader, ProgressBar, EmptyState } from '../components/ui';
import { ThemedBarChart, ThemedLineChart } from '../components/Charts';
import { getAttempts, LocalAttempt } from '../utils/storage';

interface TopicStat {
  topic: string;
  correct: number;
  wrong: number;
  accuracy: number;
}

const DEMO_ATTEMPTS: LocalAttempt[] = [
  {
    id: 'demo-1',
    quizId: 'm-q1',
    quizTitle: 'Quick Quiz: Data Structures & Groq AI',
    subjectName: 'CS 301',
    score: 3,
    maxScore: 3,
    percentage: 100,
    passed: true,
    weakTopics: [],
    strongTopics: ['Graphs', 'AI Fundamentals'],
    completedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'demo-2',
    quizId: 'm-q1',
    quizTitle: 'Quiz: Database Normalization',
    subjectName: 'DB 204',
    score: 2,
    maxScore: 3,
    percentage: 67,
    passed: false,
    weakTopics: ['MySQL', 'Normalization'],
    strongTopics: ['Graphs'],
    completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'demo-3',
    quizId: 'm-q1',
    quizTitle: 'Study Quiz: Graph Traversal',
    subjectName: 'CS 301',
    score: 4,
    maxScore: 5,
    percentage: 80,
    passed: true,
    weakTopics: ['Complexity'],
    strongTopics: ['Graphs', 'AI Fundamentals'],
    completedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export default function AnalyticsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || 'usr-student-1';

  const [attempts, setAttempts] = useState<LocalAttempt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    getAttempts(userId).then((data) => {
      setAttempts(data.length > 0 ? data : DEMO_ATTEMPTS);
      setUsingDemo(data.length === 0);
      setLoaded(true);
    });
  }, [userId]);

  if (!loaded) return null;

  const sorted = [...attempts].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
  const avg = sorted.reduce((sum, a) => sum + a.percentage, 0) / Math.max(1, sorted.length);
  const best = sorted.reduce((max, a) => Math.max(max, a.percentage), 0);
  const passedCount = sorted.filter((a) => a.passed).length;

  const topicMap = new Map<string, TopicStat>();
  sorted.forEach((a) => {
    a.strongTopics.forEach((t) => {
      const cur = topicMap.get(t) || { topic: t, correct: 0, wrong: 0, accuracy: 0 };
      cur.correct += 1;
      topicMap.set(t, cur);
    });
    a.weakTopics.forEach((t) => {
      const cur = topicMap.get(t) || { topic: t, correct: 0, wrong: 0, accuracy: 0 };
      cur.wrong += 1;
      topicMap.set(t, cur);
    });
  });
  const topicStats = Array.from(topicMap.values()).map((t) => ({
    ...t,
    accuracy: Math.round((t.correct / Math.max(1, t.correct + t.wrong)) * 100),
  }));
  topicStats.sort((a, b) => a.accuracy - b.accuracy);

  const weakTopics = topicStats.filter((t) => t.accuracy < 70).slice(0, 3);
  const chartTopics = topicStats.slice().sort((a, b) => b.correct + b.wrong - (a.correct + a.wrong)).slice(0, 5);
  const trend = sorted.slice(-8);

  const exportReport = async () => {
    const lines = [
      'StudyLens AI - Learning Progress Report',
      '==========================================',
      `Generated: ${new Date().toLocaleString()}`,
      `Total Assessments: ${sorted.length}`,
      `Average Score: ${Math.round(avg)}%`,
      `Best Score: ${best}%`,
      `Passed: ${passedCount}/${sorted.length}`,
      '',
      'Topic Accuracy',
      '--------------',
      ...topicStats.map((t) => `${t.topic}: ${t.accuracy}%`),
      '',
      'Attempt History',
      '---------------',
      ...sorted.map((a) => `${a.completedAt.slice(0, 10)} - ${a.quizTitle}: ${a.percentage}% ${a.passed ? '(PASS)' : '(FAIL)'}`),
      '',
      'Recommendations',
      '---------------',
      ...weakTopics.map((t) => `Review ${t.topic} using materials + AI reviewer`),
    ];
    try {
      const file = new File(Paths.cache, 'StudyLens-Progress-Report.txt');
      file.write(lines.join('\n'));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/plain' });
      else Alert.alert('Report ready', file.uri);
    } catch {
      Alert.alert('Error', 'Could not export the report.');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <TrendingUp size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Adaptive Progress Analytics</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Aggregated from your locally-recorded quiz attempts (device-only).
          </Text>
        </View>
        <TouchableOpacity onPress={exportReport} style={[styles.exportBtn, { backgroundColor: colors.primary }]}>
          <Download size={15} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Report</Text>
        </TouchableOpacity>
      </View>

      {usingDemo && (
        <View style={[styles.demoNote, { backgroundColor: colors.warningSoft }]}>
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>
            Showing sample analytics. Take quizzes to build your real progress.
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard label="Average Score" value={`${Math.round(avg)}%`} delta={`${best}% best`} icon={<Award size={18} color={colors.primary} />} />
        <StatCard label="Assessments" value={String(sorted.length)} delta={`${passedCount} passed`} icon={<FileText size={18} color={colors.success} />} />
        <StatCard label="Best Score" value={`${best}%`} delta="Keep it up!" icon={<Flame size={18} color={colors.warning} />} />
        <StatCard label="Weak Topics" value={String(weakTopics.length)} delta="Review below" icon={<Target size={18} color={colors.danger} />} />
      </View>

      {topicStats.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Topic Accuracy" subtitle="Your performance by learning topic" />
          <ThemedBarChart
            data={{
              labels: chartTopics.map((t) => t.topic.slice(0, 10)),
              values: chartTopics.map((t) => t.accuracy),
            }}
            suffix="%"
          />
        </Card>
      ) : (
        <EmptyState icon={<BookOpen size={36} color={colors.mutedForeground} />} title="No topic data yet" />
      )}

      {trend.length > 0 && (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Score Progression" subtitle="Last 8 assessment scores" />
          <ThemedLineChart
            data={{
              labels: trend.map((a) => a.completedAt.slice(5, 10)),
              values: trend.map((a) => a.percentage),
            }}
            color={colors.success}
          />
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <SectionHeader title="Personalized Adaptive Recommendations" subtitle="Based on your weakest topics" />
        {weakTopics.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No weak topics detected. Keep up the excellent work!</Text>
        ) : (
          weakTopics.map((t) => (
            <View key={t.topic} style={[styles.recoCard, { borderColor: colors.border }]}>
              <View style={[styles.recoIcon, { backgroundColor: colors.dangerSoft }]}>
                <Target size={16} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{t.topic}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                  {t.accuracy}% accuracy - review materials and retake quizzes
                </Text>
                <View style={styles.recoBar}>
                  <ProgressBar value={t.accuracy} color={colors.danger} height={6} />
                </View>
              </View>
            </View>
          ))
        )}
        <View style={styles.recoActions}>
          <TouchableOpacity onPress={() => onNavigate('materials')} style={[styles.recoBtn, { backgroundColor: colors.indigoSoft }]}>
            <BookOpen size={15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Review Materials</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.recoBtn, { backgroundColor: colors.successSoft }]}>
            <Sparkles size={15} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>AI Study Tools</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate('quiz')} style={[styles.recoBtn, { backgroundColor: colors.warningSoft }]}>
            <Target size={15} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>Retake Quiz</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Recent Attempts" />
        {sorted.slice(0, 5).map((a) => (
          <View key={a.id} style={[styles.attemptRow, { borderColor: colors.border }]}>
            <View style={[styles.attemptBadge, { backgroundColor: a.passed ? colors.successSoft : colors.dangerSoft }]}>
              <Text style={{ color: a.passed ? colors.success : colors.danger, fontSize: 11, fontWeight: '900' }}>{a.percentage}%</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                {a.quizTitle}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {new Date(a.completedAt).toLocaleDateString()} - {a.subjectName}
              </Text>
            </View>
            <Badge text={a.passed ? 'PASS' : 'FAIL'} color={a.passed ? colors.success : colors.danger} bg={a.passed ? colors.successSoft : colors.dangerSoft} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  demoNote: { borderRadius: 10, padding: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  recoCard: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  recoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recoBar: { marginTop: 6 },
  recoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  attemptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingBottom: 10 },
  attemptBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
});