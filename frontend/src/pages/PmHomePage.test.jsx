import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import PmHomePage from "./PmHomePage";
import pmDashboardService from "../services/pmDashboardService";

vi.mock("../services/pmDashboardService", () => ({ default: { getDashboard: vi.fn() } }));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock("../components/dashboard/DashboardExports", () => ({ default: ({ filters }) => <output aria-label="Export scope">{JSON.stringify(filters)}</output> }));

const activity = (id) => ({ id, occurred_at: `2026-09-${String(14 - id).padStart(2, "0")}T12:42:00.000Z`, event: "TIMESHEET_SUBMITTED", actor: { display_name: "Demo Contractor", role: "CONTRACTOR" }, entity: { type: "TIMESHEET", id: String(id) }, title: `Timesheet submitted #${id}`, summary: `Demo Contractor submitted timesheet #${id}.`, details: [] });
const fixture = {
  summary: { active_projects: 7, active_contractors: 13, completed_projects: 3, pending_staffing_projects: 2, overall_progress_percent: 25.6 },
  projects: [], invoices: { pending_review_count: 2, approved_count: 5, approved_total: 456, rejected_count: 1, rejected_total: 78 },
  milestones: { pending: 4, met: 3, with_billing_generated: 2 },
  completion_analytics: { completed_projects: 3, average_completion_percent: 100, approaching_end_date_count: 1, past_end_date_still_active_count: 0 },
  m20: {
    time: { approved_hours: 123 },
    financial: {
      budget: 126000, submitted_invoice_amount: 1260, approved_invoice_amount: 22210,
      paid_amount: 2210, outstanding_amount: 20000, overdue_amount: 0, pending_invoice_reviews: 1,
    },
  },
  recent_activity: Array.from({ length: 6 }, (_, index) => activity(index + 1)),
};
beforeEach(() => { vi.clearAllMocks(); pmDashboardService.getDashboard.mockResolvedValue(fixture); });
const renderPage = () => render(<MemoryRouter><PmHomePage /></MemoryRouter>);

test("keeps project cards and project navigation out of the PM Overview", async () => {
  renderPage();
  await screen.findByText("25.6%");
  expect(screen.queryByRole("heading", { name: "Project Progress Overview" })).toBeNull();
  expect(screen.queryByTestId("pm-project-preview-grid")).toBeNull();
  expect(screen.queryByRole("link", { name: "View all projects" })).toBeNull();
});

