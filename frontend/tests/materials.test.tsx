import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssignSubjectModal } from "../src/pages/learning/materials/AssignSubjectModal";
import { MaterialDeleteDialog } from "../src/pages/learning/materials/MaterialDeleteDialog";
import type { LearningMaterial } from "../src/types";

const material = {
  id: "mat-1",
  title: "Cell Biology Notes",
  subjectId: "sub-1",
  materialType: "course",
  createdAt: "2026-01-01T00:00:00.000Z",
} as LearningMaterial;

describe("materials modals", () => {
  it("renders assign-subject options and disabled confirm without a selection", () => {
    render(
      <AssignSubjectModal
        material={material}
        subjects={[
          { id: "sub-1", code: "BIO101", name: "Biology" },
          { id: "sub-2", code: "CHEM101", name: "Chemistry" },
        ]}
        selectedSubjectId=""
        assigning={false}
        onSubjectIdChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Assign Course Subject")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "BIO101 - Biology" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Subject" })).toBeDisabled();
  });

  it("shows the material title in the delete confirmation", () => {
    render(
      <MaterialDeleteDialog material={material} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByText("Delete Learning Material?")).toBeInTheDocument();
    expect(screen.getByText(/"Cell Biology Notes" will be permanently removed/)).toBeInTheDocument();
  });
});
