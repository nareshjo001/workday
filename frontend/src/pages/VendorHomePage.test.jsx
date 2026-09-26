import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  project_progress: [{ id: 10, name: "Global Project", company_name: "Global Client", status: "ACTIVE", approved_hours: 50, expected_hours: 100, work_progress_percent: 50 }],
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
  project_progress: [{ id: 31, name: "ERP Modernization", company_name: "Acme Client", status: "ACTIVE", approved_hours: 25, expected_hours: 50, work_progress_percent: 50 }],
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

test("loads authorized display options and keeps exports on the applied dashboard scope", { timeout: 30000 }, async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  fireEvent.click(screen.getByRole("button", { name: /Filters & exports/i }));

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

function project(id, status = "ACTIVE") {
  return {
    id,
    name: `Project ${id}`,
    company_name: `Client ${id}`,
    status,
    approved_hours: id * 10,
    expected_hours: 100,
    work_progress_percent: id * 10,
  };
}

function activity(id) {
  return {
    type: "ASSIGNED",
    message: `Activity ${id}`,
    occurred_at: `2026-09-${String(20 - id).padStart(2, "0")} 00:00:00`,
  };
}

function company(id) {
  return { company_name: `Company ${id}`, total: 1000 - id };
}

function contractor(id) {
  return { contractor_id: id, contractor_name: `Contractor ${id}`, total: 1000 - id };
}

function useDashboard(overrides) {
  vendorDashboardService.getDashboard.mockResolvedValue({ ...dashboard, ...overrides });
}

test("shows every project when the applied scope has no more than three", async () => {
  useDashboard({ project_progress: [project(1), project(2)] });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const preview = await screen.findByTestId("vendor-project-preview");
  expect(within(preview).getByText("Project 1")).toBeInTheDocument();
  expect(within(preview).getByText("Project 2")).toBeInTheDocument();
  expect(within(preview).getAllByRole("progressbar")).toHaveLength(2);
  expect(preview.querySelectorAll(".vendor-project-status")).toHaveLength(2);
  expect(within(preview).getByText("10h / 100h")).toBeInTheDocument();
  expect(within(preview).getByText("10%")).toBeInTheDocument();
  expect(preview).not.toHaveTextContent(/hh/);
  expect(screen.queryByRole("link", { name: /View all projects/ })).not.toBeInTheDocument();
});

test("limits Project Progress to ACTIVE rows and keeps the KPI status scope consistent", async () => {
  useDashboard({
    project_progress: [
      { ...project(1), name: "Nova Analytics Platform" },
      project(2, "ON_HOLD"),
      { ...project(3), name: "Atlas Commerce Modernization" },
      project(4, "COMPLETED"),
      project(5, "COMPLETED"),
      { ...project(6), name: "Demo Platform Upgrade" },
      project(7, "CANCELLED"),
    ],
  });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const preview = await screen.findByTestId("vendor-project-preview");
  expect(within(preview).getAllByRole("progressbar")).toHaveLength(3);
  expect(within(preview).getByText("Nova Analytics Platform")).toBeInTheDocument();
  expect(within(preview).getByText("Atlas Commerce Modernization")).toBeInTheDocument();
  expect(within(preview).getByText("Demo Platform Upgrade")).toBeInTheDocument();
  expect(within(preview).queryByText("Project 2")).not.toBeInTheDocument();
  expect(within(preview).queryByText("Project 4")).not.toBeInTheDocument();
  expect(within(preview).queryByText("Project 5")).not.toBeInTheDocument();
  expect(within(preview).queryByText("Project 7")).not.toBeInTheDocument();
  expect(screen.getByText("Active Projects").closest(".ui-stat")).toHaveTextContent("3");
  expect(screen.queryByRole("button", { name: "Show all projects" })).not.toBeInTheDocument();
});

test("shows a clean empty state when the applied scope contains no ACTIVE projects", async () => {
  useDashboard({ project_progress: [project(1, "ON_HOLD"), project(2, "COMPLETED"), project(3, "CANCELLED")] });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  expect(await screen.findByText("No active projects to display.")).toBeInTheDocument();
  expect(screen.queryByTestId("vendor-project-preview")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show all projects" })).not.toBeInTheDocument();
});

test("expands and collapses seven ACTIVE projects without exposing historical rows", async () => {
  useDashboard({
    project_progress: [
      ...Array.from({ length: 7 }, (_, index) => project(index + 1)),
      project(8, "ON_HOLD"),
      project(9, "COMPLETED"),
      project(10, "CANCELLED"),
    ],
  });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const preview = await screen.findByTestId("vendor-project-preview");
  expect(within(preview).getAllByRole("progressbar")).toHaveLength(3);
  expect(within(preview).getByText("Project 4").closest(".vendor-collapsible-extra")).toHaveAttribute("aria-hidden", "true");
  const expand = screen.getByRole("button", { name: "Show all projects" });
  expect(expand).not.toHaveTextContent(/\d/);
  expect(expand).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(expand);
  expect(within(preview).getAllByRole("progressbar")).toHaveLength(7);
  expect(within(preview).getByText("Project 7")).toBeInTheDocument();
  expect(within(preview).queryByText("Project 8")).not.toBeInTheDocument();
  expect(within(preview).queryByText("Project 9")).not.toBeInTheDocument();
  expect(within(preview).queryByText("Project 10")).not.toBeInTheDocument();
  expect(within(preview).getByText("Project 4").closest(".vendor-collapsible-extra")).toHaveAttribute("aria-hidden", "false");
  const collapse = screen.getByRole("button", { name: "Show fewer projects" });
  expect(collapse).toHaveAttribute("aria-expanded", "true");
  expect(collapse).toHaveTextContent("Show less");

  fireEvent.click(collapse);
  expect(within(preview).getAllByRole("progressbar")).toHaveLength(3);
  expect(within(preview).getByText("Project 4").closest(".vendor-collapsible-extra")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByRole("heading", { name: "Project Progress" })).toBeInTheDocument();
});

test("expands and collapses five companies inside Highest Pay", async () => {
  useDashboard({ earnings_by_company: Array.from({ length: 5 }, (_, index) => company(index + 1)) });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const list = await screen.findByTestId("vendor-company-earnings");
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(list.querySelector(".vendor-bar-gradient--blue")).toBeInTheDocument();
  const expand = screen.getByRole("button", { name: "Show all companies" });
  expect(expand).not.toHaveTextContent(/\d/);
  fireEvent.click(expand);
  expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Show fewer companies" }));
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
});

test("expands and collapses ten contractors inside the earnings card", async () => {
  useDashboard({ earnings_by_contractor: Array.from({ length: 10 }, (_, index) => contractor(index + 1)) });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const list = await screen.findByTestId("vendor-contractor-earnings");
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(list.querySelector(".vendor-bar-gradient--green")).toBeInTheDocument();
  const expand = screen.getByRole("button", { name: "Show all contractors" });
  expect(expand).not.toHaveTextContent(/\d/);
  fireEvent.click(expand);
  expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Show fewer contractors" }));
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
});

test("keeps project, company, and contractor expansion state independent", async () => {
  useDashboard({
    project_progress: Array.from({ length: 7 }, (_, index) => project(index + 1)),
    earnings_by_company: Array.from({ length: 5 }, (_, index) => company(index + 1)),
    earnings_by_contractor: Array.from({ length: 10 }, (_, index) => contractor(index + 1)),
  });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  await screen.findByTestId("vendor-project-preview");
  fireEvent.click(screen.getByRole("button", { name: "Show all projects" }));
  expect(screen.getByRole("button", { name: "Show fewer projects" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Show all companies" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Show all contractors" })).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(screen.getByRole("button", { name: "Show all companies" }));
  expect(screen.getByRole("button", { name: "Show fewer projects" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Show fewer companies" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Show all contractors" })).toHaveAttribute("aria-expanded", "false");
});

test("uses the same collapsed-height contract for short and expandable earnings cards", async () => {
  useDashboard({
    earnings_by_company: [company(1), company(2)],
    earnings_by_contractor: Array.from({ length: 10 }, (_, index) => contractor(index + 1)),
  });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const companyList = await screen.findByTestId("vendor-company-earnings");
  const contractorList = screen.getByTestId("vendor-contractor-earnings");
  const companyCard = companyList.parentElement;
  const contractorCard = contractorList.parentElement;
  expect(companyCard).toHaveClass("vendor-earnings-card", "is-collapsed");
  expect(contractorCard).toHaveClass("vendor-earnings-card", "is-collapsed");
  expect(screen.queryByRole("button", { name: "Show all companies" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show all contractors" })).not.toHaveTextContent(/\d/);
});

test("shows the latest five activity rows with line icons and navigates to full Activity", async () => {
  useDashboard({ recent_activity: Array.from({ length: 10 }, (_, index) => activity(index + 1)) });
  render(
    <MemoryRouter initialEntries={["/vendor"]}>
      <Routes>
        <Route path="/vendor" element={<VendorHomePage />} />
        <Route path="/vendor/activity" element={<p>Full activity page</p>} />
      </Routes>
    </MemoryRouter>,
  );

  const preview = await screen.findByTestId("vendor-activity-preview");
  const items = within(preview).getAllByRole("listitem");
  expect(items).toHaveLength(5);
  expect(items[0]).toHaveTextContent("Activity 1");
  expect(items[4]).toHaveTextContent("Activity 5");
  expect(within(preview).queryByText("Activity 6")).not.toBeInTheDocument();
  expect(preview.querySelectorAll(".vendor-activity-icon svg")).toHaveLength(5);
  expect(screen.queryByRole("button", { name: /activity/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("link", { name: "View all activity" }));
  expect(await screen.findByText("Full activity page")).toBeInTheDocument();
});

test("shows every available activity when the dataset has five or fewer", async () => {
  useDashboard({ recent_activity: [activity(1), activity(2), activity(3)] });
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const preview = await screen.findByTestId("vendor-activity-preview");
  expect(within(preview).getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("link", { name: "View all activity" })).toHaveAttribute("href", "/vendor/activity");
});

test("keeps every invoice and commercial value with non-color semantic indicators", async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const invoiceMetrics = await screen.findByTestId("vendor-invoice-metrics");
  for (const label of ["Draft", "Submitted", "Legacy Pending", "Approved", "Rejected", "Total Invoiced"]) {
    expect(within(invoiceMetrics).getByText(label)).toBeInTheDocument();
  }
  expect(within(invoiceMetrics).getByText("$1,250.00")).toBeInTheDocument();
  expect(invoiceMetrics.querySelectorAll(".vendor-metric-label i")).toHaveLength(6);

  const commercialMetrics = screen.getByTestId("vendor-commercial-metrics");
  for (const label of ["Approved work", "Billable, uninvoiced", "Paid", "Outstanding", "Overdue", "Open requirements", "Pending reviews", "Snapshot margin"]) {
    expect(within(commercialMetrics).getByText(label)).toBeInTheDocument();
  }
  expect(within(commercialMetrics).getByText("$700.00")).toBeInTheDocument();
  expect(commercialMetrics.querySelectorAll(".vendor-metric-label i")).toHaveLength(8);
});

test("Test A: starts with Filters & exports panel collapsed and accessible attributes set", async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const toggle = screen.getByRole("button", { name: /Filters & exports/i });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveAttribute("aria-controls", "vendor-filters-panel");
  expect(toggle).toHaveTextContent("+");

  const panel = screen.getByTestId("vendor-filters-content");
  expect(panel).toHaveAttribute("id", "vendor-filters-panel");
  expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(panel).not.toHaveClass("is-expanded");
});

test("Test B: expanding reveals filter controls and changes indicator to minus", async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const toggle = screen.getByRole("button", { name: /Filters & exports/i });
  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveTextContent("−");

  const panel = screen.getByTestId("vendor-filters-content");
  expect(panel).toHaveAttribute("aria-hidden", "false");
  expect(panel).toHaveClass("is-expanded");

  expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  expect(screen.getByTestId("export-filter-scope")).toBeInTheDocument();
});

test("Test C: collapsing hides content and updates indicator back to plus", async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const toggle = screen.getByRole("button", { name: /Filters & exports/i });

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveTextContent("+");

  const panel = screen.getByTestId("vendor-filters-content");
  expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(panel).not.toHaveClass("is-expanded");
});

test("Test D: filter scope badges and values update properly when expanded", async () => {
  render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

  const toggle = screen.getByRole("button", { name: /Filters & exports/i });
  fireEvent.click(toggle);

  expect(screen.getByText("All dashboard data")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "ACTIVE" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await waitFor(() => {
    expect(screen.getByText("Status: ACTIVE")).toBeInTheDocument();
  });
});

describe("Vendor Overview Earnings Cards", () => {
  const makeCompanies = (count) =>
    Array.from({ length: count }, (_, i) => ({
      company_name: `Company ${i + 1}`,
      total: 1000 * (i + 1),
    }));

  const makeContractors = (count) =>
    Array.from({ length: count }, (_, i) => ({
      contractor_id: i + 1,
      contractor_name: `Contractor ${i + 1}`,
      total: 500 * (i + 1),
    }));

  test("1+1 row rendering: renders single row per card without expand buttons", async () => {
    vendorDashboardService.getDashboard.mockResolvedValueOnce({
      ...dashboard,
      earnings_by_company: makeCompanies(1),
      earnings_by_contractor: makeContractors(1),
    });

    render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

    expect(await screen.findByText("Highest Pay by Company")).toBeInTheDocument();
    expect(screen.getByText("Contractor Earnings Breakdown")).toBeInTheDocument();

    const companyCard = screen.getByTestId("vendor-company-earnings").closest(".vendor-earnings-card");
    const contractorCard = screen.getByTestId("vendor-contractor-earnings").closest(".vendor-earnings-card");

    expect(companyCard).toHaveClass("is-collapsed");
    expect(contractorCard).toHaveClass("is-collapsed");

    expect(within(companyCard).getByText("Company 1")).toBeInTheDocument();
    expect(within(contractorCard).getByText("Contractor 1")).toBeInTheDocument();

    expect(within(companyCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
    expect(within(contractorCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  test("mixed 1+2 row rendering: renders 1 company and 2 contractors without expand controls", async () => {
    vendorDashboardService.getDashboard.mockResolvedValueOnce({
      ...dashboard,
      earnings_by_company: makeCompanies(1),
      earnings_by_contractor: makeContractors(2),
    });

    render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

    expect(await screen.findByText("Highest Pay by Company")).toBeInTheDocument();
    const companyCard = screen.getByTestId("vendor-company-earnings").closest(".vendor-earnings-card");
    const contractorCard = screen.getByTestId("vendor-contractor-earnings").closest(".vendor-earnings-card");

    expect(within(companyCard).getByText("Company 1")).toBeInTheDocument();
    expect(within(contractorCard).getByText("Contractor 1")).toBeInTheDocument();
    expect(within(contractorCard).getByText("Contractor 2")).toBeInTheDocument();

    expect(within(companyCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
    expect(within(contractorCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  test("mixed 2+3 row rendering: renders 2 companies and 3 contractors naturally", async () => {
    vendorDashboardService.getDashboard.mockResolvedValueOnce({
      ...dashboard,
      earnings_by_company: makeCompanies(2),
      earnings_by_contractor: makeContractors(3),
    });

    render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

    expect(await screen.findByText("Highest Pay by Company")).toBeInTheDocument();
    const companyCard = screen.getByTestId("vendor-company-earnings").closest(".vendor-earnings-card");
    const contractorCard = screen.getByTestId("vendor-contractor-earnings").closest(".vendor-earnings-card");

    expect(within(companyCard).getByText("Company 1")).toBeInTheDocument();
    expect(within(companyCard).getByText("Company 2")).toBeInTheDocument();
    expect(within(contractorCard).getByText("Contractor 1")).toBeInTheDocument();
    expect(within(contractorCard).getByText("Contractor 2")).toBeInTheDocument();
    expect(within(contractorCard).getByText("Contractor 3")).toBeInTheDocument();

    expect(within(companyCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
    expect(within(contractorCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  test(">3 row collapsed rendering: displays preview of 3 rows and renders expand control", async () => {
    vendorDashboardService.getDashboard.mockResolvedValueOnce({
      ...dashboard,
      earnings_by_company: makeCompanies(8),
      earnings_by_contractor: makeContractors(1),
    });

    render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

    expect(await screen.findByText("Highest Pay by Company")).toBeInTheDocument();
    const companyCard = screen.getByTestId("vendor-company-earnings").closest(".vendor-earnings-card");
    const contractorCard = screen.getByTestId("vendor-contractor-earnings").closest(".vendor-earnings-card");

    expect(companyCard).toHaveClass("is-collapsed");
    expect(contractorCard).toHaveClass("is-collapsed");

    expect(within(companyCard).getByText("Company 1")).toBeInTheDocument();
    expect(within(companyCard).getByText("Company 2")).toBeInTheDocument();
    expect(within(companyCard).getByText("Company 3")).toBeInTheDocument();
    expect(within(companyCard).getByRole("button", { name: "Show all companies" })).toBeInTheDocument();

    expect(within(contractorCard).getByText("Contractor 1")).toBeInTheDocument();
    expect(within(contractorCard).queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  test("independent expanded state and collapse restoration", async () => {
    vendorDashboardService.getDashboard.mockResolvedValueOnce({
      ...dashboard,
      earnings_by_company: makeCompanies(1),
      earnings_by_contractor: makeContractors(8),
    });

    render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

    expect(await screen.findByText("Contractor Earnings Breakdown")).toBeInTheDocument();
    const earningsGrid = screen.getByTestId("vendor-company-earnings").closest(".vendor-earnings-grid");
    const companyCard = screen.getByTestId("vendor-company-earnings").closest(".vendor-earnings-card");
    const contractorCard = screen.getByTestId("vendor-contractor-earnings").closest(".vendor-earnings-card");

    expect(companyCard).toHaveClass("is-collapsed");
    expect(contractorCard).toHaveClass("is-collapsed");
    expect(earningsGrid).not.toHaveClass("earnings-grid--expanded");

    const expandBtn = within(contractorCard).getByRole("button", { name: "Show all contractors" });
    fireEvent.click(expandBtn);

    expect(contractorCard).toHaveClass("is-expanded");
    expect(companyCard).toHaveClass("is-collapsed");
    expect(earningsGrid).toHaveClass("earnings-grid--expanded");
    expect(earningsGrid).toHaveClass("is-any-expanded");

    expect(within(contractorCard).getByText("Contractor 8")).toBeInTheDocument();

    const collapseBtn = within(contractorCard).getByRole("button", { name: "Show fewer contractors" });
    fireEvent.click(collapseBtn);

    expect(contractorCard).toHaveClass("is-collapsed");
    expect(earningsGrid).not.toHaveClass("earnings-grid--expanded");
  });
});

describe("Vendor Overview KPI Card Icons", () => {
  test("renders clean SVG icons and no emojis for the four KPI cards", async () => {
    render(<MemoryRouter><VendorHomePage /></MemoryRouter>);

    expect(await screen.findByText("Active Projects")).toBeInTheDocument();

    const projectsIcon = screen.getByTestId("kpi-icon-projects");
    const contractorsIcon = screen.getByTestId("kpi-icon-contractors");
    const earningsIcon = screen.getByTestId("kpi-icon-earnings");
    const completedIcon = screen.getByTestId("kpi-icon-completed");

    expect(projectsIcon).toBeInTheDocument();
    expect(projectsIcon.tagName.toLowerCase()).toBe("svg");
    expect(contractorsIcon).toBeInTheDocument();
    expect(contractorsIcon.tagName.toLowerCase()).toBe("svg");
    expect(earningsIcon).toBeInTheDocument();
    expect(earningsIcon.tagName.toLowerCase()).toBe("svg");
    expect(completedIcon).toBeInTheDocument();
    expect(completedIcon.tagName.toLowerCase()).toBe("svg");

    const kpiRow = projectsIcon.closest(".vendor-overview-kpis");
    expect(kpiRow).not.toBeNull();
    expect(kpiRow.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(kpiRow.textContent).not.toContain("📁");
    expect(kpiRow.textContent).not.toContain("👥");
    expect(kpiRow.textContent).not.toContain("💰");
    expect(kpiRow.textContent).not.toContain("✅");
  });
});
