import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ContractorTimesheetsPage from "./ContractorTimesheetsPage";
import contractorTimesheetService from "../services/contractorTimesheetService";
import contractorProjectService from "../services/contractorProjectService";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ title, children }) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock("../services/contractorTimesheetService", () => ({
  default: {
    listMyTimesheets: vi.fn(),
    submitTimesheet: vi.fn(),
    submitTimesheets: vi.fn(),
    updateTimesheet: vi.fn(),
  },
}));

vi.mock("../services/contractorProjectService", () => ({
  default: {
    listAssignedProjects: vi.fn(),
  },
}));

const mockProjects = [
  {
    id: 1,
    project_name: "Atlas Commerce Modernization",
    project_status: "ACTIVE",
    assignment_status: "ACTIVE",
    allocated_hours: 120,
    approved_hours: 80,
    pending_hours: 10,
    remaining_hours: 30,
  },
];

const mockTimesheets = [
  {
    id: 1,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-14",
    hours_logged: 5,
    description: "Checkout flow optimizations",
    status: "APPROVED",
    submitted_at: "2026-09-14 18:00:00",
    reviewed_at: "2026-09-14 20:00:00",
    reviewer_name: "Sarah PM",
  },
  {
    id: 2,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-15",
    hours_logged: 3,
    description: "Payment webhook fix",
    status: "SUBMITTED",
    submitted_at: "2026-09-15 17:30:00",
    reviewed_at: null,
    reviewer_name: null,
  },
  {
    id: 3,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-16",
    hours_logged: 2,
    description: "Draft work on cart",
    status: "DRAFT",
    submitted_at: null,
    reviewed_at: null,
    reviewer_name: null,
  },
  {
    id: 4,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-17",
    hours_logged: 4,
    description: "Bug hunting",
    status: "REJECTED",
    submitted_at: "2026-09-17 16:00:00",
    reviewed_at: "2026-09-17 18:00:00",
    reviewer_name: "Sarah PM",
    rejection_reason: "Please provide tickets referenced.",
  },
];

describe("ContractorTimesheetsPage Redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractorProjectService.listAssignedProjects.mockResolvedValue(mockProjects);
    contractorTimesheetService.listMyTimesheets.mockResolvedValue({
      items: mockTimesheets,
      total_weeks: 1,
      total_pages: 1,
      page: 1,
      page_size: 5,
    });
  });

  it("renders page header actions, allocation bar, and summary metric chips", async () => {
    render(<ContractorTimesheetsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Timesheets", level: 1 })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Submit visible drafts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log Hours/i })).toBeInTheDocument();

    // Allocation bar
    expect(screen.getByText("Atlas Commerce Modernization")).toBeInTheDocument();
    expect(screen.getByText(/Allocated:/)).toBeInTheDocument();
    expect(screen.getByText("120h")).toBeInTheDocument();

    // Metric chips in the weekly card
    expect(screen.getByText("Total:")).toBeInTheDocument();
    expect(screen.getByText("14h")).toBeInTheDocument();
    expect(screen.getAllByText("Approved:")).toHaveLength(2);
    expect(screen.getAllByText("5h")).toHaveLength(2);
    expect(screen.getAllByText("Pending:")).toHaveLength(2);
    expect(screen.getByText("Rejected:")).toBeInTheDocument();
    expect(screen.getByText("4h")).toBeInTheDocument();
  });

  it("renders Edit button ONLY for DRAFT and REJECTED rows, and empty action cell for SUBMITTED and APPROVED rows", async () => {
    render(<ContractorTimesheetsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Checkout flow optimizations").length).toBeGreaterThan(0);
    });

    // In desktop table, 2 edit buttons: one for DRAFT row, one for REJECTED row
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    expect(editButtons).toHaveLength(2);

    const approvedRow = screen.getAllByText("Checkout flow optimizations")[0].closest("tr");
    const submittedRow = screen.getAllByText("Payment webhook fix")[0].closest("tr");
    const draftRow = screen.getAllByText("Draft work on cart")[0].closest("tr");
    const rejectedRow = screen.getAllByText("Bug hunting")[0].closest("tr");

    // DRAFT row has Edit button
    const draftEditBtn = within(draftRow).getByRole("button", { name: "Edit" });
    expect(draftEditBtn).toBeInTheDocument();

    // REJECTED row has Edit button
    const rejectedEditBtn = within(rejectedRow).getByRole("button", { name: "Edit" });
    expect(rejectedEditBtn).toBeInTheDocument();

    // APPROVED and SUBMITTED rows have NO edit buttons
    expect(within(approvedRow).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(submittedRow).queryByRole("button", { name: "Edit" })).toBeNull();

    // Click draft edit button -> opens EditLogModal with 'Edit Draft Log'
    fireEvent.click(draftEditBtn);
    expect(screen.getByRole("heading", { name: "Edit Draft Log" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Edit Draft Log" })).not.toBeInTheDocument();

    // Click rejected edit button -> opens EditLogModal with 'Edit Rejected Log'
    fireEvent.click(rejectedEditBtn);
    expect(screen.getByRole("heading", { name: "Edit Rejected Log" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resubmit" })).toBeInTheDocument();
  });

  it("renders week-wise pagination summary and controls", async () => {
    contractorTimesheetService.listMyTimesheets.mockResolvedValueOnce({
      items: mockTimesheets,
      total_weeks: 12,
      total_pages: 3,
      page: 1,
      page_size: 5,
    });

    render(<ContractorTimesheetsPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–5 of 12 weeks")).toBeInTheDocument();
    });

    expect(contractorTimesheetService.listMyTimesheets).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 5,
      })
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });

  it("handles singular week pagination summary correctly", async () => {
    contractorTimesheetService.listMyTimesheets.mockResolvedValueOnce({
      items: mockTimesheets,
      total_weeks: 1,
      total_pages: 1,
      page: 1,
      page_size: 5,
    });

    render(<ContractorTimesheetsPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1 of 1 week")).toBeInTheDocument();
    });
  });

  it("correctly renders final-page range using total_weeks when navigating to last page", async () => {
    // Page 1 initial render
    contractorTimesheetService.listMyTimesheets.mockResolvedValueOnce({
      items: mockTimesheets,
      total_weeks: 12,
      total_pages: 3,
      page: 1,
      page_size: 5,
    });

    render(<ContractorTimesheetsPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–5 of 12 weeks")).toBeInTheDocument();
    });

    // Page 2 response on clicking Next
    contractorTimesheetService.listMyTimesheets.mockResolvedValueOnce({
      items: mockTimesheets,
      total_weeks: 12,
      total_pages: 3,
      page: 2,
      page_size: 5,
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Showing 6–10 of 12 weeks")).toBeInTheDocument();
    });

    // Page 3 (final page) response on clicking Next
    contractorTimesheetService.listMyTimesheets.mockResolvedValueOnce({
      items: mockTimesheets,
      total_weeks: 12,
      total_pages: 3,
      page: 3,
      page_size: 5,
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Showing 11–12 of 12 weeks")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