test("renders authoritative summary values, real routes, and preserves lower sections", async () => {
  renderPage();
  await screen.findByText("25.6%");
  const summary = screen.getByRole("region", { name: "Project summary" });
  for (const [label, value] of [["Active Projects", "7"], ["Active Contractors", "13"], ["Completed Projects", "3"], ["Pending Staffing", "2"], ["Project Progress", "25.6%"]]) {
    expect(within(summary).getByRole("article", { name: label })).toHaveTextContent(value);
  }
  expect(within(summary).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25.6");
  expect(summary).not.toHaveTextContent(/last month|no change/i);
  const actions = screen.getByRole("navigation", { name: "Dashboard quick actions" });
  for (const [label, route] of [["Manage Projects", "projects"], ["Timesheet", "timesheets"], ["Milestones & Billing", "milestones"], ["Invoices", "invoices"]]) {
    expect(within(actions).getByRole("link", { name: label })).toHaveAttribute("href", `/pm/${route}`);
  }
  expect(within(actions).queryByRole("link", { name: "Vendor Access" })).toBeNull();
  expect(within(actions).getByRole("link", { name: "Manage Projects" }).querySelectorAll("svg rect")).toHaveLength(4);
  expect(screen.getByLabelText("Milestone counts")).toHaveTextContent("Pending4Met3Billed2");
  expect(screen.getByLabelText("Invoice counts")).toHaveTextContent("Pending Review2Approved5$456.00Rejected1$78.00");
  const completionMetrics = screen.getByLabelText("Completion metrics");
  expect(within(completionMetrics).getAllByRole("article")).toHaveLength(4);
  expect(within(completionMetrics).getByRole("heading", { name: "Completed" }).parentElement).toHaveTextContent("3Projects completed");
  expect(within(completionMetrics).getByRole("heading", { name: "Avg. Completion" }).parentElement).toHaveTextContent("100%Across active projects");
  expect(within(completionMetrics).getByRole("heading", { name: "Approaching End Date" }).parentElement).toHaveTextContent("1Within next 14 days");
  expect(within(completionMetrics).getByRole("heading", { name: "Past End Date, Still Active" }).parentElement).toHaveTextContent("0");
  const financialMetrics = screen.getByLabelText("Project financial metrics");
  expect(within(financialMetrics).getAllByRole("article")).toHaveLength(8);
  for (const [label, value, detail] of [
    ["Project budget", "$126,000.00", "Total allocated budget"],
    ["Approved work", "123h", "Approved timesheet hours"],
    ["Submitted invoices", "$1,260.00", "Awaiting review"],
    ["Approved invoices", "$22,210.00", "Approved invoice amount"],
    ["Paid", "$2,210.00", "Payments recorded"],
    ["Outstanding", "$20,000.00", "Approved invoices unpaid"],
    ["Overdue", "$0.00", "Past due approved balance"],
    ["Pending invoice reviews", "1", "Submitted invoices"],
  ]) {
    expect(within(financialMetrics).getByRole("article", { name: label })).toHaveTextContent(`${label}${value}${detail}`);
  }
  const activityPreview = screen.getByTestId("pm-activity-preview");
  expect(within(activityPreview).getAllByRole("listitem")).toHaveLength(5);
  const previewRows = within(activityPreview).getAllByRole("listitem");
  expect(previewRows[0]).toHaveTextContent("Timesheet submitted #1");
  expect(previewRows[4]).toHaveTextContent("Timesheet submitted #5");
  expect(screen.getByRole("link", { name: "View all activity" })).toHaveAttribute("href", "/pm/activity");
  expect(activityPreview.querySelectorAll(".vendor-activity-icon svg")).toHaveLength(5);
  for (const name of ["Hours Progress", "Milestone Overview", "Invoice Overview", "Completion Analytics", "Project financials", "Recent Activity"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Project Progress Overview" })).toBeNull();
  expect(pmDashboardService.getDashboard).toHaveBeenCalledWith({});
});

test.each([null, 0, 100])("progress %s preserves missing, zero, and completed states", async (percent) => {
  pmDashboardService.getDashboard.mockResolvedValue({ ...fixture, summary: { ...fixture.summary, overall_progress_percent: percent } });
  renderPage();
  await waitFor(() => expect(screen.getByRole("region", { name: "Project summary" })).toHaveAttribute("aria-busy", "false"));
  const card = screen.getByRole("article", { name: "Project Progress" });
  expect(card).toHaveTextContent(percent === null ? "—" : `${percent}%`);
  if (percent === null) expect(within(card).queryByRole("progressbar")).toBeNull();
  else expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(percent));
});

test("retains the real date filter and export scope", async () => {
  renderPage();
  await screen.findByText("25.6%");
  const toolsToggle = screen.getByRole("button", { name: "Filters & exports" });
  const toolsContent = screen.getByTestId("pm-filters-content");
  expect(toolsToggle).toHaveAttribute("aria-expanded", "false");
  expect(toolsContent).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(toolsToggle);
  expect(toolsToggle).toHaveAttribute("aria-expanded", "true");
  expect(toolsContent).toHaveClass("is-expanded");
  expect(toolsContent).toHaveAttribute("aria-hidden", "false");
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() => expect(pmDashboardService.getDashboard).toHaveBeenLastCalledWith({ startDate: "2026-09-01", endDate: "2026-09-30" }));
  expect(screen.getByLabelText("Export scope")).toHaveTextContent('"startDate":"2026-09-01"');
});
