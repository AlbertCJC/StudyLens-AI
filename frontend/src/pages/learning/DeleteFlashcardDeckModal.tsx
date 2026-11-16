import { useEffect } from "react";
import { Layers, Trash2 } from "lucide-react";
import type { FlashcardDeck } from "../../types";

interface DeleteFlashcardDeckModalProps {
  deck: FlashcardDeck;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteFlashcardDeckModal({
  deck,
  busy,
  onClose,
  onConfirm,
}: DeleteFlashcardDeckModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${deck.title}`}
    >
      <div className="bg-card border border-border p-6 rounded-2xl max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Delete Flashcard Deck</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete this deck?
            </p>
          </div>
        </div>

        <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-foreground space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            {deck.title}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"}
            {deck.subjectName ? ` · ${deck.subjectName}` : ""}
          </p>
        </div>

        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
          Deleting this deck permanently removes all of its flashcards and saved study progress.
        </p>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{busy ? "Deleting..." : "Delete Deck"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
