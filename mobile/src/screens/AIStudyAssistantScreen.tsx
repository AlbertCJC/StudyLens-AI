import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  CheckSquare,
  Layers,
  FileText,
  BookOpen,
  Paperclip,
  X,
  CheckCircle2,
  Download,
  Plus,
  AlertTriangle,
} from 'lucide-react-native';
import {
  aiGenerateDraft,
  aiSaveDraft,
  shuffleQuizAnswers,
  exportAiPdf,
  uploadMaterial,
  Quiz,
  FlashcardDeck,
  StudySummary,
  Reviewer,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Field, PrimaryButton, OutlineButton, SectionHeader } from '../components/ui';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

type Mode = 'quiz' | 'flashcards' | 'summary' | 'reviewer';

const friendlyAiError = (message: string, code?: string): string => {
  const lower = (message || '').toLowerCase();
  if (lower.includes('payment') || lower.includes('billing') || code === 'PAYMENT_REQUIRED') {
    return 'The AI service is currently unavailable. Your request was handled locally instead, so generation is still allowed.';
  }
  if (lower.includes('limit') || lower.includes('rate limit') || code === 'RATE_LIMITED') {
    return 'You have reached the AI generation limit for this session. Please wait a moment and try again.';
  }
  if (lower.includes('how many questions') || code === 'COUNT_REQUIRED') {
    return 'Tell the AI how many questions to make in your prompt (e.g. "Make 10 multiple choice questions" or "5 identification, 10 multiple choice, 5 true or false").';
  }
  return message;
};

