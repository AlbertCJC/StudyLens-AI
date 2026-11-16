import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiResultView } from "../src/pages/ai/AiResultView";
import type { AIGeneratedResult } from "../src/utils/aiWorkspaceCache";

describe("AiResultView", () => {
  it("renders a summary with its executive summary and takeaways", () => {
    const output = {
      title: "Cell Summary",
      executiveSummary: "Cells are the basic unit of life.",
      keyTakeaways: ["Mitochondria produce ATP", "DNA stores genetic information"],
    } as AIGeneratedResult;

    render(<AiResultView mode="summary" output={output} />);

    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Cells are the basic unit of life.")).toBeInTheDocument();
    expect(screen.getByText("Mitochondria produce ATP")).toBeInTheDocument();
  });

  it("renders quiz choices and the correct explanation", () => {
    const output = {
      title: "Cell Quiz",
      questions: [
        {
          question: "Which organelle produces ATP?",
          options: ["Nucleus", "Mitochondria"],
          correctAnswer: 1,
          explanation: "Mitochondria are the powerhouse of the cell.",
        },
      ],
    } as AIGeneratedResult;

    render(<AiResultView mode="quiz" output={output} />);

    expect(screen.getByText("Which organelle produces ATP?")).toBeInTheDocument();
    expect(screen.getByText("B. Mitochondria")).toBeInTheDocument();
    expect(screen.getByText(/Mitochondria are the powerhouse/)).toBeInTheDocument();
  });
});
