import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import ContractorHomePage from "./ContractorHomePage";
import contractorDashboardService from "../services/contractorDashboardService";

vi.mock("../services/contractorDashboardService", () => ({ default: { getDashboard: vi.fn() } }));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));

const fixture = {
  summary: { total_approved_hours: 12 },
  active_projects: [
    { id: 1, name: "Demo Platform Upgrade", company_name: "Atlas Commerce", remaining_hours: 28, work_progress_percent: 10, project_approved_hours: 12, expected_hours: 120 },
  ],
  m20: {
    assignments: { active_assignments: 1, upcoming_assignments: 0, allocated_hours: 40 },
    timesheets: { submitted_hours: 5, approved_hours: 12, rejected_action_items: 0 },
    compliance: { expiring_documents: 1 },
  },
  hours_trend: [
    { period: "2026-08-31", hours: 16 },
    { period: "2026-09-07", hours: 2 },
  ],
  timesheet_summary: { pending: 2, approved: 2, rejected: 0, total_submitted_hours: 17 },
};

beforeEach(() => {
  vi.clearAllMocks();
  contractorDashboardService.getDashboard.mockResolvedValue(fixture);
});

const renderPage = () => render(<MemoryRouter><ContractorHomePage /></MemoryRouter>);

test("renders three read-only summary cards with authoritative values and SVG icons", async () => {
  renderPage();
  const summary = await screen.findByRole("region", { name: "Contractor summary metrics" });
  const cards = within(summary).getAllByRole("article");

  expect(cards).toHaveLength(3);
  expect(within(summary).getByRole("article", { name: "Active Projects" })).toHaveTextContent("Active Projects1Projects you're assigned to");
  expect(within(summary).getByRole("article", { name: "Total Approved Hours" })).toHaveTextContent("Total Approved Hours12hAcross all projects");
  expect(within(summary).getByRole("article", { name: "Remaining Assigned Hours" })).toHaveTextContent("Remaining Assigned Hours28hAcross active assignments");
  expect(summary.querySelectorAll("svg")).toHaveLength(3);
  expect(within(summary).queryByRole("link")).toBeNull();
  expect(within(summary).queryByRole("button")).toBeNull();
  expect(summary).not.toHaveTextContent(">");
});

test("keeps all seven My work metrics in an explicit four-card row and three-card row", async () => {
  renderPage();
  await screen.findByRole("heading", { name: "My work" });

  const firstRow = screen.getByTestId("contractor-work-row-one");
  const secondRow = screen.getByTestId("contractor-work-row-two");
  expect(within(firstRow).getAllByRole("article")).toHaveLength(4);
  expect(within(secondRow).getAllByRole("article")).toHaveLength(3);

  for (const [label, value] of [
    ["Active assignments", "1"], ["Upcoming assignments", "0"], ["Allocated hours", "40h"], ["Submitted hours", "5h"],
    ["Approved hours", "12h"], ["Needs correction", "0"], ["Documents expiring", "1"],
  ]) {
    expect(screen.getByRole("article", { name: label })).toHaveTextContent(`${label}${value}`);
  }
  expect(firstRow.querySelectorAll("svg")).toHaveLength(4);
  expect(secondRow.querySelectorAll("svg")).toHaveLength(3);
  await waitFor(() => expect(contractorDashboardService.getDashboard).toHaveBeenCalledTimes(1));
});

test("renders authoritative weekly trend points and derives the summary from those displayed buckets", async () => {
  renderPage();
  const chart = await screen.findByTestId("contractor-hours-chart");

  expect(screen.getByRole("heading", { name: "Hours Trend" })).toBeInTheDocument();
  expect(screen.getByText("Approved hours per week", { selector: ".contractor-hours-heading p" })).toBeInTheDocument();
  expect(within(chart).getByRole("img", { name: "Approved hours per week" })).toBeInTheDocument();
  expect(within(chart).getByLabelText("Approved hours legend")).toHaveTextContent("Approved hours");
  expect(chart).toHaveTextContent("Aug 31–Sep 6");
  expect(chart).toHaveTextContent("Sep 7–Sep 13");
  expect(chart.querySelectorAll(".contractor-hours-marker")).toHaveLength(2);

  const trendSummary = screen.getByLabelText("Hours trend summary");
  expect(within(trendSummary).getAllByRole("article")).toHaveLength(3);
  expect(within(trendSummary).getByRole("article", { name: "Total (period)" })).toHaveTextContent("Total (period)18h");
  expect(within(trendSummary).getByRole("article", { name: "Highest week" })).toHaveTextContent("Highest week16hAug 31–Sep 6");
  expect(within(trendSummary).getByRole("article", { name: "Lowest week" })).toHaveTextContent("Lowest week2hSep 7–Sep 13");
  expect(screen.queryByRole("button", { name: /date|range|calendar/i })).toBeNull();
});

test("does not invent trend summary values when no approved weekly buckets are returned", async () => {
  contractorDashboardService.getDashboard.mockResolvedValue({ ...fixture, hours_trend: [] });
  renderPage();

  expect(await screen.findByText("No approved hours data available.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Hours trend summary")).toBeNull();
});

test("uses the shared primary progress color for the hours capsule without changing the project percentage", async () => {
  renderPage();

  await screen.findByText("Demo Platform Upgrade");
  const hoursBadge = screen.getByText("12h of 120h");
  expect(hoursBadge).toHaveClass("bg-primary", "text-primary-foreground");
  expect(hoursBadge).not.toHaveTextContent("completed");
  expect(screen.getByText("completed")).not.toHaveClass("bg-primary");
  expect(screen.getByText("10%")).toBeInTheDocument();

  const progress = screen.getByRole("progressbar");
  expect(progress).toHaveAttribute("aria-valuenow", "10");
  expect(progress.firstElementChild).toHaveClass("bg-primary");
  expect(progress.firstElementChild).toHaveStyle({ width: "10%" });
});

test("renders Current Project Progress immediately before Hours Trend", async () => {
  renderPage();

  const projectProgress = await screen.findByRole("heading", { name: "Current Project Progress" });
  const hoursTrend = screen.getByRole("heading", { name: "Hours Trend" });
  const projectSection = projectProgress.parentElement?.parentElement?.parentElement;
  expect(projectSection?.nextElementSibling).toBe(hoursTrend.closest("section"));
});

test("renders the four read-only timesheet summary metrics from the existing response", async () => {
  renderPage();

  expect(await screen.findByRole("heading", { name: "Timesheet Summary" })).toBeInTheDocument();
  expect(screen.getByText("Overview of your submitted timesheets.")).toBeInTheDocument();
  const grid = screen.getByTestId("contractor-timesheet-summary-grid");
  const cards = within(grid).getAllByRole("article");
  expect(cards).toHaveLength(4);
  expect(within(grid).getByRole("article", { name: "Pending" })).toHaveTextContent("Pending2");
  expect(within(grid).getByRole("article", { name: "Approved" })).toHaveTextContent("Approved2");
  expect(within(grid).getByRole("article", { name: "Rejected" })).toHaveTextContent("Rejected0");
  expect(within(grid).getByRole("article", { name: "Total Submitted" })).toHaveTextContent("Total Submitted17h");
  expect(grid.querySelectorAll("svg")).toHaveLength(4);
  expect(within(grid).queryByRole("link")).toBeNull();
  expect(within(grid).queryByRole("button")).toBeNull();
});
