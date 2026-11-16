import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlashcardDeck } from "../src/types";
import { DeleteFlashcardDeckModal } from "../src/pages/learning/DeleteFlashcardDeckModal";

afterEach(cleanup);

const deck: FlashcardDeck = {
  id: "deck-1",
  title: "Cell Biology",
  cards: [
    { id: "card-1", question: "What is a cell?", answer: "Basic unit of life." },
  ],
  subjectName: "Biology",
};

describe("DeleteFlashcardDeckModal", () => {
  it("shows deck details and confirmation actions", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeleteFlashcardDeckModal deck={deck} busy={false} onClose={onClose} onConfirm={onConfirm} />
    );

    expect(screen.getByText(/Delete Flashcard Deck/i)).toBeInTheDocument();
    expect(screen.getByText("Cell Biology")).toBeInTheDocument();
    expect(screen.getByText("1 card · Biology")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((button) => button.textContent?.includes("Delete Deck")) as HTMLButtonElement;
    expect(deleteButton).toBeInstanceOf(HTMLButtonElement);
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("calls onClose on cancel and Escape", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeleteFlashcardDeckModal deck={deck} busy={false} onClose={onClose} onConfirm={onConfirm} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("calls onConfirm and disables buttons while busy", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeleteFlashcardDeckModal deck={deck} busy={true} onClose={onClose} onConfirm={onConfirm} />
    );

    const deleteButton = screen.getByText("Deleting...").closest("button") as HTMLButtonElement;
    fireEvent.click(deleteButton);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });
});
