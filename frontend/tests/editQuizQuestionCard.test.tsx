import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditQuizQuestionCard } from "../src/pages/learning/assessment/EditQuizQuestionCard";
import type { QuizQuestion } from "../src/types";

afterEach(cleanup);

const question: QuizQuestion = {
  id: "q-1",
  question: "Which organelle produces ATP?",
  type: "multiple_choice",
  options: ["Mitochondria", "Nucleus", "Ribosome", "Golgi"],
  correctAnswer: 0,
  explanation: "Mitochondria produce ATP.",
  bloomsLevel: "Remembering",
  difficulty: "easy",
  topicTag: "Cells",
};

describe("EditQuizQuestionCard", () => {
  it("does not treat Space in an option input as selecting the answer", () => {
    const onUpdate = vi.fn();

    render(
      <EditQuizQuestionCard
        question={question}
        index={0}
        promptRef={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByDisplayValue("Mitochondria"), { key: " " });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
