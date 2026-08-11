import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lightbulb,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Play,
} from 'lucide-react-native';
import { fetchQuizzes, fetchSubjects, Quiz, QuizQuestion, Subject } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Badge,
  Modal,
  PrimaryButton,
  OutlineButton,
  LoadingView,
  EmptyState,
  ProgressBar,
  SectionHeader,
} from '../components/ui';
import { ConfettiEffect } from '../components/ConfettiEffect';
import {
  getQuizProgresses,
  saveQuizProgress,
  removeQuizProgress,
  addAttempt,
  SavedQuizProgress,
  LocalAttempt,
} from '../utils/storage';

type AnswerValue = number | string | null;

interface ResultFeedback {
  index: number;
  question: string;
  type: string;
  yourAnswer: string;
  correctAnswer: string;
  correct: boolean;
  explanation?: string;
  topicTag?: string;
}

interface FinishedResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  autoSubmitted: boolean;
  feedback: ResultFeedback[];
}

export default function AssessmentsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || 'usr-student-1';

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumable, setResumable] = useState<SavedQuizProgress | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'teacher' | 'student'>('all');

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [textInput, setTextInput] = useState<Record<number, string>>({});
  const [hint, setHint] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [result, setResult] = useState<FinishedResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const loadQuizzes = useCallback(() => {
    setLoading(true);
    Promise.all([fetchQuizzes(), fetchSubjects()]).then(([q, s]) => {
      setQuizzes(q);
      setSubjects(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadQuizzes();
    getQuizProgresses(userId).then((progs) => {
      if (progs.length > 0) setResumable(progs[0]);
    });
  }, [loadQuizzes, userId]);

  const activeQuestions = activeQuiz?.questions || [];
  const totalQuestions = activeQuestions.length;
  const question: QuizQuestion | undefined = activeQuestions[currentIndex];

  const startQuiz = (q: Quiz, resumeFrom?: SavedQuizProgress) => {
    setActiveQuiz(q);
    setQuizFinished(false);
    setResult(null);
    setHint(null);
    setAutoSubmitted(false);
    if (resumeFrom) {
      setCurrentIndex(resumeFrom.currentQIndex);
      setAnswers((resumeFrom.userAnswers || {}) as Record<number, AnswerValue>);
      setSecondsLeft(resumeFrom.timeLeft ?? (q.timeLimitMinutes || 15) * 60);
    } else {
      setCurrentIndex(0);
      setAnswers({});
      setTextInput({});
      setSecondsLeft((q.timeLimitMinutes || 15) * 60);
    }
  };

  const saveProgress = () => {
    if (!activeQuiz) return;
    saveQuizProgress(userId, {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      subjectName: activeQuiz.subjectName,
      currentQIndex: currentIndex,
      userAnswers: answers as Record<string, unknown>,
      timeLeft: secondsLeft,
      totalQuestions: activeQuestions.length,
      lastUpdated: new Date().toISOString(),
      savedQuiz: activeQuiz,
    });
  };

  useEffect(() => {
    if (activeQuiz && !quizFinished) {
      const t = setTimeout(saveProgress, 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, answers, secondsLeft, activeQuiz, quizFinished]);

  useEffect(() => {
    if (!activeQuiz || quizFinished) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          finishQuiz(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuiz, quizFinished]);

  const handleSelect = (optionIndex: number) => {
    if (!question) return;
    if (question.type === 'identification' || question.type === 'short_answer') return;
    if (answers[currentIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handleTextAnswer = (value: string) => {
    setTextInput((prev) => ({ ...prev, [currentIndex]: value }));
    setAnswers((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const formatAnswer = (q: QuizQuestion, value: AnswerValue): string => {
    if (value === null || value === undefined) return 'No answer';
    if (q.type === 'identification' || q.type === 'short_answer') return String(value);
    const idx = Number(value);
    return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
  };

  const correctAnswerText = (q: QuizQuestion): string => {
    if (q.type === 'identification' || q.type === 'short_answer') return String(q.correctAnswer);
    const idx = Number(q.correctAnswer);
    return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
  };

  const isAnswerCorrect = (q: QuizQuestion, value: AnswerValue): boolean => {
    if (value === null || value === undefined) return false;
    if (q.type === 'identification' || q.type === 'short_answer') {
      return String(value).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    }
    return Number(value) === Number(q.correctAnswer);
  };

  const finishQuiz = (auto = false) => {
    if (!activeQuiz) return;
    let score = 0;
    const feedback: ResultFeedback[] = activeQuiz.questions.map((q, i) => {
      const ans = answers[i] !== undefined ? answers[i] : null;
      const correct = isAnswerCorrect(q, ans);
      if (correct) score += 1;
      return {
        index: i,
        question: q.question,
        type: q.type,
        yourAnswer: formatAnswer(q, ans),
        correctAnswer: correctAnswerText(q),
        correct,
        explanation: q.explanation,
        topicTag: q.topicTag,
      };
    });
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passed = percentage >= (activeQuiz.passPercentage || 70);
    const wrong = feedback.filter((f) => !f.correct);
    const weakTopics = Array.from(new Set(wrong.map((f) => f.topicTag || 'General').filter((t) => !!t)));
    const strongTopics = Array.from(new Set(feedback.filter((f) => f.correct).map((f) => f.topicTag || 'General').filter((t) => !!t)));

    const attempt: LocalAttempt = {
      id: `att-${Date.now()}`,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      subjectName: activeQuiz.subjectName,
      score,
      maxScore: totalQuestions,
      percentage,
      passed,
      weakTopics,
      strongTopics,
      completedAt: new Date().toISOString(),
    };
    addAttempt(userId, attempt);
    removeQuizProgress(userId, activeQuiz.id)
      .then(() => getQuizProgresses(userId))
      .then((progs) => setResumable(progs.length > 0 ? progs[0] : null));

    setAutoSubmitted(auto);
    setResult({ score, maxScore: totalQuestions, percentage, passed, autoSubmitted: auto, feedback });
    setQuizFinished(true);
    setHint(null);
    if (passed) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setHint(null);
    }
  };

  const goNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      finishQuiz(false);
    } else {
      setCurrentIndex((i) => i + 1);
      setHint(null);
    }
  };

  const getHint = () => {
    if (!question) return;
    setHint(
      `Study focus: re-read the core definition behind "${question.topicTag || 'this topic'}". Identify the key term that directly answers before selecting.`
    );
  };

  const exitQuiz = () => {
    if (quizFinished) {
      setActiveQuiz(null);
      setQuizFinished(false);
      setResult(null);
      return;
    }
    saveProgress();
    setActiveQuiz(null);
    setQuizFinished(false);
    setResult(null);
    setConfirmExit(false);
  };

  if (loading) return <LoadingView label="Loading assessments..." />;

  // ---------------- PLAYER ----------------
  if (activeQuiz) {
    if (quizFinished && result) {
      return (
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
          <ConfettiEffect trigger={showConfetti} />
          <ScrollView contentContainerStyle={styles.resultWrap}>
            <View style={[styles.resultIcon, { backgroundColor: result.passed ? colors.successSoft : colors.warningSoft }]}>
              <GraduationCap size={40} color={result.passed ? colors.success : colors.warning} />
            </View>
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>Quiz Completed!</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>You scored</Text>
            <Text style={[styles.resultScore, { color: colors.primary }]}>
              {result.score} / {result.maxScore}
            </Text>
            <View style={[styles.resultPctBadge, { backgroundColor: result.passed ? colors.successSoft : colors.dangerSoft }]}>
              <Text style={{ color: result.passed ? colors.success : colors.danger, fontSize: 18, fontWeight: '900' }}>{result.percentage}%</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {result.passed ? `Passed! (minimum ${activeQuiz.passPercentage || 70}%)` : `Below passing mark (minimum ${activeQuiz.passPercentage || 70}%)`}
            </Text>
            {result.autoSubmitted && (
              <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>Timer expired - auto-submitted with unanswered questions.</Text>
            )}

            <View style={{ width: '100%', marginTop: 14, gap: 10 }}>
              <SectionHeader title="Feedback & Explanations" subtitle="Review each question to reinforce weak topics" />
              {result.feedback.map((f) => (
                <View key={f.index} style={[styles.feedbackCard, { borderColor: f.correct ? colors.success : colors.danger, backgroundColor: f.correct ? colors.successSoft : colors.dangerSoft }]}>
                  <View style={styles.feedbackHead}>
                    {f.correct ? <CheckCircle2 size={16} color={colors.success} /> : <XCircle size={16} color={colors.danger} />}
                    <Text style={{ flex: 1, color: f.correct ? colors.success : colors.danger, fontSize: 13, fontWeight: '800' }}>Q{f.index + 1}</Text>
                    {f.topicTag && <Badge text={f.topicTag} color={f.correct ? colors.success : colors.danger} bg={colors.card} />}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{f.question}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Your answer: {f.yourAnswer}</Text>
                  {!f.correct && <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Correct answer: {f.correctAnswer}</Text>}
                  {f.explanation && <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>{f.explanation}</Text>}
                </View>
              ))}
            </View>

            <View style={styles.resultActions}>
              <OutlineButton label="Try Again" onPress={() => startQuiz(activeQuiz)} />
              <PrimaryButton label="Back to Assessments" onPress={exitQuiz} />
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.playerWrap}>
          <View style={styles.playerHead}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
              {activeQuiz.title}
            </Text>
            <View style={styles.playerMeta}>
              <Badge text={`Question ${currentIndex + 1} of ${totalQuestions}`} color={colors.primary} />
              <Badge text={formatTime(secondsLeft)} color={secondsLeft <= 60 ? colors.danger : colors.success} bg={secondsLeft <= 60 ? colors.dangerSoft : colors.successSoft} />
            </View>
            <ProgressBar value={((currentIndex + 1) / totalQuestions) * 100} />
          </View>

          {question && (
            <View style={styles.questionBlock}>
              <View style={styles.questionTop}>
                <Badge text={typeLabel(question.type)} color={colors.warning} bg={colors.warningSoft} />
                {question.bloomsLevel && <Badge text={question.bloomsLevel} color={colors.mutedForeground} bg={colors.surfaceAlt} />}
                {question.topicTag && <Badge text={question.topicTag} color={colors.primary} />}
              </View>
              <Text style={[styles.questionText, { color: colors.foreground }]}>{question.question}</Text>

              {question.type === 'identification' || question.type === 'short_answer' ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={textInput[currentIndex] || ''}
                    onChangeText={handleTextAnswer}
                    placeholder="Type your answer..."
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.answerInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.foreground }]}
                  />
                  {answers[currentIndex] !== undefined && (
                    <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>Answer recorded - press Next to continue</Text>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {(question.options || []).map((opt, idx) => {
                    const selected = answers[currentIndex] !== undefined && Number(answers[currentIndex]) === idx;
                    const answeredQuestion = answers[currentIndex] !== undefined;
                    return (
                      <TouchableOpacity
                        key={idx}
                        disabled={answeredQuestion}
                        onPress={() => handleSelect(idx)}
                        style={[
                          styles.optionBtn,
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.indigoSoft : colors.card },
                          answeredQuestion && !selected && { opacity: 0.55 },
                        ]}
                      >
                        <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }}>
                          {String.fromCharCode(65 + idx)}. {opt}
                        </Text>
                        {selected && <CheckCircle2 size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.hintZone}>
                {hint ? (
                  <View style={[styles.hintBox, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
                    <Lightbulb size={15} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 17, flex: 1 }}>{hint}</Text>
                  </View>
                ) : (
                  activeQuiz.quizType !== 'teacher' && (
                    <TouchableOpacity onPress={getHint} style={styles.hintBtn}>
                      <Sparkles size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Get a Study Hint</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}

          <View style={styles.playerNav}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={currentIndex === 0}
              style={[styles.navCircle, { borderColor: colors.border }, currentIndex === 0 && { opacity: 0.35 }]}
            >
              <ChevronLeft size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setConfirmExit(true)} style={[styles.exitBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>Save & Exit</Text>
            </TouchableOpacity>
            {answers[currentIndex] !== undefined ? (
              <TouchableOpacity onPress={goNext} style={[styles.nextBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{currentIndex + 1 >= totalQuestions ? 'Finish Quiz' : 'Next Question'}</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={currentIndex >= totalQuestions - 1 ? () => finishQuiz(true) : goNext}
                style={[styles.nextBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '700' }}>Skip</Text>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <Modal visible={confirmExit} onClose={() => setConfirmExit(false)} title="Exit Quiz?" subtitle="Your progress will be saved and you can resume anytime.">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <OutlineButton label="Keep Quizzing" onPress={() => setConfirmExit(false)} style={{ flex: 1 }} />
            <PrimaryButton label="Save & Exit" onPress={exitQuiz} style={{ flex: 1 }} />
          </View>
        </Modal>
      </View>
    );
  }

  // ---------------- CATALOG ----------------
  const filteredQuizzes = quizzes.filter((q) => {
    if (subjectFilter !== 'all' && q.subjectId !== subjectFilter) return false;
    if (typeFilter !== 'all' && q.quizType !== typeFilter) return false;
    return true;
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <CheckSquare size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Assessments & Quizzes</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Adaptive, AI-generated tests with instant feedback. All attempts saved locally for progress tracking.
          </Text>
        </View>
      </View>

      {resumable && (
        <TouchableOpacity
          onPress={() => {
            const q = quizzes.find((x) => x.id === resumable.quizId);
            if (q) startQuiz(q, resumable);
          }}
          style={[styles.resumeBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
        >
          <Play size={18} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>RESUME IN-PROGRESS QUIZ</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{resumable.quizTitle}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              Question {resumable.currentQIndex + 1} of {resumable.totalQuestions} - {formatTime(resumable.timeLeft)} left
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.filterBlock}>
        <SectionHeader title="Quiz Catalog" subtitle={`${filteredQuizzes.length} assessment(s)`} />
        <View style={styles.filterRow}>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'teacher', label: 'Teacher' },
              { key: 'student', label: 'Practice' },
            ] as const
          ).map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setTypeFilter(f.key)}
              style={[styles.chip, typeFilter === f.key ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: typeFilter === f.key ? '#fff' : colors.foreground }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => setSubjectFilter('all')}
            style={[styles.chip, subjectFilter === 'all' ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: subjectFilter === 'all' ? '#fff' : colors.foreground }}>All Subjects</Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSubjectFilter(s.id)}
              style={[styles.chip, subjectFilter === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: subjectFilter === s.id ? '#fff' : colors.foreground }}>{s.code}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredQuizzes.length === 0 ? (
        <EmptyState icon={<CheckSquare size={36} color={colors.mutedForeground} />} title="No quizzes found" subtitle="Use the AI generator to create a new practice quiz." />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredQuizzes.map((q) => (
            <Card key={q.id} style={{ gap: 10 }}>
              <View style={styles.quizTop}>
                <Badge text={q.subjectName} color={colors.primary} />
                {q.quizType === 'teacher' ? (
                  <Badge text="Teacher" color="#2563eb" bg="rgba(37,99,235,0.12)" />
                ) : (
                  <Badge text="Practice" color={colors.success} bg={colors.successSoft} />
                )}
              </View>
              <Text style={[styles.quizTitle, { color: colors.foreground }]} numberOfLines={1}>
                {q.title}
              </Text>
              {q.description && <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>{q.description}</Text>}
              <View style={styles.quizMeta}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.questions.length} Questions</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.timeLimitMinutes || 'No'} min</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Pass: {q.passPercentage}%</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.difficulty}</Text>
              </View>
              <View style={styles.quizActions}>
                <PrimaryButton label="Start Quiz" onPress={() => startQuiz(q)} style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.aiBtn, { backgroundColor: colors.successSoft }]}>
                  <Sparkles size={16} color={colors.success} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Card style={[styles.aiCta, { backgroundColor: colors.card }]} onPress={() => onNavigate('ai-assistant')}>
        <View style={[styles.aiCtaIcon, { backgroundColor: colors.successSoft }]}>
          <Sparkles size={18} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Create a New Quiz with AI</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Generate a Bloom's Taxonomy quiz from your course material.</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

function typeLabel(t: string) {
  return t === 'multiple_choice'
    ? 'Multiple Choice'
    : t === 'true_false'
      ? 'True / False'
      : t === 'identification'
        ? 'Identification'
        : 'Short Answer';
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  resumeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  filterBlock: { gap: 12 },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  quizTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quizTitle: { fontSize: 15, fontWeight: '800' },
  quizMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quizActions: { flexDirection: 'row', gap: 10 },
  aiBtn: { width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiCta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiCtaIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playerWrap: { padding: 16, paddingBottom: 40, gap: 18 },
  playerHead: { gap: 10 },
  playerMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  questionBlock: { gap: 16 },
  questionTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  questionText: { fontSize: 23, fontWeight: '800', lineHeight: 31 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 2, padding: 15 },
  answerInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontWeight: '600' },
  hintZone: { minHeight: 40, justifyContent: 'center' },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exitBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20 },
  resultWrap: { padding: 20, paddingBottom: 40, alignItems: 'center', gap: 8 },
  resultIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  resultTitle: { fontSize: 26, fontWeight: '900' },
  resultScore: { fontSize: 30, fontWeight: '900' },
  resultPctBadge: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 5, marginTop: 4 },
  resultActions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  feedbackCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 5 },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});