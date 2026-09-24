import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StaffingPipelineView from "./StaffingPipelineView";
import { KNOWN_SKILL_THEMES } from "../../utils/skillTheme";

const item = (overrides) => ({
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
  oldest_open_submitted_at: null,
  candidate_response_sla_hours: 48,
  due_at: null,
  sla_breached: false,
  ...overrides,
});

describe("StaffingPipelineView KPI cards", () => {
  it("shows only the current authoritative totals without historical trend content", () => {
    render(<StaffingPipelineView
      title="Client staffing pipeline"
      audience="vendor"
      loading={false}
      error={null}
      data={{ items: [item({}), item({
        project_id: 2,
        project_name: "Demo Platform Upgrade",
        requirement_id: 2,
        skill: "QA",
        open_positions: 1,
        open_candidate_count: 2,
        submitted_count: 1,
        shortlisted_count: 1,
        sla_breached: true,
      })] }}
    />);

    const openPositions = screen.getByText("Open positions").parentElement;
    const awaitingReview = screen.getByText("Candidates awaiting review").parentElement;
    const slaBreaches = screen.getByText("SLA breaches").parentElement;

    expect(within(openPositions).getByText("3")).toBeInTheDocument();
    expect(within(awaitingReview).getByText("3")).toBeInTheDocument();
    expect(within(slaBreaches).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText(/vs last week/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/historical comparison/i)).not.toBeInTheDocument();
  });

  it("renders the reference-aligned filters, compact client text, centered skill themes, and review states", () => {
    const onRefresh = vi.fn();
    render(<StaffingPipelineView
      title="Client staffing pipeline"
      audience="vendor"
      loading={false}
      error={null}
      lastUpdated={new Date("2026-09-13T10:24:00Z")}
      onRefresh={onRefresh}
      data={{ items: [
        item({ skill: "BACKEND", oldest_open_submitted_at: "2026-09-10T09:00:00Z", due_at: "2026-09-11T09:00:00Z", candidate_response_sla_hours: 24, sla_breached: true }),
        item({ project_id: 2, requirement_id: 2, project_name: "Nova Analytics Platform", company_id: 2, company_name: "Nova Digital", skill: "FRONTEND" }),
        item({ project_id: 3, requirement_id: 3, project_name: "Quality Platform", skill: "QA" }),
        item({ project_id: 4, requirement_id: 4, project_name: "Data Platform", skill: "DATA" }),
      ] }}
    />);

    expect(screen.getByText("Last updated")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    for (const label of ["Filter by candidate status", "Filter by skill", "Filter by project", "Filter by client"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(screen.queryByText("AC")).not.toBeInTheDocument();
    expect(screen.queryByText("ND")).not.toBeInTheDocument();
    expect(within(table).getByText("Atlas Commerce Modernization")).toBeInTheDocument();
    expect(within(table).getAllByText("Atlas Commerce")).toHaveLength(3);
    expect(within(table).getByText("Nova Analytics Platform")).toBeInTheDocument();
    expect(within(table).getByText("Nova Digital")).toBeInTheDocument();
    for (const skill of ["BACKEND", "FRONTEND", "QA", "DATA"]) {
      const badge = screen.getAllByText(skill).find((element) => element.tagName === "SPAN");
      const theme = KNOWN_SKILL_THEMES[skill.toLowerCase()];
      expect(badge).toHaveStyle({ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text });
      expect(badge).toHaveClass("inline-flex", "h-7", "items-center", "justify-center", "leading-none", "align-middle");
    }
    expect(screen.getAllByText("1 submitted · 0 shortlisted")).toHaveLength(4);
    expect(screen.getByText("SLA breached")).toBeInTheDocument();
    expect(screen.getAllByText("No review waiting")).toHaveLength(3);
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /No actions available for/ })).not.toBeInTheDocument();
  });

  it("paginates the filtered presentation without changing KPI totals", () => {
    const items = Array.from({ length: 7 }, (_, index) => item({ project_id: index + 1, requirement_id: index + 1, project_name: `Project ${index + 1}` }));
    render(<StaffingPipelineView title="Client staffing pipeline" audience="vendor" loading={false} error={null} data={{ items }} />);

    expect(screen.getByText("Showing 6 results")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByTitle("Project 1")).toBeInTheDocument();
    expect(screen.queryByTitle("Project 7")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTitle("Project 7")).toBeInTheDocument();
    expect(screen.queryByTitle("Project 1")).not.toBeInTheDocument();
    expect(within(screen.getByText("Open positions").parentElement).getByText("14")).toBeInTheDocument();
  });
});
