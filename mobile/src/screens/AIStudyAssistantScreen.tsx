import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Sparkles,
  CheckSquare,
  Layers,
  FileText,
  BookOpen,
  UploadCloud,
  Paperclip,
  FolderArchive,
  X,
  CheckCircle2,
  Download,
  Eye,
  Cpu,
} from 'lucide-react-native';
import {
  fetchSubjects,
  fetchMaterials,
  generateQuiz,
  generateFlashcards,
  generateSummary,
  fetchQuizzes,
  fetchFlashcards,
  fetchSummaries,
  fetchReviewers,
  Subject,
  Material,
  Quiz,
  FlashcardDeck,
  StudySummary,
  Reviewer,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, LoadingView, Modal, Field, PrimaryButton, OutlineButton, Stepper, SegmentedButtons, SectionHeader, EmptyState } from '../components/ui';

type Mode = 'quiz' | 'flashcards' | 'summary';
type InputMethod = 'paste' | 'saved';

export default function AIStudyAssistantScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();

  const [mode, setMode] = useState<Mode>('quiz');
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste');
  const [text, setText] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [quizCount, setQuizCount] = useState(5);
  const [cardCount, setCardCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ type: Mode; data: Quiz | FlashcardDeck | StudySummary } | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([]);
  const [savedDecks, setSavedDecks] = useState<FlashcardDeck[]>([]);
  const [savedSummaries, setSavedSummaries] = useState<StudySummary[]>([]);
  const [savedReviewers, setSavedReviewers] = useState<Reviewer[]>([]);
  const [savedPreview, setSavedPreview] = useState<StudySummary | Reviewer | null>(null);

  useEffect(() => {
    Promise.all([fetchSubjects(), fetchMaterials()]).then(([subs, mats]) => {
      setSubjects(subs);
      setMaterials(mats);
      if (subs.length > 0) setSubjectId(subs[0].id);
    });
  }, []);

  const loadLibrary = () => {
    setLibraryLoading(true);
    Promise.all([fetchQuizzes(), fetchFlashcards(), fetchSummaries(), fetchReviewers()])
      .then(([q, d, s, r]) => {
        setSavedQuizzes(q);
        setSavedDecks(d);
        setSavedSummaries(s);
        setSavedReviewers(r);
        setLibraryLoading(false);
      })
      .catch(() => setLibraryLoading(false));
  };

  const loadMaterial = (m: Material) => {
    setText(m.extractedText || m.title);
    if (m.subjectId) setSubjectId(m.subjectId);
  };

  const canGenerate = text.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate || !currentUser) return;
    setIsGenerating(true);
    setError(null);
    setOutput(null);
    const sub = subjects.find((s) => s.id === subjectId);
    const subjectName = sub ? `${sub.code} - ${sub.name}` : 'General Topic';
    try {
      if (mode === 'quiz') {
        const quiz = await generateQuiz({
          textContent: text,
          numQuestions: quizCount,
          difficulty: 'medium',
          subjectId,
          subjectName,
          createdById: currentUser.id,
          createdByName: currentUser.name,
        });
        setOutput({ type: 'quiz', data: quiz });
      } else if (mode === 'flashcards') {
        const deck = await generateFlashcards({
          textContent: text,
          cardCount,
          subjectId,
          subjectName,
          createdById: currentUser.id,
        });
        setOutput({ type: 'flashcards', data: deck });
      } else {
        const summary = await generateSummary({
          textContent: text,
          subjectId,
          subjectName,
          createdById: currentUser.id,
        });
        setOutput({ type: 'summary', data: summary });
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadTxt = async (filename: string, content: string) => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Download', `${filename}.txt`);
        return;
      }
      const file = new File(Paths.cache, `${filename.replace(/[^\w\s-]/g, '').slice(0, 40)}.txt`);
      file.write(content);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/plain' });
    } catch {
      Alert.alert('Error', 'Could not export the file.');
    }
  };

  const subjectChips = (
    <View style={styles.chipWrap}>
      {subjects.map((s) => (
        <TouchableOpacity
          key={s.id}
          onPress={() => setSubjectId(s.id)}
          style={[styles.chip, subjectId === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: subjectId === s.id ? '#fff' : colors.foreground }}>{s.code}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Banner */}
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <Cpu size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>AI Study Assistant</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Automated resource generator powered by Groq GPT-OSS-120B</Text>
        </View>
        <TouchableOpacity onPress={() => { setShowLibrary((v) => !v); if (!showLibrary) loadLibrary(); }} style={[styles.libraryBtn, { backgroundColor: colors.indigoSoft }]}>
          <FolderArchive size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{showLibrary ? 'Hide Library' : 'Saved Library'}</Text>
        </TouchableOpacity>
      </View>

      {/* Saved library */}
      {showLibrary && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 10 }]}>
          <SectionHeader title="My Saved AI Resources" subtitle="Generated resources stored on the server" actionLabel="Close" onAction={() => setShowLibrary(false)} />
          {libraryLoading ? (
            <LoadingView label="Loading library..." />
          ) : (
            <ScrollView nestedScrollEnabled style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
              {savedQuizzes.map((q) => (
                <View key={q.id} style={[styles.savedRow, { borderColor: colors.border }]}>
                  <Badge text="Quiz" color="#7c3aed" bg="rgba(124,58,237,0.12)" />
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{q.title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{q.questions.length}Q</Text>
                </View>
              ))}
              {savedDecks.map((d) => (
                <View key={d.id} style={[styles.savedRow, { borderColor: colors.border }]}>
                  <Badge text="Flashcards" color="#2563eb" bg="rgba(37,99,235,0.12)" />
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{d.cards.length} cards</Text>
                </View>
              ))}
              {savedSummaries.map((s) => (
                <TouchableOpacity key={s.id} style={[styles.savedRow, { borderColor: colors.border }]} onPress={() => setSavedPreview(s)}>
                  <Badge text="Summary" color="#059669" bg="rgba(5,150,105,0.12)" />
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{s.title}</Text>
                  <Eye size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
              {savedReviewers.map((r) => (
                <TouchableOpacity key={r.id} style={[styles.savedRow, { borderColor: colors.border }]} onPress={() => setSavedPreview(r)}>
                  <Badge text="Reviewer" color="#d97706" bg="rgba(217,119,6,0.12)" />
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{r.title}</Text>
                  <Eye size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
              {savedQuizzes.length === 0 && savedDecks.length === 0 && savedSummaries.length === 0 && savedReviewers.length === 0 && (
                <EmptyState icon={<FolderArchive size={32} color={colors.mutedForeground} />} title="No saved resources yet" subtitle="Generate resources to store them here." />
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Config panel */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}>
        <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>1. Choose Generation Mode</Text>
        <View style={styles.modeGrid}>
          {([
            { key: 'quiz', label: 'Quiz', Icon: CheckSquare },
            { key: 'flashcards', label: 'Flashcards', Icon: Layers },
            { key: 'summary', label: 'Summary', Icon: FileText },
          ] as { key: Mode; label: string; Icon: React.ComponentType<any> }[]).map(({ key, label, Icon }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setMode(key)}
              style={[styles.modeBtn, mode === key ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Icon size={18} color={mode === key ? '#fff' : colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: mode === key ? '#fff' : colors.foreground }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>2. Source Material</Text>
        <SegmentedButtons
          options={[
            { key: 'paste', label: 'Paste Notes' },
            { key: 'saved', label: 'Saved Material' },
          ]}
          value={inputMethod}
          onChange={(k) => setInputMethod(k as InputMethod)}
        />
        {inputMethod === 'paste' ? (
          <Field
            label="Paste your lecture notes or topic"
            value={text}
            onChangeText={setText}
            placeholder="e.g. Photosynthesis, The French Revolution, or paste lecture notes..."
            multiline
          />
        ) : (
          <View style={{ gap: 8 }}>
            {materials.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => loadMaterial(m)} style={[styles.matPick, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Paperclip size={15} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{m.title}</Text>
                <CheckCircle2 size={15} color={colors.success} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View>
          <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>3. Target Subject</Text>
          {subjectChips}
        </View>

        {mode === 'quiz' && <Stepper label="Number of Quiz Questions" value={quizCount} min={3} max={20} onChange={setQuizCount} />}
        {mode === 'flashcards' && <Stepper label="Number of Flashcards" value={cardCount} min={3} max={20} onChange={setCardCount} />}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}>
            <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{error}</Text>
          </View>
        )}

        <PrimaryButton
          label={isGenerating ? 'Synthesizing AI Output...' : 'Generate Resource'}
          onPress={handleGenerate}
          loading={isGenerating}
          disabled={!canGenerate}
          color="#d97706"
          style={styles.generateBtn}
        />
      </View>

      {/* Output */}
      {output && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          <SectionHeader title="2. AI Generated Output" subtitle={`Saved as ${output.type}`} />
          {output.type === 'quiz' && <QuizOutput quiz={output.data as Quiz} colors={colors} />}
          {output.type === 'flashcards' && <DeckOutput deck={output.data as FlashcardDeck} colors={colors} />}
          {output.type === 'summary' && <SummaryOutput summary={output.data as StudySummary} colors={colors} />}
          {output.type === 'summary' && (
            <OutlineButton label="Download Summary (.txt)" onPress={() => downloadTxt((output.data as StudySummary).title, buildSummaryText(output.data as StudySummary))} />
          )}
          <View style={[styles.savedNote, { backgroundColor: colors.successSoft }]}>
            <CheckCircle2 size={15} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700', flex: 1 }}>
              Generated resource has been saved to the server library.
            </Text>
          </View>
        </View>
      )}

      {/* Saved preview modal */}
      <Modal visible={!!savedPreview} onClose={() => setSavedPreview(null)} title={(savedPreview as any)?.title || 'Resource'} subtitle={(savedPreview as any)?.subjectName || ''}>
        <ScrollView style={{ maxHeight: 420 }}>
          {savedPreview && 'executiveSummary' in savedPreview ? (
            <SummaryOutput summary={savedPreview as StudySummary} colors={colors} />
          ) : savedPreview ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>{(savedPreview as Reviewer).overview}</Text>
              {(savedPreview as Reviewer).topics.map((t, i) => (
                <View key={i} style={[styles.topicCard, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{t.topic}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t.overview}</Text>
                  <View style={styles.conceptWrap}>
                    {(t.keyConcepts || []).map((c, ci) => (
                      <Badge key={ci} text={c} color={colors.primary} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.modalActions}>
          <OutlineButton label="Download (.txt)" onPress={() => savedPreview && downloadTxt(savedPreview.title, JSON.stringify(savedPreview, null, 2))} />
          <PrimaryButton label="Close" onPress={() => setSavedPreview(null)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

function QuizOutput({ quiz, colors }: { quiz: Quiz; colors: any }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.outputTitle, { color: colors.foreground }]}>{quiz.title}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{quiz.questions.length} generated questions</Text>
      {quiz.questions.map((q, qi) => (
        <View key={q.id} style={[styles.outputCard, { borderColor: colors.border }]}>
          <View style={styles.qBadges}>
            <Badge text={`Question ${qi + 1}`} color={colors.primary} />
            {q.bloomsLevel && <Badge text={q.bloomsLevel} color="#7c3aed" bg="rgba(124,58,237,0.12)" />}
            {q.difficulty && <Badge text={q.difficulty} color="#d97706" bg="rgba(217,119,6,0.12)" />}
          </View>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{q.question}</Text>
          {q.options?.map((opt, oi) => {
            const isCorrect = q.correctAnswer === oi;
            return (
              <View key={oi} style={[styles.optionRow, isCorrect ? { borderColor: colors.success, backgroundColor: colors.successSoft } : { borderColor: colors.border }]}>
                <Text style={{ color: isCorrect ? colors.success : colors.foreground, fontSize: 12 }}>
                  {String.fromCharCode(65 + oi)}. {opt}
                </Text>
                {isCorrect && <CheckCircle2 size={14} color={colors.success} />}
              </View>
            );
          })}
          {q.explanation && <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>Explanation: {q.explanation}</Text>}
        </View>
      ))}
    </View>
  );
}

function DeckOutput({ deck, colors }: { deck: FlashcardDeck; colors: any }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.outputTitle, { color: colors.foreground }]}>{deck.title}</Text>
      {deck.cards.map((c, ci) => (
        <View key={c.id} style={[styles.outputCard, { borderColor: colors.border }]}>
          <Badge text={`Card ${ci + 1}`} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{c.question}</Text>
          <View style={[styles.answerBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{c.answer}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SummaryOutput({ summary, colors }: { summary: StudySummary; colors: any }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.outputTitle, { color: colors.foreground }]}>{summary.title}</Text>
      <View style={[styles.outputCard, { borderColor: colors.border }]}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Executive Summary</Text>
        <Text style={{ color: colors.foreground, fontSize: 12, lineHeight: 19, marginTop: 4 }}>{summary.executiveSummary}</Text>
      </View>
      <View style={[styles.outputCard, { borderColor: colors.border }]}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Takeaways</Text>
        {summary.keyTakeaways.map((k, i) => (
          <View key={i} style={styles.bulletRow}>
            <CheckCircle2 size={14} color={colors.success} />
            <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{k}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.outputCard, { borderColor: colors.border }]}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Study Bullet Points</Text>
        {summary.bulletPoints.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
            <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function buildSummaryText(s: StudySummary): string {
  return [
    s.title,
    '',
    'EXECUTIVE SUMMARY',
    s.executiveSummary,
    '',
    'KEY TAKEAWAYS',
    ...s.keyTakeaways.map((k) => `- ${k}`),
    '',
    'STUDY BULLET POINTS',
    ...s.bulletPoints.map((b) => `- ${b}`),
  ].join('\n');
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  libraryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  panelLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  modeGrid: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  matPick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  errorBox: { borderRadius: 12, padding: 12 },
  generateBtn: { marginTop: 2 },
  outputTitle: { fontSize: 15, fontWeight: '800' },
  outputCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  qBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, padding: 10 },
  answerBox: { borderRadius: 10, padding: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10 },
  savedNote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  topicCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  conceptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});