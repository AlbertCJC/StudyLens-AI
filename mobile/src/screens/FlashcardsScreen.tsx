import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Layers, ChevronLeft, ChevronRight, RotateCw, Sparkles, Shuffle } from 'lucide-react-native';
import { fetchFlashcards, FlashcardDeck } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, PrimaryButton, LoadingView, EmptyState } from '../components/ui';

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

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [explain, setExplain] = useState<string | null>(null);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flipCard = () => {
    setIsFlipped((v) => {
      const target = !v;
      Animated.timing(flipAnim, {
        toValue: target ? 1 : 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
      return target;
    });
  };

  const flipFront = {
    transform: [{ perspective: 1000 }, { rotateY: flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
  };
  const flipBack = {
    transform: [{ perspective: 1000 }, { rotateY: flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
  };

  useEffect(() => {
    fetchFlashcards(currentUser?.id).then((data) => {
      setDecks(data);
      setLoading(false);
    });
  }, [currentUser?.id]);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null;
  const orderedCards = selectedDeck ? order.map((id) => selectedDeck.cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c) : [];
  const card = orderedCards.length > 0 ? orderedCards[currentIndex] : selectedDeck?.cards[currentIndex] || null;

  const enterDeck = (deck: FlashcardDeck) => {
    setSelectedDeckId(deck.id);
    setOrder(shuffle(deck.cards.map((c) => c.id)));
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnim.setValue(0);
    setExplain(null);
  };

  const goNext = (deckId: string) => {
    setIsFlipped(false);
    flipAnim.setValue(0);
    setExplain(null);
    setCurrentIndex((i) => (i < orderedCards.length - 1 ? i + 1 : 0));
  };

  const goPrev = (deckId: string) => {
    setIsFlipped(false);
    flipAnim.setValue(0);
    setExplain(null);
    setCurrentIndex((i) => (i > 0 ? i - 1 : orderedCards.length - 1));
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
    flipAnim.setValue(0);
    setExplain(null);
  };

  if (loading) return <LoadingView label="Loading flashcards..." />;

  // ---------------- PLAYER ----------------
  if (selectedDeck && card) {
    const deckId = selectedDeck.id;

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
            <Badge text={`Card ${currentIndex + 1} / ${orderedCards.length}`} color={colors.primary} />
          </View>
        </View>

        {/* Flip card */}
        <TouchableOpacity activeOpacity={0.9} onPress={flipCard} style={[styles.flipPress, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.flipFace, flipFront, isFlipped && styles.hiddenFace]}>
              <View style={styles.faceWrap}>
                <Text style={[styles.faceLabel, { color: colors.mutedForeground }]}>Question</Text>
                <Text style={[styles.faceText, { color: colors.foreground }]}>{card.question}</Text>
                {card.topicTag && <Badge text={card.topicTag} color={colors.primary} />}
                <View style={styles.tapHint}>
                  <RotateCw size={13} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Tap card to flip</Text>
                </View>
              </View>
            </Animated.View>
            <Animated.View style={[styles.flipFace, { backgroundColor: colors.primary }, flipBack, !isFlipped && styles.hiddenFace]}>
              <View style={styles.faceWrap}>
                <Text style={[styles.faceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Answer</Text>
                <Text style={[styles.faceText, { color: '#fff' }]}>{card.answer}</Text>
                <View style={styles.tapHint}>
                  <RotateCw size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Tap card to flip back</Text>
                </View>
              </View>
            </Animated.View>
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
          <Text style={styles.bannerTitle}>Flashcard Decks</Text>
        </View>
      </View>

      {decks.length === 0 ? (
        <EmptyState icon={<Layers size={36} color={colors.mutedForeground} />} title="No flashcard decks yet" subtitle="Generate flashcards from your materials in the AI assistant." />
      ) : (
        <View style={{ gap: 12 }}>
          {decks.map((d) => {
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
                    {d.subjectName ? <Text style={{ color: colors.primary, fontSize: 11 }}>{d.subjectName}</Text> : null}
                  </View>
                </View>
                <View style={styles.deckMeta}>
                  <Badge text={`${d.cards.length} Cards`} color={colors.primary} />
                </View>
                <View style={styles.deckActions}>
                  <PrimaryButton label="Start Studying" onPress={() => enterDeck(d)} style={{ flex: 1 }} />
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
  playerWrap: { padding: 16, paddingBottom: 40, gap: 18, flexGrow: 1 },
  playerHead: { gap: 10 },
  playerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flipPress: { flex: 1, minHeight: 320, borderWidth: 1, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 9 },
  flipFace: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hiddenFace: { opacity: 0 },
  faceWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 26, borderRadius: 28 },
  faceLabel: { position: 'absolute', top: 24, left: 26, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  faceText: { fontSize: 21, lineHeight: 29, fontWeight: '600', textAlign: 'center', maxWidth: '90%' },
  tapHint: { position: 'absolute', bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  explainZone: { minHeight: 40, justifyContent: 'center' },
  explainBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  explainBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  navCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});