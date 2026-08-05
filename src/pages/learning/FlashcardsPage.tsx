import React, { useState, useEffect, useCallback } from "react";
import { Layers, RotateCw, ArrowLeft, ArrowRight, Flame, Smile, Meh, Frown, CheckCircle2, Sparkles } from "lucide-react";
import type { FlashcardDeck, Flashcard } from "../../types";
import { useAuth } from "../../context/AuthContext";

export const FlashcardsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [streak, setStreak] = useState(5);
  const [ratedCount, setRatedCount] = useState(0);
  const [ratings, setRatings] = useState<Record<string, "easy" | "good" | "hard">>({});

  useEffect(() => {
    let isSubscribed = true;
    const fetchDecks = async () => {
      try {
        const res = await fetch(`/api/flashcards?userId=${currentUser?.id || ""}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setDecks(data);
            if (data.length > 0 && !activeDeck) setActiveDeck(data[0]);
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
  }, [activeDeck, currentUser?.id]);

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

  const handleRateCard = (rating: "easy" | "good" | "hard") => {
    if (!activeCard) return;
    setRatings((prev) => ({ ...prev, [activeCard.id]: rating }));
    setRatedCount((prev) => prev + 1);

    if (rating === "easy" || rating === "good") {
      setStreak((prev) => prev + 1);
    } else {
      setStreak((prev) => Math.max(0, prev - 1));
    }

    handleNext();
  };

  const activeCard: Flashcard | undefined = activeDeck?.cards[cardIndex];
  const totalCards = activeDeck?.cards.length || 0;
  const progressPercent = totalCards > 0 ? Math.round(((cardIndex + 1) / totalCards) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50/50 border border-indigo-200/80 text-slate-900 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-950 dark:border-indigo-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Active Memory Recall Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Interactive Flashcard Deck</h1>
          <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xl leading-relaxed">
            Click card or press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/20 rounded font-mono text-[10px] text-slate-800 dark:text-white">Spacebar</kbd> to flip. Rate your recall difficulty to optimize active memory.
          </p>
        </div>

        {/* Streak, Rated Count & Deck Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2 px-3 py-2 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-300 text-xs font-bold">
            <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>{streak} Day Streak! ({ratedCount} Reviewed)</span>
          </div>

          <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700/80">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Active Deck</label>
            <select
              value={activeDeck?.id || ""}
              onChange={(e) => {
                const d = decks.find((dk) => dk.id === e.target.value);
                if (d) {
                  setActiveDeck(d);
                  setCardIndex(0);
                  setIsFlipped(false);
                }
              }}
              className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.cards.length} cards)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Flashcard Interactive Area */}
      {activeDeck && activeCard ? (
        <div className="space-y-6">
          {/* Deck Header & Progress Bar */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>
                Subject: <strong className="text-foreground">{activeDeck.subjectName}</strong>
              </span>
              <span className="font-mono text-primary font-bold">
                Card {cardIndex + 1} of {totalCards}
              </span>
              <div className="flex items-center gap-2">
                {ratings[activeCard.id] && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                    {ratings[activeCard.id]}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  Topic: {activeCard.topicTag || "General Concepts"}
                </span>
              </div>
            </div>

            {/* Mastery Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Deck Progress</span>
                <span className="text-primary">{progressPercent}% Completed</span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
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
                  <span className="uppercase text-[10px] tracking-wider font-bold text-primary flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>QUESTION SIDE</span>
                  </span>
                  <span className="text-primary font-bold text-xs flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Click or Spacebar to flip</span>
                  </span>
                </div>

                <div className="my-auto text-center px-4 space-y-3">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest">Front Card</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                    {activeCard.question}
                  </h2>
                </div>

                <div className="text-center text-[11px] text-muted-foreground font-medium">
                  StudyLens AI • Active Memory Recall
                </div>
              </div>

              {/* BACK SIDE (Answer) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 p-8 flex flex-col justify-between rounded-2xl bg-primary/5 dark:bg-card border border-primary/20">
                <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                  <span className="uppercase text-[10px] tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ANSWER SIDE</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Self-assess below</span>
                </div>

                <div className="my-auto text-center px-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Key Concept Answer</p>
                  <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
                    {activeCard.answer}
                  </p>
                </div>

                <div className="text-center text-[11px] text-muted-foreground font-medium">
                  StudyLens AI • Rate recall difficulty to schedule review
                </div>
              </div>
            </div>
          </div>

          {/* Self Rating Buttons & Navigation */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-foreground">How easily did you recall this answer?</p>
              <p className="text-[11px] text-muted-foreground">Self-rating trains the adaptive spacing algorithm</p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <button
                onClick={() => handleRateCard("hard")}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition-all"
              >
                <Frown className="w-5 h-5" />
                <span>Hard (Review Soon)</span>
              </button>

              <button
                onClick={() => handleRateCard("good")}
                className="p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition-all"
              >
                <Meh className="w-5 h-5" />
                <span>Good (Optimal)</span>
              </button>

              <button
                onClick={() => handleRateCard("easy")}
                className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition-all"
              >
                <Smile className="w-5 h-5" />
                <span>Easy (Mastered)</span>
              </button>
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                onClick={handlePrev}
                disabled={cardIndex === 0}
                className="px-4 py-2 bg-muted hover:bg-accent text-foreground disabled:opacity-40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => {
                  setCardIndex(0);
                  setIsFlipped(false);
                }}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
              >
                Reset Deck
              </button>

              <button
                onClick={handleNext}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-card rounded-2xl border border-border">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">No flashcards found in this deck.</p>
        </div>
      )}
    </div>
  );
};