export default function AIStudyAssistantScreen({
  onNavigate,
  initialTopic,
  initialMaterial,
  onSeedConsumed,
}: {
  onNavigate: (tab: string) => void;
  initialTopic?: string | null;
  initialMaterial?: { title: string; content: string } | null;
  onSeedConsumed?: () => void;
}) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>('quiz');
  const [text, setText] = useState('');
  const [cardCount, setCardCount] = useState('');
  const [quizRevealAnswers, setQuizRevealAnswers] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ type: Mode; data: Quiz | FlashcardDeck | StudySummary | Reviewer } | null>(null);
  const [titleExists, setTitleExists] = useState(false);
  const [savingOutput, setSavingOutput] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [offlineNotice, setOfflineNotice] = useState(false);
  const generateAbortRef = useRef<AbortController | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Pre-seed from dashboard "Weak Topics" hand-off
  const seededTopicRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialTopic && initialTopic !== seededTopicRef.current) {
      seededTopicRef.current = initialTopic;
      setMode('reviewer');
      setText(`Create a study plan that helps me understand "${initialTopic}" step by step. Explain the core ideas simply, give worked examples, list common mistakes to avoid, and finish with practice questions.`);
    }
    if (!initialTopic && onSeedConsumed && seededTopicRef.current) {
      seededTopicRef.current = null;
      onSeedConsumed();
    }
  }, [initialTopic, onSeedConsumed]);

  // Pre-seed from a Learning Materials "Create Notes" hand-off: open the AI
  // assistant in Reviewer mode with the source material text already loaded.
  const seededMaterialRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialMaterial && initialMaterial.content && initialMaterial.title !== seededMaterialRef.current) {
      seededMaterialRef.current = initialMaterial.title;
      setMode('reviewer');
      setText(initialMaterial.content);
    }
    if (!initialMaterial && onSeedConsumed && seededMaterialRef.current) {
      seededMaterialRef.current = null;
      onSeedConsumed();
    }
  }, [initialMaterial, onSeedConsumed]);

  const pickAndAttachFile = async () => {
    setShowAttachMenu(false);
    if (Platform.OS === 'web') {
      showToast('File upload is not supported on web in this build.', 'error');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const file = { uri: asset.uri, name: asset.name || 'lecture.pdf', type: asset.mimeType || 'application/octet-stream' };
      setPickedFile(file);
      setIsUploading(true);
      try {
        const res = (await uploadMaterial({
          uri: file.uri,
          name: file.name,
          type: file.type,
          subjectId: '',
          uploadedBy: currentUser?.name || 'Student User',
          uploaderRole: currentUser?.role || 'student',
          uploaderId: currentUser?.id || '',
        }, '/materials/extract')) as { text?: string };
        setText(res.text || '');
        if (!(res.text || '').trim()) {
          setError(`Could not extract any readable text from "${file.name}". Try pasting the content instead.`);
          setPickedFile(null);
        }
      } catch (err) {
        setError((err as Error).message || 'Could not process the attached file.');
        setPickedFile(null);
      } finally {
        setIsUploading(false);
      }
    } catch {
      setPickedFile(null);
    }
  };

  const clearAttachedFile = () => {
    setPickedFile(null);
    setText('');
  };

  const canGenerate = text.trim().length > 0;

  const handleCancelGenerate = () => {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
      generateAbortRef.current = null;
    }
    setIsGenerating(false);
    setError('AI generation cancelled.');
  };

  const modeLabel = mode === 'quiz' ? 'Quiz' : mode === 'flashcards' ? 'Flashcard Deck' : mode === 'summary' ? 'Summary' : 'Reviewer';

  const handleGenerate = async () => {
    if (!canGenerate || !currentUser) return;
    setIsGenerating(true);
    setError(null);
    setOutput(null);
    setSavedNote(null);
    setSaveError(null);
    setTitleExists(false);
    setOfflineNotice(false);
    const controller = new AbortController();
    generateAbortRef.current = controller;
    const base = {
      textContent: text,
      createdById: currentUser.id,
      createdByName: currentUser.name,
    };
    try {
      const parseCount = (v: string): number => {
        const n = parseInt(v, 10);
        if (isNaN(n)) return 5;
        return Math.min(100, Math.max(1, n));
      };
      let draft: Record<string, unknown>;
      if (mode === 'quiz') {
        draft = await aiGenerateDraft('quiz', { ...base, difficulty: 'medium', revealAnswers: quizRevealAnswers }, controller.signal);
        setTitleExists(draft.titleExists === true);
        setOutput({ type: 'quiz', data: shuffleQuizAnswers(draft as unknown as Quiz) });
      } else if (mode === 'flashcards') {
        draft = await aiGenerateDraft('flashcards', { ...base, cardCount: parseCount(cardCount) }, controller.signal);
        setOutput({ type: 'flashcards', data: draft as unknown as FlashcardDeck });
      } else if (mode === 'summary') {
        draft = await aiGenerateDraft('summary', { ...base }, controller.signal);
        setOutput({ type: 'summary', data: draft as unknown as StudySummary });
      } else {
        draft = await aiGenerateDraft('reviewer', { ...base }, controller.signal);
        setOutput({ type: 'reviewer', data: draft as unknown as Reviewer });
      }
      setOfflineNotice((draft as { source?: string }).source === 'offline-fallback');
      const sourceBase = pickedFile?.name?.replace(/\.[^/.]+$/, '') || text.trim().slice(0, 60);
      setDraftTitle(sourceBase ? `${modeLabel}: ${sourceBase}` : String(draft.title || modeLabel));
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setError('AI generation cancelled.');
      } else {
        setError(friendlyAiError((err as Error).message || 'Failed to generate content. Please try again.'));
      }
    } finally {
      if (generateAbortRef.current === controller) generateAbortRef.current = null;
      setIsGenerating(false);
    }
  };

  // Saved resources land directly in their destination sections, so the save
  // button names exactly where the resource will appear.
  const isStaffAccount = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const saveDestinationLabel = (() => {
    if (output?.type === 'quiz') return isStaffAccount ? 'Save to Assessment Management' : 'Save to Take Quizzes & Tests';
    if (output?.type === 'flashcards') return isStaffAccount ? 'Save to Upload & Manage Materials' : 'Save to Flashcards';
    return isStaffAccount ? 'Save to Upload & Manage Materials' : 'Save to Learning Materials';
  })();

  const resetWorkspace = () => {
    setText('');
    setPickedFile(null);
    setOutput(null);
    setDraftTitle('');
    setTitleExists(false);
    setOfflineNotice(false);
    setError(null);
  };

  const handleSaveOutput = async () => {
    if (!output || !currentUser) return;
    setSavingOutput(true);
    setSaveError(null);
    try {
      const payload = {
        ...((output.data as unknown) as Record<string, unknown>),
        title: draftTitle || (output.data as { title?: string }).title,
        userRole: currentUser.role,
        quizType: currentUser.role === 'teacher' ? 'teacher' : 'student',
        revealAnswers: output.type === 'quiz' ? quizRevealAnswers : undefined,
      } as Record<string, unknown>;
      delete payload.subjectId;
      delete payload.subjectName;
      const saved = await aiSaveDraft(output.type, payload);
      setOutput({ type: output.type, data: saved as unknown as Quiz | FlashcardDeck | StudySummary | Reviewer });
      let dest: string;
      if (output.type === 'quiz') {
        dest = isStaffAccount ? 'Quiz saved to Assessment Management!' : 'Quiz saved to Take Quizzes & Tests!';
      } else if (output.type === 'flashcards') {
        dest = isStaffAccount ? 'Flashcards saved to Upload & Manage Materials — assign a subject there.' : 'Flashcards saved to Flashcards!';
      } else if (output.type === 'reviewer') {
        dest = isStaffAccount ? 'Reviewer saved to Upload & Manage Materials — assign a subject there.' : 'Reviewer saved to Learning Materials.';
      } else {
        dest = isStaffAccount ? 'Summary saved to Upload & Manage Materials — assign a subject there.' : 'Summary saved to Learning Materials.';
      }
      setSavedNote(dest);
      resetWorkspace();
    } catch (err) {
      const msg = friendlyAiError((err as Error).message || 'Could not save the resource.');
      showToast(msg, 'error');
      setSaveError(msg);
    } finally {
      setSavingOutput(false);
    }
  };

  const handleDiscardOutput = () => {
    resetWorkspace();
    setSavedNote(null);
    setSaveError(null);
  };

  const downloadPdf = async (title: string, type: 'summary' | 'reviewer' | 'quiz' | 'flashcards', data: StudySummary | Reviewer | Quiz | FlashcardDeck, subjectName?: string) => {
    try {
      if (Platform.OS === 'web') {
        showToast(`${title}.pdf`, 'info');
        return;
      }
      const bytes = await exportAiPdf({ mode: type, title, subjectName, data: data as unknown as Record<string, unknown> });
      const file = new File(Paths.cache, `${title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'studylens'}.pdf`);
      file.write(bytes);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: title });
      } else {
        showToast(`PDF saved: ${file.uri}`, 'success');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not export the PDF.', 'error');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Slim header */}
      <View style={[styles.slimHeader, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.slimHeaderTitle, { color: colors.foreground }]}>AI Study Assistant</Text>
      </View>

      {/* Config panel */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}>
        <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>Generation Mode</Text>
        <View style={styles.modeGrid}>
          {([
            { key: 'quiz', label: 'Quiz', Icon: CheckSquare },
            { key: 'flashcards', label: 'Flashcards', Icon: Layers },
            { key: 'summary', label: 'Summary', Icon: FileText },
            { key: 'reviewer', label: 'Reviewer', Icon: BookOpen },
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

        <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>Source Material</Text>

        {pickedFile && (
          <View style={[styles.attachChip, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
            <Paperclip size={14} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {isUploading ? 'Extracting text...' : pickedFile.name}
            </Text>
            <TouchableOpacity onPress={clearAttachedFile} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {mode === 'quiz' && (
          <>
            {currentUser?.role === 'teacher' && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Show correct answers to students</Text>
                <View style={styles.chipRow}>
                  {[true, false].map((on) => (
                    <TouchableOpacity
                      key={String(on)}
                      onPress={() => setQuizRevealAnswers(on)}
                      style={[
                        styles.chip,
                        quizRevealAnswers === on
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: quizRevealAnswers === on ? '#fff' : colors.foreground }}>
                        {on ? 'Yes' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        {mode === 'flashcards' && (
          <Field
            label="Number of Flashcards"
            value={cardCount}
            onChangeText={setCardCount}
            placeholder="e.g. 10"
            keyboardType="numeric"
            onSubmitEditing={!isGenerating && canGenerate ? handleGenerate : undefined}
            returnKeyType="send"
          />
        )}

        <View style={styles.promptRow}>
          <View style={{ flex: 1 }}>
            <Field
              label="Prompt"
              value={text}
              onChangeText={setText}
              placeholder="Describe what to study or paste lecture notes..."
              multiline
              onSubmitEditing={!isGenerating && canGenerate ? handleGenerate : undefined}
              returnKeyType="send"
            />
          </View>
          <View>
            <TouchableOpacity
              onPress={() => setShowAttachMenu((v) => !v)}
              style={[styles.attachBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            >
              <Plus size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {mode === 'quiz' && (
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: -8 }}>
            Tip: include how many questions you want and any formats (e.g. "5 identification, 10 multiple choice, 5 true or false").
          </Text>
        )}

        {showAttachMenu && (
          <View style={[styles.attachMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickAndAttachFile} disabled={isUploading}>
              <Paperclip size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>Attach File</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}>
            <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{error}</Text>
          </View>
        )}

        <PrimaryButton
          label={isGenerating ? 'Generating...' : 'Generate Resource'}
          onPress={handleGenerate}
          loading={isGenerating}
          disabled={!canGenerate}
          color="#d97706"
          style={styles.generateBtn}
        />
        {isGenerating && (
          <OutlineButton label="Cancel Generation" onPress={handleCancelGenerate} />
        )}
        {offlineNotice && !error && (
          <View style={[styles.offlineBox, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <AlertTriangle size={14} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700', flex: 1 }}>
              AI service is offline — results were generated from the material's text content instead.
            </Text>
          </View>
        )}
      </View>

      {/* Output */}
      {output && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          <SectionHeader title="Generated Output" subtitle={`Preview — ${output.type}`} />
          {!savedNote && (
            <Field
              label="Resource Title (Editable)"
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Resource title"
            />
          )}
          {titleExists && (
            <View style={[styles.titleWarn, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
              <AlertTriangle size={15} color={colors.warning} />
              <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700', flex: 1 }}>
                A quiz with this title already exists in your library — consider renaming it before saving.
              </Text>
            </View>
          )}
          <ScrollView nestedScrollEnabled style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 12 }}>
            {output.type === 'quiz' && <QuizOutput quiz={output.data as Quiz} colors={colors} />}
            {output.type === 'flashcards' && <DeckOutput deck={output.data as FlashcardDeck} colors={colors} />}
            {output.type === 'summary' && <SummaryOutput summary={output.data as StudySummary} colors={colors} />}
            {output.type === 'reviewer' && <ReviewerOutput reviewer={output.data as Reviewer} colors={colors} />}
            {(output.type === 'summary' || output.type === 'reviewer') && (
              <OutlineButton
                label={`Download ${output.type === 'reviewer' ? 'Reviewer' : 'Summary'} (PDF)`}
                onPress={() => downloadPdf(draftTitle || (output.data as { title?: string }).title || 'Resource', output.type, output.data as StudySummary | Reviewer)}
              />
            )}

            {savedNote ? (
              <View style={[styles.savedNote, { backgroundColor: colors.successSoft }]}>
                <CheckCircle2 size={15} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700', flex: 1 }}>{savedNote}</Text>
              </View>
            ) : (
              <>
                <View style={styles.outputActions}>
                  <OutlineButton label="Discard" onPress={handleDiscardOutput} style={{ flex: 1 }} />
                  <PrimaryButton label={saveDestinationLabel} onPress={handleSaveOutput} loading={savingOutput} disabled={savingOutput} style={{ flex: 1 }} />
                </View>
                {saveError && (
                  <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '600' }}>{saveError}</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      )}
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
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '700' }}>Question {qi + 1}</Text>
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
          {(!q.options || q.options.length === 0) && q.correctAnswer && (
            <View style={[styles.answerBox, { backgroundColor: colors.successSoft }]}>
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>Answer: {q.correctAnswer}</Text>
            </View>
          )}
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
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '700' }}>{ci + 1}.</Text>
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

function ReviewerOutput({ reviewer, colors }: { reviewer: Reviewer; colors: any }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.outputTitle, { color: colors.foreground }]}>{reviewer.title}</Text>
      <View style={[styles.outputCard, { borderColor: colors.border }]}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Overview</Text>
        <Text style={{ color: colors.foreground, fontSize: 12, lineHeight: 19, marginTop: 4 }}>{reviewer.overview}</Text>
      </View>
      {(reviewer.topics || []).map((t, i) => (
        <View key={i} style={[styles.topicCard, { borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{t.topic}</Text>
          <Text style={{ color: colors.foreground, fontSize: 12, lineHeight: 19, marginTop: 2 }}>{t.overview}</Text>
          {(t.keyConcepts || []).length > 0 && (
            <View style={styles.conceptWrap}>
              {(t.keyConcepts || []).map((c, ci) => (
                <Badge key={ci} text={c} color={colors.primary} bg="rgba(37,99,235,0.10)" />
              ))}
            </View>
          )}
          {((t as { sampleQuestions?: Array<{ question: string; answer?: string }> }).sampleQuestions || []).map((sq, qi) => (
            <View key={qi} style={[styles.answerBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Q: {sq.question}</Text>
              {sq.answer ? <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>A: {sq.answer}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  slimHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  slimHeaderTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  panelLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeBtn: { flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  attachChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  promptRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  attachMenu: { borderRadius: 12, borderWidth: 1, padding: 6 },
  attachMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 8 },
  errorBox: { borderRadius: 12, padding: 12 },
  offlineBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  generateBtn: { marginTop: 2 },
  outputTitle: { fontSize: 15, fontWeight: '800' },
  outputCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  qBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, padding: 10 },
  answerBox: { borderRadius: 10, padding: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  savedNote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  titleWarn: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  outputActions: { flexDirection: 'row', gap: 10 },
  topicCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  conceptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});