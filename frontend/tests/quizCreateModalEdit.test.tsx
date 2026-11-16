import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizCreateModal } from "../src/components/QuizCreateModal";

vi.mock("../src/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

afterEach(cleanup);

describe("QuizCreateModal draft questions", () => {
  it("lets a recently added question be edited in place", () => {
    render(
      <QuizCreateModal
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        subjects={[]}
        currentUserId="tea-1"
        currentUserName="Bob Teacher"
        canManageCourseQuizzes
        defaultScope="teacher"
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Type the question..."), {
      target: { value: "What is ATP?" },
    });

    ["Mitochondria", "Nucleus", "Ribosome", "Golgi"].forEach((value, index) => {
      fireEvent.change(
        screen.getByPlaceholderText(`Option ${String.fromCharCode(65 + index)}`),
        { target: { value } }
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Question" }));

    expect(screen.getByText(/1\. What is ATP\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Edit question"));

    expect(screen.getByPlaceholderText("Type the question...")).toHaveValue("What is ATP?");
    expect(screen.getByRole("button", { name: "Update Question" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type the question..."), {
      target: { value: "What is the powerhouse of the cell?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Question" }));

    expect(screen.queryByText(/1\. What is ATP\?/)).not.toBeInTheDocument();
    expect(screen.getByText(/1\. What is the powerhouse of the cell\?/)).toBeInTheDocument();
  });
});
