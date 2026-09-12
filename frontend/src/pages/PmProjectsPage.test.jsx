import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PMProjectsPage from "./PMProjectsPage";

const { getCapabilities, getProjectControl } = vi.hoisted(() => ({ getCapabilities: vi.fn(), getProjectControl: vi.fn() }));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock("../services/pmProjectService", () => ({ default: { listProjects: vi.fn().mockResolvedValue({ items: [{ id: 2, name: "Atlas", status: "ACTIVE" }, { id: 3, name: "Nova", status: "ACTIVE" }], total_pages: 1, total: 2 }) } }));
vi.mock("../services/intelligenceService", () => ({ default: { getCapabilities } }));
vi.mock("../services/pmProjectControlService", () => ({ default: { getProjectControl } }));
vi.mock("../components/projects/ProjectTable", () => ({ default: ({ projects, onControl }) => <div>{onControl && projects.map((project) => <button key={project.id} onClick={() => onControl(project)}>Open control {project.id}</button>)}</div> }));
vi.mock("../components/projects/ProjectCardList", () => ({ default: () => null }));

const caps = (enabled) => ({ capabilities: { pm_project_control: enabled } });
const response = { project: { name: "Atlas", status: "ACTIVE" }, summary: { attention_count: 0, by_severity: { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } }, findings: [] };
describe("PMProjectsPage M28 boundary", () => {
  it("does not expose or request Project Control when disabled", async () => { getCapabilities.mockResolvedValue(caps(false)); render(<MemoryRouter><PMProjectsPage /></MemoryRouter>); await waitFor(() => expect(getCapabilities).toHaveBeenCalled()); expect(screen.queryByText("Open control")).not.toBeInTheDocument(); expect(getProjectControl).not.toHaveBeenCalled(); });
  it("clears stale findings and loads selected project control only after the explicit action", async () => { getCapabilities.mockResolvedValue(caps(true)); getProjectControl.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, project: { name: "Nova", status: "ACTIVE" } }); render(<MemoryRouter><PMProjectsPage /></MemoryRouter>); await screen.findByText("Open control 2"); fireEvent.click(screen.getByText("Open control 2")); await screen.findByText("No current attention items for this project."); fireEvent.click(screen.getByText("Open control 3")); expect(screen.getByText("Loading project attention…")).toBeInTheDocument(); expect(screen.queryByText("No current attention items for this project.")).not.toBeInTheDocument(); await waitFor(() => expect(getProjectControl).toHaveBeenLastCalledWith(3)); });
});
