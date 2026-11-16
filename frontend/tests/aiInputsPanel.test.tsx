import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiInputsPanel } from "../src/pages/ai/AiInputsPanel";
import type { AIStudyAssistantController } from "../src/pages/ai/useAIStudyAssistant";

afterEach(cleanup);

function makeAssistant(mode: "quiz" | "summary" | "flashcards"): AIStudyAssistantController {
  return {
    promptInputRef: { current: null },
    sourceText: "",
    setSourceText: vi.fn(),
    prompt: "",
    setPrompt: vi.fn(),
    mode,
    uploadedFile: null,
    setUploadedFile: vi.fn(),
    uploadedFileName: null,
    setUploadedFileName: vi.fn(),
    isUploadingFile: false,
    uploadSuccessMsg: null,
    setUploadSuccessMsg: vi.fn(),
    flashcardCount: "5",
    setFlashcardCount: vi.fn(),
    quizCounts: { multiple_choice: "", identification: "", true_false: "" },
    setQuizCounts: vi.fn(),
    isGenerating: false,
    offlineNotice: false,
    offlineReason: "",
    showAttachMenu: false,
    setShowAttachMenu: vi.fn(),
    setSelectedMaterialId: vi.fn(),
    handleModeSelect: vi.fn(),
    handleCancelGenerate: vi.fn(),
    handleDirectFileUpload: vi.fn(),
    handleGenerate: vi.fn(),
  } as unknown as AIStudyAssistantController;
}

describe("AiInputsPanel", () => {
  it("shows per-format count inputs only for quiz mode", () => {
    const { rerender } = render(<AiInputsPanel assistant={makeAssistant("quiz")} />);

    expect(screen.getByText("Questions by Type")).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(3);
    expect(
      screen.queryByPlaceholderText(/5 multiple choice/i)
    ).not.toBeInTheDocument();

    rerender(<AiInputsPanel assistant={makeAssistant("summary")} />);
    expect(screen.queryByText("Questions by Type")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("caps quiz and flashcard counts at 50", () => {
    const { rerender } = render(<AiInputsPanel assistant={makeAssistant("quiz")} />);

    const quizInputs = screen.getAllByRole("spinbutton");
    expect(quizInputs).toHaveLength(3);
    quizInputs.forEach((input) => expect(input).toHaveAttribute("max", "50"));
    expect(screen.getByText(/maximum 50 total/i)).toBeInTheDocument();

    rerender(<AiInputsPanel assistant={makeAssistant("flashcards")} />);
    const flashcardInput = screen.getByRole("spinbutton");
    expect(flashcardInput).toHaveAttribute("max", "50");
    expect(screen.getByText(/maximum 50 flashcards/i)).toBeInTheDocument();
  });
});
