import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeneratedReport } from "../src/pages/reports/ReportsPage";
import { ReportsList } from "../src/pages/reports/ReportsList";

afterEach(cleanup);

const baseProps: Omit<Parameters<typeof ReportsList>[0], "children"> = {
  reports: [],
  filteredReports: [],
  reportsTotal: 0,
  loading: false,
  refreshing: false,
  reportsPage: 1,
  pageSize: 5,
  searchTerm: "",
  typeFilter: "all",
  hasFilters: false,
  onRefresh: vi.fn(),
  onSearchTermChange: vi.fn(),
  onTypeFilterChange: vi.fn(),
  onClearFilters: vi.fn(),
  onGenerateType: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onExport: vi.fn(),
  onDelete: vi.fn(),
  onPrevPage: vi.fn(),
  onNextPage: vi.fn(),
};

describe("ReportsList", () => {
  it("shows the global total rather than page-local count", () => {
    const reports: GeneratedReport[] = [
      { id: "r1", generatedBy: "u1", reportType: "Student Performance", title: "Report 1", generatedAt: "2026-01-01" },
      { id: "r2", generatedBy: "u1", reportType: "Quiz Analytics", title: "Report 2", generatedAt: "2026-01-02" },
    ];

    render(<ReportsList {...baseProps} reports={reports} filteredReports={reports} reportsTotal={17} />);

    expect(screen.getByText("Showing 2 of 17 reports")).toBeInTheDocument();
    expect(screen.queryByText(/generated reports/)).not.toBeInTheDocument();
    expect(screen.getByTitle("Reload the report list from the server")).toBeInTheDocument();
  });
});
