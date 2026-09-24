import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PmTimesheetsPage from "./PmTimesheetsPage";
import pmTimesheetService from "../services/pmTimesheetService";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ title, children }) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock("../services/pmTimesheetService", () => ({
  default: {
    listPending: vi.fn(),
    reviewTimesheet: vi.fn(),
    bulkReviewTimesheets: vi.fn(),
  },
}));

const mockTimesheets = [
  {
    id: 101,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    contractor_id: 201,
    contractor_name: "Quinn QA",
    contractor_skill: "QA",
    work_date: "2026-09-02",
    hours_logged: 5,
    description: "End to end cart checkout testing",
    submitted_at: "2026-09-09 21:37:00",
  },
  {
    id: 102,
    project_id: 2,
    project_name: "Demo Platform Upgrade",
    contractor_id: 202,
    contractor_name: "Demo Contractor",
    contractor_skill: "BACKEND",
    work_date: "2026-09-05",
    hours_logged: 4,
    description: "Database migration script",
    submitted_at: "2026-09-11 21:45:00",
  },
  {
    id: 103,
    project_id: 2,
    project_name: "Demo Platform Upgrade",
    contractor_id: 202,
    contractor_name: "Demo Contractor",
    contractor_skill: "BACKEND",
    work_date: "2026-09-11",
    hours_logged: 1,
    description: "Fix schema index",
    submitted_at: "2026-09-11 21:48:00",
  },
];

