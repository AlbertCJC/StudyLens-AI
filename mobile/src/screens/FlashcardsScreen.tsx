import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Layers, ChevronLeft, ChevronRight, RotateCw, Sparkles, Shuffle, ThumbsUp, Zap, HardDrive } from 'lucide-react-native';
import { fetchFlashcards, FlashcardDeck } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, PrimaryButton, OutlineButton, LoadingView, EmptyState } from '../components/ui';
import { STORAGE_KEYS, getJSON, setJSON } from '../utils/storage';

type Rating = 'easy' | 'good' | 'hard';
type RatingsMap = Record<string, Rating>;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || 'usr-student-1';

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingsMap>({});
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [explain, setExplain] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  const loadRatings = useCallback(() => {
    getJSON<RatingsMap>(STORAGE_KEYS.deckRatings(userId)).then((r) => setRatings(r || {}));
  }, [userId]);

  useEffect(() => {
    fetchFlashcards().then((data) => {
      setDecks(data);
      setLoading(false);
    });
    loadRatings();
  }, [loadRatings]);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null;
  const orderedCards = selectedDeck ? order.map((id) => selectedDeck.cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c) : [];
  const card = orderedCards.length > 0 ? orderedCards[currentIndex] : selectedDeck?.cards[currentIndex] || null;

  const enterDeck = (deck: FlashcardDeck) => {
    setSelectedDeckId(deck.id);
    setOrder(shuffle(deck.cards.map((c) => c.id)));
    setCurrentIndex(0);
    setIsFlipped(false);
    setExplain(null);
    setStreak(0);
  };

  const updateRatings = async (deckId: string, cardId: string, rating: Rating) => {
    const next = { ...ratings, [`${deckId}:${cardId}`]: rating };
    setRatings(next);
    await setJSON(STORAGE_KEYS.deckRatings(userId), next);
  };

  const goNext = (deckId: string) => {
    setIsFlipped(false);
    setExplain(null);
    setCurrentIndex((i) => (i < orderedCards.length - 1 ? i + 1 : 0));
  };

  const goPrev = (deckId: string) => {
    setIsFlipped(false);
    setExplain(null);
    setCurrentIndex((i) => (i > 0 ? i - 1 : orderedCards.length - 1));
  };

  const rateCard = (rating: Rating, deckId: string, cardId: string) => {
    updateRatings(deckId, cardId, rating);
    if (rating === 'easy' || rating === 'good') setStreak((s) => s + 1);
    else setStreak(0);
    goNext(deckId);
  };

  const showExplain = (question: string, answer: string) => {
    setExplain(
      `Socratic breakdown: ${answer} Remember to connect this back to the core concept ("${question}"). Review the related lecture notes for extra depth.`
    );
  };

  const reshuffle = (deck: FlashcardDeck) => {
    setOrder(shuffle(deck.cards.map((c) => c.id)));
    setCurrentIndex(0);
    setIsFlipped(false);
    setExplain(null);
  };

  if (loading) return <LoadingView label="Loading flashcards..." />;

  // ---------------- PLAYER ----------------
  if (selectedDeck && card) {
    const deckId = selectedDeck.id;
    const currentRating = ratings[`${deckId}:${card.id}`];
    const ratedCount = selectedDeck.cards.filter((c) => ratings[`${deckId}:${c.id}`]).length;
    const easyCount = selectedDeck.cards.filter((c) => ratings[`${deckId}:${c.id}`] === 'easy').length;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.playerWrap}>
        <View style={styles.playerHead}>
          <View style={styles.playerTitleRow}>
            <TouchableOpacity onPress={() => setSelectedDeckId(null)} style={[styles.backBtn, { borderColor: colors.border }]}>
              <ChevronLeft size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.mutedForeground }}>
              {selectedDeck.title}
            </Text>
          </View>
          <View style={styles.playerMeta}>
            <Badge text={`Card ${currentIndex + 1} / ${orderedCards.length}`} color={colors.primary} />
            <Badge text={`${ratedCount} Rated`} color={colors.success} bg={colors.successSoft} />
            <Badge text={`Streak ${streak}`} color={colors.warning} bg={colors.warningSoft} />
          </View>
        </View>

        {/* Flip card */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => setIsFlipped((v) => !v)} style={styles.flipPress}>
          <View style={styles.flipContainer}>
            <View style={[styles.flipInner, { transform: [{ perspective: 1000 }, { rotateY: isFlipped ? '180deg' : '0deg' }] }]}>
              <View style={[styles.cardFace, styles.cardFront, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.faceLabel, { color: colors.mutedForeground }]}>Question</Text>
                <Text style={[styles.faceText, { color: colors.foreground }]}>{card.question}</Text>
                {card.topicTag && <Badge text={card.topicTag} color={colors.primary} />}
                <View style={styles.tapHint}>
                  <RotateCw size={13} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Tap card to flip</Text>
                </View>
              </View>
              <View style={[styles.cardFace, styles.cardBack, { backgroundColor: colors.primary }]}>
                <Text style={[styles.faceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Answer</Text>
                <Text style={[styles.faceText, { color: '#fff' }]}>{card.answer}</Text>
                <View style={styles.tapHint}>
                  <RotateCw size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Tap card to flip back</Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* AI explain */}
        <View style={styles.explainZone}>
          {explain ? (
            <View style={[styles.explainBox, { backgroundColor: colors.indigoSoft, borderColor: colors.primary }]}>
              <Sparkles size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, lineHeight: 17, flex: 1 }}>{explain}</Text>
            </View>
          ) : (
            isFlipped && (
              <TouchableOpacity onPress={() => showExplain(card.question, card.answer)} style={styles.explainBtn}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>AI Explain This Answer</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Rating controls */}
        <View style={styles.rateRow}>
          {(
            [
              { key: 'easy', label: 'Easy', icon: <ThumbsUp size={16} color={colors.success} /> },
              { key: 'good', label: 'Good', icon: <Zap size={16} color={colors.warning} /> },
              { key: 'hard', label: 'Hard', icon: <HardDrive size={16} color={colors.danger} /> },
            ] as const
          ).map((r) => (
            <TouchableOpacity
              key={r.key}
              onPress={() => rateCard(r.key, deckId, card.id)}
              style={[
                styles.rateBtn,
                { borderColor: colors.border, backgroundColor: currentRating === r.key ? (r.key === 'easy' ? colors.successSoft : r.key === 'good' ? colors.warningSoft : colors.dangerSoft) : colors.card },
              ]}
            >
              {r.icon}
              <Text style={{ color: r.key === 'easy' ? colors.success : r.key === 'good' ? colors.warning : colors.danger, fontSize: 12, fontWeight: '800' }}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: 'center' }}>
          Rate to auto-advance - {easyCount} easy so far - ratings saved on this device
        </Text>

        {/* Nav */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => goPrev(deckId)} style={[styles.navCircle, { borderColor: colors.border }]}>
            <ChevronLeft size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => reshuffle(selectedDeck)} style={[styles.navCircle, { borderColor: colors.border, backgroundColor: colors.successSoft }]}>
            <Shuffle size={20} color={colors.success} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goNext(deckId)} style={[styles.navCircle, { backgroundColor: colors.primary }]}>
            <ChevronRight size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ---------------- LIBRARY ----------------
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <Layers size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Flashcard Decks</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Active recall study cards with 3D flip, shuffle, and self-rating.
          </Text>
        </View>
      </View>

      {decks.length === 0 ? (
        <EmptyState icon={<Layers size={36} color={colors.mutedForeground} />} title="No flashcard decks yet" subtitle="Generate flashcards from your materials in the AI assistant." />
      ) : (
        <View style={{ gap: 12 }}>
          {decks.map((d) => {
            const deckRated = d.cards.filter((c) => ratings[`${d.id}:${c.id}`]).length;
            const pct = d.cards.length > 0 ? Math.round((deckRated / d.cards.length) * 100) : 0;
            return (
              <Card key={d.id} style={{ gap: 10 }}>
                <View style={styles.deckTop}>
                  <View style={[styles.deckIcon, { backgroundColor: colors.indigoSoft }]}>
                    <Layers size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deckTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: 11 }}>{d.subjectName}</Text>
                  </View>
                </View>
                <View style={styles.deckMeta}>
                  <Badge text={`${d.cards.length} Cards`} color={colors.primary} />
                  <Badge text={deckRated > 0 ? `${pct}% Studied` : 'New Deck'} color={deckRated > 0 ? colors.success : colors.warning} bg={deckRated > 0 ? colors.successSoft : colors.warningSoft} />
                </View>
                <View style={styles.deckActions}>
                  <PrimaryButton label={deckRated > 0 ? 'Resume Deck' : 'Start Studying'} onPress={() => enterDeck(d)} style={{ flex: 1 }} />
                  <OutlineButton label="AI Regenerate" onPress={() => onNavigate('ai-assistant')} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  deckTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deckIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deckTitle: { fontSize: 14, fontWeight: '800' },
  deckMeta: { flexDirection: 'row', gap: 6 },
  deckActions: { flexDirection: 'row', gap: 10 },
  playerWrap: { padding: 16, paddingBottom: 40, gap: 18 },
  playerHead: { gap: 10 },
  playerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flipPress: { flex: 1, minHeight: 340 },
  flipContainer: { flex: 1 },
  flipInner: { flex: 1, position: 'relative' },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backfaceVisibility: 'hidden',
  },
  cardFront: { borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 9 },
  cardBack: { transform: [{ rotateY: '180deg' }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 9 },
  faceLabel: { position: 'absolute', top: 24, left: 26, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  faceText: { fontSize: 21, lineHeight: 29, fontWeight: '600', textAlign: 'center', maxWidth: '90%' },
  tapHint: { position: 'absolute', bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  explainZone: { minHeight: 40, justifyContent: 'center' },
  explainBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  explainBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  rateRow: { flexDirection: 'row', gap: 10 },
  rateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  navCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});