import React, { useState, useEffect, useCallback } from "react";
import { Layers, RotateCw, ArrowLeft, ArrowRight, Shuffle, CheckCircle2, Trash2 } from "lucide-react";
import type { FlashcardDeck, Flashcard } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { Pagination, slicePage } from "../../components/Pagination";

export const FlashcardsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffled, setShuffled] = useState<Flashcard[] | null>(null);
  const [confirmDeleteDeckId, setConfirmDeleteDeckId] = useState<string | null>(null);
  const [deckPage, setDeckPage] = useState(1);

  useEffect(() => {
    setShuffled(null);
    setCardIndex(0);
    setIsFlipped(false);
  }, [activeDeck?.id]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchDecks = async () => {
      try {
        const res = await authFetch(`/api/flashcards?userId=${currentUser?.id || ""}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setDecks(data);
          }
        }
      } catch (err) {
        console.error("Fetch decks error:", err);
      }
    };

    fetchDecks();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id]);

  const toggleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (!activeDeck) return;
    setIsFlipped(false);
    if (cardIndex < activeDeck.cards.length - 1) {
      setCardIndex((prev) => prev + 1);
    } else {
      setCardIndex(0);
    }
  }, [activeDeck, cardIndex]);

  const handlePrev = useCallback(() => {
    if (!activeDeck) return;
    setIsFlipped(false);
    if (cardIndex > 0) {
      setCardIndex((prev) => prev - 1);
    }
  }, [activeDeck, cardIndex]);

  const handleShuffle = useCallback(() => {
    if (!activeDeck) return;
    const copy = [...activeDeck.cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setShuffled(copy);
    setCardIndex(0);
    setIsFlipped(false);
  }, [activeDeck]);

  // Handle Spacebar key for card flipping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        toggleFlip();
      } else if (e.code === "ArrowRight") {
        handleNext();
      } else if (e.code === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFlip, handleNext, handlePrev]);

  const handleDeleteDeck = async (deckId: string) => {
    try {
      const res = await authFetch(`/api/flashcards/${deckId}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = decks.filter((d) => d.id !== deckId);
        setDecks(remaining);
        if (activeDeck?.id === deckId) {
          setActiveDeck(null);
          setCardIndex(0);
          setIsFlipped(false);
        }
        setConfirmDeleteDeckId(null);
        showToast("Deck deleted.");
      }
    } catch (err) {
      console.error("Delete deck error:", err);
      showToast("Could not delete the deck. Please try again.", "error");
    }
  };

  const enterDeck = (deck: FlashcardDeck) => {
    setActiveDeck(deck);
    setCardIndex(0);
    setIsFlipped(false);
    setShuffled(null);
  };

  const viewCards: Flashcard[] = shuffled ?? activeDeck?.cards ?? [];
  const activeCard: Flashcard | undefined = viewCards[cardIndex];
  const totalCards = viewCards.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Library view — list of existing decks, user chooses which to study (mobile parity) */}
      {!activeDeck ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground">Flashcard Decks</h2>
              <p className="text-xs text-muted-foreground">{decks.length} deck{decks.length === 1 ? "" : "s"} available — choose a deck to start studying.</p>
            </div>
          </div>

          {decks.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-2xl border border-border">
              <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">No flashcard decks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Generate flashcards from your materials in the AI assistant.</p>
            </div>
          ) : (
            <>
            <div className="grid gap-4">
              {slicePage(decks, deckPage).map((d) => (
                <div key={d.id} className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{d.title}</h3>
                      {d.subjectName && <p className="text-xs text-primary font-semibold truncate">{d.subjectName}</p>}
                    </div>
                    {(currentUser?.role === "teacher" || currentUser?.role === "admin" || d.createdById === currentUser?.id) &&
                      (confirmDeleteDeckId === d.id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDeleteDeck(d.id)}
                            className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteDeckId(null)}
                            className="px-2 py-1.5 bg-muted text-foreground rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteDeckId(d.id)}
                          title="Delete deck"
                          className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      {d.cards.length} Cards
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => enterDeck(d)}
                      className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Start Studying
                    </button>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value === "study") enterDeck(d);
                      }}
                      className="hidden"
                    >
                      <option value="">Choose</option>
                      <option value="study">Study</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={deckPage}
              total={decks.length}
              onPageChange={setDeckPage}
            />
            </>
          )}
        </div>
      ) : activeCard ? (
        <div className="space-y-6">
          {/* Deck Header & Progress Bar */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setActiveDeck(null)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted transition-all shrink-0"
                  title="Back to decks"
                >
                  <ArrowLeft className="w-4 h-4 text-foreground" />
                </button>
                <h2 className="text-sm font-bold text-foreground truncate flex-1">{activeDeck.title}</h2>
                <span className="text-muted-foreground whitespace-nowrap text-xs">{activeDeck.subjectName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  value={activeDeck.id}
                  onChange={(e) => {
                    const d = decks.find((dk) => dk.id === e.target.value);
                    if (d) {
                      setActiveDeck(d);
                      setCardIndex(0);
                      setIsFlipped(false);
                    }
                  }}
                  className="bg-card text-foreground border border-border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.cards.length} cards)
                    </option>
                  ))}
                </select>

                {(currentUser?.role === "teacher" ||
                  currentUser?.role === "admin" ||
                  activeDeck.createdById === currentUser?.id) && (
                  <div>
                    {confirmDeleteDeckId === activeDeck.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteDeck(activeDeck.id)}
                          className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteDeckId(null)}
                          className="px-2 py-1.5 bg-muted text-foreground rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteDeckId(activeDeck.id)}
                        title="Delete active deck"
                        className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Deck</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="font-mono text-primary font-bold whitespace-nowrap">
                Card {cardIndex + 1} / {totalCards}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                Topic: {activeCard.topicTag || "General Concepts"}
              </span>
            </div>
          </div>

          {/* 3D Flip Card Container */}
          <div
            onClick={toggleFlip}
            className="w-full h-80 perspective-1000 cursor-pointer select-none group"
          >
            <div
              className={`relative w-full h-full rounded-2xl border-2 transition-transform duration-500 transform-style-3d shadow-xl ${
                isFlipped ? "rotate-y-180 border-primary bg-card" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {/* FRONT SIDE (Question) */}
              <div className="absolute inset-0 backface-hidden p-8 flex flex-col justify-between rounded-2xl bg-card">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase text-[10px] tracking-wider font-bold text-primary">Question</span>
                  <span className="text-primary font-bold text-xs flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Click to flip</span>
                  </span>
                </div>

                <div className="my-auto text-center px-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                    {activeCard.question}
                  </h2>
                </div>

                <div className="text-xs" />
              </div>

              {/* BACK SIDE (Answer) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 p-8 flex flex-col justify-between rounded-2xl bg-primary/5 dark:bg-card border border-primary/20">
                <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                  <span className="uppercase text-[10px] tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Answer</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Click to flip back</span>
                </div>

                <div className="my-auto text-center px-4">
                  <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
                    {activeCard.answer}
                  </p>
                </div>

                <div className="text-xs" />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handlePrev}
                disabled={cardIndex === 0}
                className="px-4 py-2 bg-muted hover:bg-accent text-foreground disabled:opacity-40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShuffle}
                  className="px-3 py-2 bg-muted hover:bg-accent text-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  title="Shuffle to a random card"
                >
                  <Shuffle className="w-4 h-4" />
                  <span className="hidden sm:inline">Shuffle</span>
                </button>
                <button
                  onClick={() => {
                    setCardIndex(0);
                    setIsFlipped(false);
                  }}
                  className="px-3 py-2 bg-muted hover:bg-accent text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Deck
                </button>
              </div>

              <button
                onClick={handleNext}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center pt-3">
              <button
                onClick={() => setActiveDeck(null)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold underline"
              >
                Back to Deck List
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-card rounded-2xl border border-border">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">No flashcards found in this deck.</p>
          <button onClick={() => setActiveDeck(null)} className="mt-3 text-xs text-primary font-semibold hover:underline">
            Back to Decks
          </button>
        </div>
      )}
    </div>
  );
};