describe("PmTimesheetsPage Enterprise Redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pmTimesheetService.listPending.mockResolvedValue({
      items: mockTimesheets,
      total: 3,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
  });

  it("renders page header, top intro hero card, KPI metrics, and filter bar", async () => {
    render(<PmTimesheetsPage />);

    expect(await screen.findByRole("heading", { name: "Timesheet Approvals" })).toBeInTheDocument();
    expect(
      screen.getByText("Review and approve contractor timesheets. Keep your projects on track.")
    ).toBeInTheDocument();
    expect(screen.getByText("Accurate approvals.")).toBeInTheDocument();
    expect(screen.getByText("On-time delivery.")).toBeInTheDocument();

    // 4 KPI Cards
    const metricsSection = screen.getByLabelText("Review Queue Metrics");
    expect(within(metricsSection).getByText("Total submissions")).toBeInTheDocument();
    expect(within(metricsSection).getByText("Pending review")).toBeInTheDocument();
    expect(within(metricsSection).getByText("Approved")).toBeInTheDocument();
    expect(within(metricsSection).getByText("Rejected")).toBeInTheDocument();
    expect(within(metricsSection).getByText("In review queue")).toBeInTheDocument();
    expect(within(metricsSection).getByText("Awaiting your action")).toBeInTheDocument();
    expect(within(metricsSection).getAllByText("Reviewed this session")).toHaveLength(2);

    // Filters
    expect(screen.getByLabelText("Filter by contractor")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by project")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by date range")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search timesheets...")).toBeInTheDocument();

    // Table rows
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();
    expect(within(table).getAllByText("Demo Contractor")).toHaveLength(2);
    expect(within(table).getByText("Atlas Commerce Modernization")).toBeInTheDocument();
    expect(screen.getByText("3 results")).toBeInTheDocument();
  });

  it("handles single approve action, updates KPI counts and removes row", async () => {
    pmTimesheetService.reviewTimesheet.mockResolvedValue({ id: 101, status: "APPROVED" });
    render(<PmTimesheetsPage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();

    const approveButtons = within(table).getAllByRole("button", { name: "Approve" });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(pmTimesheetService.reviewTimesheet).toHaveBeenCalledWith(101, "APPROVED", null);
    });

    expect(await screen.findByText("Timesheet approved.")).toBeInTheDocument();
    expect(within(table).queryByText("Quinn QA")).not.toBeInTheDocument();

    // Approved count incremented to 1 in KPI metrics section
    const metricsSection = screen.getByLabelText("Review Queue Metrics");
    const approvedCard = within(metricsSection).getByText("Approved").closest("div");
    expect(within(approvedCard).getByText("1")).toBeInTheDocument();
  });

  it("opens reject modal on reject click and requires reason to reject", async () => {
    pmTimesheetService.reviewTimesheet.mockResolvedValue({ id: 101, status: "REJECTED" });
    render(<PmTimesheetsPage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();

    const rejectButtons = within(table).getAllByRole("button", { name: "Reject" });
    fireEvent.click(rejectButtons[0]);

    // Modal opens
    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByText("Reject timesheet")).toBeInTheDocument();
    expect(within(modal).getByLabelText("Reason")).toBeInTheDocument();

    // Attempting empty submit shows error
    const submitRejectBtn = within(modal).getByRole("button", { name: "Reject" });
    fireEvent.click(submitRejectBtn);
    expect(await screen.findByText("A rejection reason is required.")).toBeInTheDocument();

    // Enter reason and confirm
    fireEvent.change(within(modal).getByLabelText("Reason"), {
      target: { value: "Hours mismatched with sprint log" },
    });
    fireEvent.click(submitRejectBtn);

    await waitFor(() => {
      expect(pmTimesheetService.reviewTimesheet).toHaveBeenCalledWith(
        101,
        "REJECTED",
        "Hours mismatched with sprint log"
      );
    });

    expect(await screen.findByText("Timesheet rejected.")).toBeInTheDocument();
    expect(within(table).queryByText("Quinn QA")).not.toBeInTheDocument();
  });

  it("supports bulk selection, toolbar display, and bulk approve", async () => {
    pmTimesheetService.bulkReviewTimesheets.mockResolvedValue([{ id: 101 }, { id: 102 }, { id: 103 }]);
    render(<PmTimesheetsPage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();

    const selectAllCheckbox = screen.getByLabelText("Select all timesheets");
    fireEvent.click(selectAllCheckbox);

    // Bulk toolbar appears
    expect(await screen.findByText("3 timesheets selected")).toBeInTheDocument();
    const bulkApproveBtn = screen.getByRole("button", { name: "Approve selected" });
    const bulkRejectBtn = screen.getByRole("button", { name: "Reject selected" });
    expect(bulkApproveBtn).toBeInTheDocument();
    expect(bulkRejectBtn).toBeInTheDocument();

    fireEvent.click(bulkApproveBtn);

    await waitFor(() => {
      expect(pmTimesheetService.bulkReviewTimesheets).toHaveBeenCalledWith(
        [101, 102, 103],
        "APPROVED",
        null
      );
    });

    expect(await screen.findByText("3 timesheets approved.")).toBeInTheDocument();
  });

  it("filters timesheets dynamically by contractor, skill, and search keyword", async () => {
    render(<PmTimesheetsPage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();

    // Filter by Contractor
    const contractorSelect = screen.getByLabelText("Filter by contractor");
    fireEvent.change(contractorSelect, { target: { value: "Quinn QA" } });

    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();
    expect(within(table).queryByText("Demo Contractor")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 3 results")).toBeInTheDocument();

    // Reset contractor and filter by skill
    fireEvent.change(contractorSelect, { target: { value: "" } });
    const skillSelect = screen.getByLabelText("Filter by skill");
    fireEvent.change(skillSelect, { target: { value: "BACKEND" } });

    expect(within(table).queryByText("Quinn QA")).not.toBeInTheDocument();
    expect(within(table).getAllByText("Demo Contractor")).toHaveLength(2);

    // Search query
    fireEvent.change(skillSelect, { target: { value: "" } });
    const searchInput = screen.getByPlaceholderText("Search timesheets...");
    fireEvent.change(searchInput, { target: { value: "Atlas" } });

    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();
    expect(within(table).queryByText("Demo Contractor")).not.toBeInTheDocument();
  });

  it("changes rows per page and triggers reload", async () => {
    render(<PmTimesheetsPage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Quinn QA")).toBeInTheDocument();

    const pageSizeSelect = screen.getByLabelText("Rows per page");
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });

    await waitFor(() => {
      expect(pmTimesheetService.listPending).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 25,
          page: 1,
        })
      );
    });
  });
});
