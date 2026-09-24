import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PmStaffingPipelinePage from "./PmStaffingPipelinePage";
import { getPmStaffingPipeline } from "../services/staffingPipelineService";
import candidateSubmissionService from "../services/candidateSubmissionService";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("../services/staffingPipelineService", () => ({
  getPmStaffingPipeline: vi.fn(),
}));

vi.mock("../services/candidateSubmissionService", () => ({
  default: {
    listForPm: vi.fn(),
    decide: vi.fn(),
  },
}));

const mockPipelineItem = {
  project_id: 1,
  project_name: "Atlas Commerce Modernization",
  company_id: 1,
  company_name: "Atlas Commerce",
  requirement_id: 1,
  skill: "FRONTEND",
  required_count: 3,
  assigned_count: 1,
  open_positions: 2,
  submitted_count: 1,
  shortlisted_count: 0,
  accepted_count: 0,
  rejected_count: 0,
  withdrawn_count: 0,
  open_candidate_count: 1,
  oldest_open_submitted_at: "2026-09-10T09:00:00Z",
  candidate_response_sla_hours: 48,
  due_at: "2026-09-12T09:00:00Z",
  sla_breached: false,
};

const mockCandidate = {
  id: 31,
  contractor_name: "Taylor Candidate",
  vendor_name: "Vendor One",
  project_name: "Atlas Commerce Modernization",
  skill: "FRONTEND",
  proposed_start_date: "2026-09-08",
  proposed_end_date: "2026-09-30",
  status: "SUBMITTED",
};

describe("PmStaffingPipelinePage UI and workflow", () => {
  it("renders clean unboxed page title, description, and KPI cards as first boxed content", async () => {
    getPmStaffingPipeline.mockResolvedValue({ items: [mockPipelineItem] });
    candidateSubmissionService.listForPm.mockResolvedValue([mockCandidate]);

    render(
      <MemoryRouter>
        <PmStaffingPipelinePage />
      </MemoryRouter>
    );

    // Clean page title and description directly in page content
    expect(await screen.findByRole("heading", { level: 1, name: "Staffing Pipeline" })).toBeInTheDocument();
    expect(
      screen.getByText("Review project openings, candidate decisions, and SLA attention.")
    ).toBeInTheDocument();

    // Summary KPI cards directly below heading
    const openPositions = (await screen.findByText("Open positions")).parentElement;
    const awaitingReview = (await screen.findByText("Candidates awaiting review")).parentElement;
    const slaBreaches = (await screen.findByText("SLA breaches")).parentElement;

    expect(within(openPositions).getByText("2")).toBeInTheDocument();
    expect(within(awaitingReview).getByText("1")).toBeInTheDocument();
    expect(within(slaBreaches).getByText("0")).toBeInTheDocument();

    // Filters row (Client filter is omitted for PM)
    expect(screen.getByLabelText("Filter by candidate status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by project")).toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by client")).not.toBeInTheDocument();
    expect(screen.getByLabelText("SLA breached only")).toBeInTheDocument();

    // Table columns and no chevron / arrow column
    const [staffingTable, candidateTable] = screen.getAllByRole("table");
    expect(within(staffingTable).getByText("Client / project")).toBeInTheDocument();
    expect(within(staffingTable).getByText("Skill")).toBeInTheDocument();
    expect(within(staffingTable).getByText("Open")).toBeInTheDocument();
    expect(within(staffingTable).getByText("Candidate funnel")).toBeInTheDocument();
    expect(within(staffingTable).getByText("Oldest review")).toBeInTheDocument();

    expect(within(staffingTable).queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(within(staffingTable).queryByRole("button", { name: />/ })).not.toBeInTheDocument();

    // Candidate review queue rendered below
    expect(screen.getByRole("heading", { level: 2, name: "Candidate review queue" })).toBeInTheDocument();
    expect(within(candidateTable).getByText("Taylor Candidate")).toBeInTheDocument();
    expect(screen.getByTestId("accept-candidate-31")).toBeInTheDocument();
    expect(screen.getByTestId("reject-candidate-31")).toBeInTheDocument();
  });

  it("handles candidate decision actions through the protected workflow", async () => {
    getPmStaffingPipeline.mockResolvedValue({ items: [mockPipelineItem] });
    candidateSubmissionService.listForPm.mockResolvedValue([mockCandidate]);
    candidateSubmissionService.decide.mockResolvedValue({});

    render(
      <MemoryRouter>
        <PmStaffingPipelinePage />
      </MemoryRouter>
    );

    const acceptBtn = await screen.findByTestId("accept-candidate-31");
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(candidateSubmissionService.decide).toHaveBeenCalledWith(31, "ACCEPTED", null);
    });
  });
});
