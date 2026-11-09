import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  BookOpen,
  Award,
  TrendingUp,
  Activity,
  Clock,
  RotateCcw,
  Layers,
  ArrowRight,
  Play,
  ChevronRight,
  X,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getQuizProgresses, getAttempts, removeQuizProgress, SavedQuizProgress, LocalAttempt } from '../utils/storage';
import {
  fetchSubjects,
  fetchQuizzes,
  fetchStudentProgress,
  StudentProgress,
  EMPTY_STUDENT_PROGRESS,
  Subject,
} from '../services/api';
import { EmptyState, Modal } from '../components/ui';

export default function DashboardScreen({
  onNavigate,
  onOpenWeakTopic,
  onOpenSubject,
}: {
  onNavigate: (tab: string) => void;
  onOpenWeakTopic?: (topic: string) => void;
  onOpenSubject?: (subject: Subject) => void;
}) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();

  const [resumableQuiz, setResumableQuiz] = useState<SavedQuizProgress | null>(null);
  const [attempts, setAttempts] = useState<LocalAttempt[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [detailCard, setDetailCard] = useState<'subjects' | 'completed' | 'average' | 'weak' | null>(null);

  const userId = currentUser?.id || '';

  useEffect(() => {
    let alive = true;
    fetchStudentProgress(userId)
      .then((data) => {
        if (!alive) return;
        setProgress(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load student progress:", err);
        setError("Could not load progress data.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    let alive = true;
    Promise.all([getQuizProgresses(userId), getAttempts(userId), fetchQuizzes()])
      .then(([progs, atts, quizzes]) => {
        if (!alive) return;
        setAttempts(atts);
        const now = Date.now();
        let first: SavedQuizProgress | null = null;
        for (const p of progs) {
          const quiz = quizzes.find((q) => q.id === p.quizId);
          const used = atts.filter((a) => a.quizId === p.quizId).length;
          const allowed = quiz?.attemptsAllowed ?? 0; // 0 = unlimited
          const expired = now - new Date(p.lastUpdated || now).getTime() > 7 * 24 * 3600 * 1000;
          const valid =
            !!quiz && quiz.isPublished !== false && !expired && (allowed === 0 || used < allowed);
          if (valid) {
            if (!first) first = p;
          } else {
            removeQuizProgress(userId, p.quizId);
          }
        }
        setResumableQuiz(first);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    fetchSubjects().then(setSubjects);
  }, [userId]);

  const discardResumable = () => {
    if (!resumableQuiz) return;
    removeQuizProgress(userId, resumableQuiz.quizId);
    setResumableQuiz(null);
  };

  const studentName = currentUser?.name ? currentUser.name.split(' ')[0] : '';

  const progressData = progress ?? EMPTY_STUDENT_PROGRESS(userId);
  const avgScore = progressData.averageScore;
  const weakTopics = progressData.weakTopics;
  const masteredTopics = (progressData.masteredTopics ?? []).map((m) => m.topic);

  const metrics: { key: 'subjects' | 'completed' | 'average' | 'weak'; label: string; value: string; icon: React.ReactNode; bg: string }[] = [
    { key: 'subjects', label: 'Total Subjects', value: String(subjects.length), icon: <BookOpen size={20} color={colors.primary} />, bg: colors.indigoSoft },
    { key: 'completed', label: 'Completed Quizzes', value: String(progressData.totalQuizzesTaken), icon: <Award size={20} color={colors.primary} />, bg: colors.indigoSoft },
    { key: 'average', label: 'Average Score', value: `${avgScore}%`, icon: <TrendingUp size={20} color={colors.success} />, bg: colors.accentSoft },
    { key: 'weak', label: 'Weak Topics', value: String(weakTopics.length), icon: <Activity size={20} color={colors.danger} />, bg: colors.dangerSoft },
  ];

  const serverAttempts = (progressData.recentQuizAttempts ?? [])
    .map((a) => ({ ...a, completedAt: a.submittedAt || a.completedAt }));

  const recentAttempts = [...serverAttempts]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5);

  const subjectPcts = new Map<string, number[]>();
  serverAttempts.forEach((a) => {
    const key = a.subjectName || '';
    if (!key) return;
    const list = subjectPcts.get(key) ?? [];
    list.push(a.percentage || 0);
    subjectPcts.set(key, list);
  });
  const subjectProgress: { name: string; code: string; pct: number }[] = [];
  subjects.forEach((s) => {
    const scores = subjectPcts.get(s.name) || subjectPcts.get(s.code) || [];
    if (scores.length === 0) return;
    subjectProgress.push({
      name: s.name,
      code: s.code,
      pct: Math.round(scores.reduce((x, y) => x + y, 0) / scores.length),
    });
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
            {studentName ? `Welcome back, ${studentName}!` : 'Welcome back!'}
          </Text>
          <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>Here's what's happening with your learning today.</Text>
        </View>
      </View>

      {resumableQuiz && (
        <TouchableOpacity onPress={() => onNavigate('quiz')} style={[styles.resumeBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          <View style={[styles.resumeIcon, { backgroundColor: colors.warning }]}>
            <RotateCcw size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.resumeTitle, { color: colors.foreground }]}>{resumableQuiz.quizTitle}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              Question {resumableQuiz.currentQIndex + 1} of {resumableQuiz.totalQuestions} ({Object.keys(resumableQuiz.userAnswers || {}).length} answered)
            </Text>
          </View>
          <View style={[styles.resumeBtn, { backgroundColor: colors.warning }]}>
            <Play size={14} color="#fff" />
          </View>
          <TouchableOpacity
            onPress={discardResumable}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.resumeDiscard, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <X size={13} color={colors.mutedForeground} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <View style={styles.metricsGrid}>
        {metrics.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setDetailCard(m.key)}
            style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{m.value}</Text>
            </View>
            <View style={[styles.metricIcon, { backgroundColor: m.bg }]}>{m.icon}</View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.panelHeader}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>Recent Activities</Text>
          <TouchableOpacity onPress={() => onNavigate('analytics')}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>View All</Text>
          </TouchableOpacity>
        </View>
        {recentAttempts.length === 0 ? (
          <EmptyState icon={<Clock size={30} color={colors.mutedForeground} />} title="No activities yet" subtitle="Take a quiz to see your activity here." />
        ) : (
          <View style={{ gap: 14 }}>
            {recentAttempts.map((a, idx) => (
              <View key={idx} style={[styles.activityRow, idx < recentAttempts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.activityIcon, { backgroundColor: colors.indigoSoft }]}>
                  <Clock size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.activityTitle, { color: colors.foreground }]} numberOfLines={1}>
                    Completed {a.quizTitle}
                  </Text>
                  <View style={styles.activityMetaRow}>
                    <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>{a.percentage}%</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.subjectName}</Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{new Date(a.completedAt).toLocaleDateString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.panelHeader}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>Enrolled Subjects</Text>
          {subjects.length > 3 && (
            <TouchableOpacity onPress={() => onNavigate('subjects')}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
        {subjects.length === 0 ? (
          <EmptyState icon={<BookOpen size={30} color={colors.mutedForeground} />} title="No enrolled subjects yet" subtitle="Subjects will appear here once your instructor adds you to a class roster." />
        ) : (
          <View style={{ gap: 10 }}>
            {subjects.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.enrolledRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt || colors.surface }]}
                activeOpacity={0.7}
                onPress={() => {
                  if (onOpenSubject) onOpenSubject(s);
                  else onNavigate('subjects');
                }}
              >
                <View style={[styles.enrolledIcon, { backgroundColor: colors.indigoSoft }]}>
                  <BookOpen size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[styles.enrolledName, { color: colors.foreground }]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.code}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
                    {s.materialCount ?? 0} materials
                  </Text>
                  <ChevronRight size={14} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          Generate study materials, quizzes, and summaries from your notes.
        </Text>
        <View style={{ gap: 8 }}>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primary }]} onPress={() => onNavigate('ai-assistant')}>
            <Text style={styles.quickBtnText}>Generate Study Materials</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.surface }]} onPress={() => onNavigate('flashcards')}>
            <Layers size={14} color={colors.mutedForeground} />
            <Text style={[styles.quickBtnText, { color: colors.foreground }]}>Open Flashcards Deck</Text>
            <ArrowRight size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={detailCard === 'subjects'}
        onClose={() => setDetailCard(null)}
        title="Enrolled Subjects"
        subtitle={`You are enrolled in ${subjects.length} course subject${subjects.length === 1 ? '' : 's'}.`}
      >
        <View style={{ gap: 8 }}>
          {subjects.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No enrolled subjects yet.</Text>
          ) : (
            subjects.map((s) => (
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
        visible={detailCard === 'completed'}
        onClose={() => setDetailCard(null)}
        title="Completed Quizzes"
        subtitle={`You have completed ${progressData.totalQuizzesTaken} quiz${progressData.totalQuizzesTaken === 1 ? '' : 'zes'} so far.`}
      >
        <View style={{ gap: 8 }}>
          {progressData.recentQuizAttempts.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No quiz attempts recorded yet.</Text>
          ) : (
            progressData.recentQuizAttempts.map((a, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.detailRow, { borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => {
                  setDetailCard(null);
                  onNavigate('analytics');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                    {a.quizTitle}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.subjectName}</Text>
                </View>
                <Text style={{ color: a.percentage >= 70 ? colors.success : colors.danger, fontSize: 12, fontWeight: '800' }}>
                  {a.percentage}%
                </Text>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>

      <Modal
        visible={detailCard === 'average'}
        onClose={() => setDetailCard(null)}
        title="Average Score"
        subtitle={`Overall average: ${avgScore}% (passing mark is 70%).`}
      >
        <View style={{ gap: 8 }}>
          {progressData.recentQuizAttempts.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Take a quiz to build your score history.</Text>
          ) : (
            progressData.recentQuizAttempts.map((a, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.detailRow, { borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => {
                  setDetailCard(null);
                  onNavigate('analytics');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                    {a.quizTitle}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.subjectName}</Text>
                </View>
                <Text style={{ color: a.percentage >= 70 ? colors.success : colors.danger, fontSize: 12, fontWeight: '800' }}>
                  {a.percentage}%
                </Text>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>

      <Modal
        visible={detailCard === 'weak'}
        onClose={() => setDetailCard(null)}
        title="Weak Topics"
        subtitle={`${weakTopics.length} topic${weakTopics.length === 1 ? '' : 's'} need${weakTopics.length === 1 ? 's' : ''} review.`}
      >
        <View style={{ gap: 8 }}>
          {weakTopics.length === 0 && masteredTopics.length === 0 && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No weak topics detected. Great job!</Text>
          )}
          {weakTopics.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.detailRow, { borderColor: colors.danger }]}
              activeOpacity={0.7}
              onPress={() => {
                setDetailCard(null);
                if (onOpenWeakTopic) onOpenWeakTopic(t);
                else onNavigate('ai-assistant');
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Tap to study with AI</Text>
              </View>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
          {masteredTopics.length > 0 && (
            <View style={[styles.masteredBox, { borderColor: colors.border, backgroundColor: colors.successSoft }]}>
              <View style={styles.masteredHeader}>
                <CheckCircle2 size={14} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Overcome ({masteredTopics.length})
                </Text>
              </View>
              {masteredTopics.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.detailRow, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDetailCard(null);
                    if (onOpenWeakTopic) onOpenWeakTopic(t);
                    else onNavigate('ai-assistant');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                  </View>
                  <Text style={{ color: colors.success, fontSize: 10, fontWeight: '800' }}>MASTERED</Text>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  welcomeSub: { fontSize: 13, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  metricValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 17, fontWeight: '800' },
  activityRow: { flexDirection: 'row', gap: 12, paddingBottom: 12 },
  activityIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 13, fontWeight: '700' },
  activityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectName: { fontSize: 12, fontWeight: '700' },
  subjectPct: { fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 10, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  enrolledRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  enrolledIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  enrolledName: { fontSize: 13, fontWeight: '700' },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  quickBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  resumeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  resumeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resumeTitle: { fontSize: 13, fontWeight: '800' },
  resumeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  resumeDiscard: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  masteredBox: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  masteredHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
});