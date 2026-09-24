import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContractorProjectsPage from "./ContractorProjectsPage";
import contractorProjectService from "../services/contractorProjectService";

vi.mock("../services/contractorProjectService", () => ({ default: { listAssignedProjects: vi.fn() } }));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));

const projects = [
  {
    id:1, name:"Historical Platform Upgrade", description:"Primary browser lifecycle demonstration.",
    company_name:"Atlas Commerce", pm_name:"Demo PM — Atlas",
    project_start_date:"2026-07-01", project_end_date:"2026-12-31", project_status:"ACTIVE",
    assigned_date:"2026-08-30", assignment_start_date:"2026-08-30", assignment_end_date:"2026-10-05",
    assignment_status:"RELEASED", assignment_released_at:"2026-10-09 09:00:00", assigned_skill:"BACKEND",
  },
  {
    id:2, name:"Completed Client Migration", description:"Active closeout assignment.",
    company_name:"Northwind", pm_name:"Demo PM — Northwind",
    project_start_date:"2026-01-10", project_end_date:"2026-06-20", project_status:"COMPLETED",
    assigned_date:"2026-02-01", assignment_start_date:"2026-02-01", assignment_end_date:"2026-06-20",
    assignment_status:"ACTIVE", assignment_released_at:null, assigned_skill:"FRONTEND",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  contractorProjectService.listAssignedProjects.mockResolvedValue(projects);
});

describe("Contractor My Projects presentation", () => {
  test("renders existing project fields in the compact desktop table", async () => {
    render(<ContractorProjectsPage />);
    const table = await screen.findByRole("table", { name:"My projects" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Project","Company","Dates","Assigned","Skill","Status"]);
    expect(table).toHaveTextContent("Historical Platform Upgrade");
    expect(table).toHaveTextContent("Completed Client Migration");
    expect(table).toHaveTextContent("Primary browser lifecycle demonstration.");
    expect(table).toHaveTextContent("Atlas Commerce");
    expect(table).toHaveTextContent("PM: Demo PM — Atlas");
    expect(table).toHaveTextContent("Jul 1, 2026");
    expect(table).toHaveTextContent("Dec 31, 2026");
    expect(table).toHaveTextContent("Aug 30, 2026");
    expect(table).toHaveTextContent("Released Oct 9, 2026");
    expect(table).toHaveTextContent("Backend");
    expect(screen.getByText("Showing 2 of 2 projects")).toBeInTheDocument();
    expect(screen.getByText("Assignment dates shown by the project determine when you are available for future work.")).toBeInTheDocument();
    await waitFor(() => expect(contractorProjectService.listAssignedProjects).toHaveBeenCalledTimes(1));
  });

  test("uses assignment status as primary while keeping project lifecycle secondary", async () => {
    render(<ContractorProjectsPage />);
    const table = await screen.findByRole("table", { name:"My projects" });
    const rows = within(table).getAllByRole("row");
    const releasedRow = rows.find((row) => within(row).queryByText("Historical Platform Upgrade"));
    const activeRow = rows.find((row) => within(row).queryByText("Completed Client Migration"));

    expect(within(releasedRow).getByTestId("project-status-badge")).toHaveTextContent("Released");
    expect(releasedRow).toHaveTextContent("Project: Active");
    expect(within(activeRow).getByTestId("project-status-badge")).toHaveTextContent("Active");
    expect(activeRow).toHaveTextContent("Project: Completed");
  });

  test("filters the complete assignment history by assignment status", async () => {
    render(<ContractorProjectsPage />);
    const table = await screen.findByRole("table", { name:"My projects" });
    const filter = screen.getByRole("combobox", { name:"Filter by assignment status" });

    expect(filter).toHaveValue("ALL");
    expect(table).toHaveTextContent("Historical Platform Upgrade");
    expect(table).toHaveTextContent("Completed Client Migration");

    fireEvent.change(filter, { target:{ value:"ACTIVE" } });
    expect(table).not.toHaveTextContent("Historical Platform Upgrade");
    expect(table).toHaveTextContent("Completed Client Migration");
    expect(screen.getByText("Showing 1 of 2 projects")).toBeInTheDocument();

    fireEvent.change(filter, { target:{ value:"RELEASED" } });
    expect(table).toHaveTextContent("Historical Platform Upgrade");
    expect(table).not.toHaveTextContent("Completed Client Migration");
  });

  test("keeps the existing navigation and does not invent search or row actions", async () => {
    render(<ContractorProjectsPage />);
    await screen.findByRole("table", { name:"My projects" });
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name:"Manage availability" })).toHaveAttribute("href", "/contractor/availability");
  });

  test("shows a contextual empty state when a status has no matching assignment", async () => {
    contractorProjectService.listAssignedProjects.mockResolvedValue([projects[1]]);
    render(<ContractorProjectsPage />);
    const table = await screen.findByRole("table", { name:"My projects" });
    fireEvent.change(screen.getByRole("combobox", { name:"Filter by assignment status" }), { target:{ value:"RELEASED" } });
    expect(within(table).getByRole("status")).toHaveTextContent("No released assignments.");
    expect(screen.getByText("Showing 0 of 1 project")).toBeInTheDocument();
  });

  test("preserves the distinct zero-project empty state", async () => {
    contractorProjectService.listAssignedProjects.mockResolvedValue([]);
    render(<ContractorProjectsPage />);
    expect(await screen.findByText("No projects assigned yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name:"My projects" })).toBeNull();
  });
});
