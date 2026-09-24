import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PmMilestonesPage from "./PmMilestonesPage";
import pmProjectService from "../services/pmProjectService";
import pmMilestoneService from "../services/pmMilestoneService";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ title, children }) => <div data-title={title}>{children}</div>,
}));

vi.mock("../services/pmProjectService", () => ({
  default: {
    listProjects: vi.fn(),
    listAssignedContractors: vi.fn(),
    updateContractorAllocation: vi.fn(),
    releaseContractor: vi.fn(),
  },
}));

vi.mock("../services/pmMilestoneService", () => ({
  default: {
    listMilestones: vi.fn(),
    createMilestone: vi.fn(),
  },
}));

const projects = [
  { id: 1, name: "Atlas Legacy Migration", approved_hours: 25, expected_hours: 80, allocated_hours: 0, work_progress_percent: 31.3 },
  { id: 2, name: "Atlas Mobile Expansion", approved_hours: 6, expected_hours: 100, allocated_hours: 40, work_progress_percent: 6 },
];

const contractors = [{
  contractor_id: 11,
  name: "Harper Backend",
  assignment_status: "RELEASED",
  allocated_hours: 80,
  approved_hours: 25,
  remaining_hours: 55,
}];

const milestones = [{
  id: 21,
  name: "Atlas Migration Completion",
  sequence_order: 1,
  due_date: "2026-06-30",
  description: "Historical completed-project billing.",
  threshold_hours: 20,
  status: "MET",
  met_at: "2026-09-09 12:00:00",
  contributions: [{ contractor_id: 11, contractor_name: "Harper Backend", approved_hours: 20, billing_amount: 5000 }],
}];

describe("PmMilestonesPage presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pmProjectService.listProjects.mockResolvedValue({ items: projects });
    pmProjectService.listAssignedContractors.mockResolvedValue(contractors);
    pmMilestoneService.listMilestones.mockResolvedValue(milestones);
  });

  it("renders the compact milestone view without changing authoritative values", async () => {
    render(<PmMilestonesPage />);

    expect(await screen.findByRole("heading", { name: "Milestones & Billing" })).toBeInTheDocument();
    expect(screen.getAllByText("Track project milestones, billing thresholds, and payment status.")).toHaveLength(2);
    expect(await screen.findAllByText("Harper Backend")).toHaveLength(2);
    expect(screen.getByText("Allocated 80h · Approved 25h · Remaining 55h")).toBeInTheDocument();
    expect(screen.getByText("31.3%")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Atlas Migration Completion")).toBeInTheDocument();
    expect(within(table).getByText("20 hrs")).toBeInTheDocument();
    expect(within(table).getByText("$5,000.00")).toBeInTheDocument();
    expect(within(table).getByText("Met")).toBeInTheDocument();
    expect(screen.queryByText(/Scroll horizontally to view all columns/i)).not.toBeInTheDocument();
  });

  it("preserves project switching and reloads the selected project's data", async () => {
    render(<PmMilestonesPage />);
    const selector = await screen.findByLabelText("Project");
    await waitFor(() => expect(pmMilestoneService.listMilestones).toHaveBeenCalledWith("1"));

    fireEvent.change(selector, { target: { value: "2" } });

    await waitFor(() => {
      expect(pmMilestoneService.listMilestones).toHaveBeenCalledWith("2");
      expect(pmProjectService.listAssignedContractors).toHaveBeenCalledWith("2");
    });
  });
});
