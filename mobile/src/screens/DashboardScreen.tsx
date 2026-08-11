import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  BookOpen,
  Award,
  TrendingUp,
  Activity,
  Clock,
  Brain,
  Layers,
  Zap,
  CheckCircle2,
  Flame,
  Gift,
  ArrowRight,
  RotateCcw,
  Play,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ConfettiEffect } from '../components/ConfettiEffect';
import { getQuizProgresses, SavedQuizProgress } from '../utils/storage';

export default function DashboardScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();

  const [userXp, setUserXp] = useState(850);
  const [userLevel, setUserLevel] = useState(5);
  const [boosterAnswered, setBoosterAnswered] = useState(false);
  const [selectedBoosterOpt, setSelectedBoosterOpt] = useState<number | null>(null);
  const [boosterFeedback, setBoosterFeedback] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resumableQuiz, setResumableQuiz] = useState<SavedQuizProgress | null>(null);

  useEffect(() => {
    if (currentUser?.id) {
      getQuizProgresses(currentUser.id).then((progs) => {
        if (progs.length > 0) setResumableQuiz(progs[0]);
      });
    }
  }, [currentUser?.id]);

  const dailyQ = {
    question: 'Which data structure follows the LIFO (Last In, First Out) principle?',
    options: ['Queue', 'Stack', 'Array', 'Linked List'],
    correct: 1,
    explanation: 'A Stack pushes and pops elements from the top, making the last inserted item the first one removed!',
  };

  const handleAnswerBooster = (index: number) => {
    if (boosterAnswered) return;
    setSelectedBoosterOpt(index);
    setBoosterAnswered(true);
    if (index === dailyQ.correct) {
      setBoosterFeedback('Excellent! Correct answer! +50 XP Earned!');
      setShowConfetti(true);
      setUserXp((prev) => {
        const next = prev + 50;
        if (next >= 1000) setUserLevel((l) => l + 1);
        return next;
      });
      setTimeout(() => setShowConfetti(false), 2600);
    } else {
      setBoosterFeedback('Nice try! ' + dailyQ.explanation);
    }
  };

  const studentName = currentUser?.name ? currentUser.name.split(' ')[0] : 'John';

  const metrics = [
    { label: 'Total Subjects', value: '8', delta: '2 new', icon: <BookOpen size={20} color={colors.primary} />, bg: colors.indigoSoft },
    { label: 'Completed Quizzes', value: '45', delta: '12 this week', icon: <Award size={20} color={colors.primary} />, bg: colors.indigoSoft },
    { label: 'Study Progress', value: '78%', delta: '5% increase', icon: <TrendingUp size={20} color={colors.success} />, bg: colors.accentSoft },
    { label: 'Average Score', value: '92%', delta: '3% increase', icon: <Activity size={20} color={colors.danger} />, bg: colors.dangerSoft },
  ];

  const activities = [
    { title: 'Completed Mathematics Quiz', badge: 'Mathematics', meta: 'Score: 95%', time: '2 hours ago' },
    { title: 'Reviewed Physics Flashcards', badge: 'Physics', meta: '25 cards', time: '5 hours ago' },
    { title: 'Submitted Chemistry Lab Assessment', badge: 'Chemistry', meta: 'Grade: 90%', time: 'Yesterday' },
    { title: 'Asked AI Study Assistant 3 Questions', badge: 'Computer Science', meta: 'Binary Search Trees', time: '2 days ago' },
  ];

  const subjects = [
    { name: 'Mathematics', pct: 85 },
    { name: 'Physics', pct: 72 },
    { name: 'Chemistry', pct: 65 },
    { name: 'English', pct: 90 },
    { name: 'Computer Science', pct: 94 },
  ];

  const xpPct = Math.min(100, ((userXp % 1000) / 1000) * 100);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <ConfettiEffect trigger={showConfetti} />
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Welcome back, {studentName}!</Text>
          <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>Here's what's happening with your learning today.</Text>
        </View>
      </View>

      {resumableQuiz && (
        <TouchableOpacity onPress={() => onNavigate('quiz')} style={[styles.resumeBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          <View style={[styles.resumeIcon, { backgroundColor: colors.warning }]}>
            <RotateCcw size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.resumeBadges}>
              <View style={[styles.resumeBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.resumeBadgeText}>Resume Ongoing Quiz</Text>
              </View>
              <View style={[styles.resumeBadge, { backgroundColor: colors.card }]}>
                <Text style={{ color: colors.foreground, fontSize: 9, fontWeight: '800' }}>Active Practice Session</Text>
              </View>
            </View>
            <Text style={[styles.resumeTitle, { color: colors.foreground }]}>{resumableQuiz.quizTitle}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              Question {resumableQuiz.currentQIndex + 1} of {resumableQuiz.totalQuestions} ({Object.keys(resumableQuiz.userAnswers || {}).length} answered)
            </Text>
          </View>
          <View style={[styles.resumeBtn, { backgroundColor: colors.warning }]}>
            <Play size={14} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      <View style={[styles.gamifyPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.gamifyLeft}>
          <View style={[styles.levelBadge, { backgroundColor: colors.warning }]}>
            <Text style={styles.levelBadgeText}>L{userLevel}</Text>
          </View>
          <View>
            <Text style={[styles.levelTitle, { color: colors.foreground }]}>Level {userLevel} Scholar</Text>
            <View style={[styles.xpTrack, { backgroundColor: colors.surface }]}>
              <View style={[styles.xpFill, { width: `${xpPct}%`, backgroundColor: colors.warning }]} />
            </View>
          </View>
        </View>
        <View style={[styles.gamifyDivider, { backgroundColor: colors.border }]} />
        <View style={[styles.streakBadge, { backgroundColor: colors.warningSoft }]}>
          <Flame size={14} color={colors.flame} />
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>7-Day Streak</Text>
        </View>
        <TouchableOpacity style={[styles.xpBtn, { backgroundColor: colors.primarySoft }]} onPress={() => setUserXp((prev) => prev + 25)}>
          <Gift size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>+25 XP</Text>
        </TouchableOpacity>
      </View>

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

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.panelHeader}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>Recent Activities</Text>
          <TouchableOpacity onPress={() => onNavigate('analytics')}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 14 }}>
          {activities.map((a, idx) => (
            <View key={idx} style={[styles.activityRow, idx < activities.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[styles.activityIcon, { backgroundColor: colors.indigoSoft }]}>
                <Clock size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.activityTitle, { color: colors.foreground }]}>{a.title}</Text>
                <View style={styles.activityMetaRow}>
                  <View style={[styles.badgePill, { backgroundColor: colors.primary }]}>
                    <Text style={styles.badgeText}>{a.badge}</Text>
                  </View>
                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>{a.meta}</Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>Subject Progress</Text>
        <View style={{ gap: 16 }}>
          {subjects.map((s, idx) => (
            <View key={idx} style={{ gap: 6 }}>
              <View style={styles.subjectRow}>
                <Text style={[styles.subjectName, { color: colors.foreground }]}>{s.name}</Text>
                <Text style={[styles.subjectPct, { color: colors.mutedForeground }]}>{s.pct}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.primarySoft }]}>
                <View style={[styles.progressFill, { width: `${s.pct}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.boosterCard, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.boosterHeader}>
          <View style={styles.boosterTitleRow}>
            <View style={[styles.boosterIcon, { backgroundColor: colors.primary }]}>
              <Zap size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.boosterTitle, { color: colors.foreground }]}>Daily Brain Booster Challenge</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Answer today's quick question to earn +50 XP</Text>
            </View>
          </View>
          <View style={[styles.xpBadge, { backgroundColor: colors.warningSoft }]}>
            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>+50 XP</Text>
          </View>
        </View>
        <View style={[styles.boosterInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.boosterQuestion, { color: colors.foreground }]}>{dailyQ.question}</Text>
          <View style={{ gap: 8 }}>
            {dailyQ.options.map((opt, idx) => {
              const isSelected = selectedBoosterOpt === idx;
              const isCorrectOpt = idx === dailyQ.correct;
              let optionStyle: any = { backgroundColor: colors.surface, borderColor: colors.border };
              let textColor = colors.foreground;
              if (boosterAnswered) {
                if (isSelected && isCorrectOpt) {
                  optionStyle = { backgroundColor: colors.successSoft, borderColor: colors.success };
                  textColor = colors.success;
                } else if (isSelected && !isCorrectOpt) {
                  optionStyle = { backgroundColor: colors.dangerSoft, borderColor: colors.danger };
                  textColor = colors.danger;
                } else if (isCorrectOpt) {
                  optionStyle = { backgroundColor: colors.successSoft, borderColor: colors.success };
                  textColor = colors.success;
                }
              }
              return (
                <TouchableOpacity key={idx} style={[styles.optionBtn, optionStyle]} onPress={() => handleAnswerBooster(idx)} disabled={boosterAnswered}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: textColor, flex: 1 }}>{opt}</Text>
                  {boosterAnswered && isCorrectOpt && <CheckCircle2 size={16} color={colors.success} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {boosterFeedback && (
            <View style={[styles.boosterFeedback, { backgroundColor: colors.primarySoft }]}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{boosterFeedback}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.quickHeader}>
          <View style={[styles.metricIcon, { backgroundColor: colors.indigoSoft }]}>
            <Brain size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quickTitle, { color: colors.foreground }]}>Quick AI Generator</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Instant study materials</Text>
          </View>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          Generate Bloom's taxonomy quizzes, interactive flashcards, or exam summaries in seconds.
        </Text>
        <View style={{ gap: 8 }}>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primary }]} onPress={() => onNavigate('ai-assistant')}>
            <Brain size={14} color="#fff" />
            <Text style={styles.quickBtnText}>Launch AI Study Assistant</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.surface }]} onPress={() => onNavigate('flashcards')}>
            <Layers size={14} color={colors.mutedForeground} />
            <Text style={[styles.quickBtnText, { color: colors.foreground }]}>Open Flashcards Deck</Text>
            <ArrowRight size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  welcomeSub: { fontSize: 13, marginTop: 4 },
  gamifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gamifyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: { fontSize: 12, fontWeight: '900', color: '#0f172a' },
  levelTitle: { fontSize: 12, fontWeight: '700' },
  xpTrack: { height: 6, width: 90, borderRadius: 99, overflow: 'hidden', marginTop: 4 },
  xpFill: { height: '100%', borderRadius: 99 },
  gamifyDivider: { width: 1, height: 24 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  xpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
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
  badgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  subjectRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectName: { fontSize: 12, fontWeight: '700' },
  subjectPct: { fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 10, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  boosterCard: { borderRadius: 16, padding: 18, gap: 14 },
  boosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  boosterTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  boosterIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  boosterTitle: { fontSize: 14, fontWeight: '700' },
  xpBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  boosterInner: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  boosterQuestion: { fontSize: 13, fontWeight: '700' },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  boosterFeedback: { borderRadius: 12, padding: 10 },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickTitle: { fontSize: 14, fontWeight: '700' },
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
  resumeBadges: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  resumeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  resumeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  resumeTitle: { fontSize: 13, fontWeight: '800' },
  resumeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});