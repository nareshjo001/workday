import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import VendorHomePage from "./VendorHomePage";
import vendorClientService from "../services/vendorClientService";
import vendorDashboardService from "../services/vendorDashboardService";

vi.mock("../services/vendorClientService", () => ({
  default: { list: vi.fn(), detail: vi.fn() },
}));

vi.mock("../services/vendorDashboardService", () => ({
  default: { getDashboard: vi.fn() },
}));

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ children }) => <main>{children}</main>,
}));

vi.mock("../components/dashboard/DashboardExports", () => ({
  default: ({ filters }) => <output data-testid="export-filter-scope">{JSON.stringify(filters)}</output>,
}));

const dashboard = {
  summary: { active_projects: 901, active_contractors: 902, total_earnings: 903, completed_projects: 904 },
  invoices: { draft_count: 1, draft_total: 100, submitted_count: 2, submitted_total: 200, pending_review_count: 0, approved_count: 3, approved_total: 900, rejected_count: 1, rejected_total: 50, total_invoiced_amount: 1250 },
  earnings_by_company: [{ company_name: "Global Client", total: 900 }],
  earnings_by_contractor: [{ contractor_id: 1, contractor_name: "Global Contractor", total: 900 }],
  project_progress: [{ id: 10, name: "Global Project", company_name: "Global Client", approved_hours: 50, expected_hours: 100, work_progress_percent: 50 }],
  recent_activity: [{ type: "ASSIGNED", message: "Global activity", occurred_at: "2026-09-01T00:00:00Z" }],
  m20: {
    workforce: { active_contractors: 4, open_requirements: 2 },
    candidates: { pending_reviews: 1 },
    time: { approved_hours: 12 },
    financial: {
      active_projects: 3,
      completed_projects: 2,
      approved_earnings_amount: 1250,
      billable_uninvoiced_amount: 200,
      paid_amount: 700,
      outstanding_amount: 550,
      overdue_amount: 50,
      margin: null,
    },
  },
};

const filteredDashboard = {
  ...dashboard,
  invoices: { draft_count: 0, draft_total: 0, submitted_count: 1, submitted_total: 75, pending_review_count: 0, approved_count: 1, approved_total: 425, rejected_count: 0, rejected_total: 0, total_invoiced_amount: 500 },
  earnings_by_company: [{ company_name: "Acme Client", total: 425 }],
  earnings_by_contractor: [{ contractor_id: 7, contractor_name: "Acme Specialist", total: 425 }],
  project_progress: [{ id: 31, name: "ERP Modernization", company_name: "Acme Client", approved_hours: 25, expected_hours: 50, work_progress_percent: 50 }],
  recent_activity: [{ type: "ASSIGNED", message: "Acme Specialist assigned to ERP Modernization", occurred_at: "2026-09-02T00:00:00Z" }],
  m20: {
    ...dashboard.m20,
    workforce: { ...dashboard.m20.workforce, active_contractors: 1 },
    financial: {
      ...dashboard.m20.financial,
      active_projects: 1,
      completed_projects: 0,
      approved_earnings_amount: 425,
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vendorDashboardService.getDashboard.mockImplementation((filters = {}) => (
    Promise.resolve(filters.clientId ? filteredDashboard : dashboard)
  ));
  vendorClientService.list.mockResolvedValue({ items: [{ id: 7, name: "Acme Client" }] });
  vendorClientService.detail.mockResolvedValue({
    company: { id: 7, name: "Acme Client" },
    active_projects: [{ id: 31, name: "ERP Modernization" }],
  });
});

test("loads authorized display options and keeps exports on the applied dashboard scope", async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  expect(await screen.findByRole("option", { name: "Acme Client" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: "ERP Modernization" })).toBeInTheDocument();
  expect(screen.queryByLabelText(/skill/i)).not.toBeInTheDocument();
  expect(screen.getByText("Active Projects").closest(".ui-stat")).toHaveTextContent("3");
  expect(screen.getByText("Active Contractors").closest(".ui-stat")).toHaveTextContent("4");
  expect(screen.getByText("Total Contractor Earnings").closest(".ui-stat")).toHaveTextContent("$1,250.00");
  expect(screen.getByText("Completed Projects").closest(".ui-stat")).toHaveTextContent("2");
  expect(screen.queryByText("901")).not.toBeInTheDocument();
  expect(screen.queryByText("902")).not.toBeInTheDocument();
  expect(screen.queryByText("$903.00")).not.toBeInTheDocument();
  expect(screen.queryByText("904")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Project"), { target: { value: "31" } });
  fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "ACTIVE" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  const expectedScope = { clientId: "7", projectId: "31", status: "ACTIVE" };
  await waitFor(() => expect(vendorDashboardService.getDashboard).toHaveBeenCalledWith(expectedScope));
  expect(screen.getByTestId("export-filter-scope")).toHaveTextContent(JSON.stringify(expectedScope));
  await waitFor(() => expect(screen.getByText("Active Projects").closest(".ui-stat")).toHaveTextContent("1"));
  expect(screen.getByText("Active Contractors").closest(".ui-stat")).toHaveTextContent("1");
  expect(screen.getByText("Total Contractor Earnings").closest(".ui-stat")).toHaveTextContent("$425.00");
  expect(screen.getByText("Completed Projects").closest(".ui-stat")).toHaveTextContent("0");
  expect(screen.getAllByText("Acme Client").length).toBeGreaterThan(0);
  expect(screen.getByText("Acme Specialist")).toBeInTheDocument();
  expect(screen.getByText("ERP Modernization", { selector: "span" })).toBeInTheDocument();
  expect(screen.getByText("Acme Specialist assigned to ERP Modernization")).toBeInTheDocument();
  expect(screen.queryByText("Global Contractor")).not.toBeInTheDocument();
  expect(screen.queryByText("Global Project")).not.toBeInTheDocument();
  expect(screen.queryByText("Global activity")).not.toBeInTheDocument();
  expect(screen.getByText("Submitted").closest("div")).toHaveTextContent("1");
  expect(screen.getByText("Approved", { selector: "span" }).closest("div")).toHaveTextContent("$425.00");
  expect(screen.getByText("Applied scope:").parentElement).toHaveTextContent("Client: Acme Client");
  expect(screen.getByText("Applied scope:").parentElement).toHaveTextContent("Project: ERP Modernization");
  expect(screen.getByText("Applied scope:").parentElement).toHaveTextContent("Status: ACTIVE");

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(vendorDashboardService.getDashboard).toHaveBeenCalledWith({}));
  expect(screen.getByTestId("export-filter-scope")).toHaveTextContent("{}");
  expect(screen.getByText("Applied scope:").parentElement).toHaveTextContent("All dashboard data");
});
