import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectStaffingCard from "./ProjectStaffingCard";

const sampleProject = {
  id: 101,
  name: "Nova Analytics Platform",
  company_name: "Nova Digital",
  pm_name: "Demo PM — Nova",
  start_date: "2026-08-01",
  end_date: "2026-12-31",
  status: "ACTIVE",
  staffing_status: "PENDING",
  total_required: 2,
  total_assigned: 1,
  expected_hours: 160,
  approved_hours: 32,
  allocated_hours: 120,
  work_progress_percent: 20,
};

describe("ProjectStaffingCard", () => {
  it("B. renders project title correctly", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const title = screen.getByText("Nova Analytics Platform");
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("font-semibold");
    expect(title).not.toHaveClass("font-bold");
  });

  it("C. renders PM information", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    expect(screen.getByText(/PM:\s*Demo PM — Nova/i)).toBeInTheDocument();
  });

  it("D. renders company chip", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const companyChip = screen.getByTestId("company-chip");
    expect(companyChip).toHaveTextContent("Nova Digital");
  });

  it("E. renders date range", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const dateChip = screen.getByTestId("date-range-chip");
    expect(dateChip).toHaveTextContent(/Aug 1, 2026/i);
    expect(dateChip).toHaveTextContent(/Dec 31, 2026/i);
  });

  it("F. renders Team metric with assigned/required counts and label", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const teamTile = screen.getByTestId("metric-tile-team");
    expect(teamTile).toHaveTextContent("1 / 2");
    expect(teamTile).toHaveTextContent("Team");
  });

  it("G. renders Work Done metric and label", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const workTile = screen.getByTestId("metric-tile-work-done");
    expect(workTile).toHaveTextContent("32h");
    expect(workTile).toHaveTextContent("Work done");
  });

  it("H. renders Staffing metric and label", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const staffingTile = screen.getByTestId("metric-tile-staffing");
    expect(staffingTile).toHaveTextContent("120h");
    expect(staffingTile).toHaveTextContent("Staffing");
  });

  it("I. renders exactly ONE work progress bar per card and compact single-line capsule", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars).toHaveLength(1);
    expect(progressBars[0]).toHaveAttribute("aria-label", "Work completion progress");
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "20");
    const capsule = screen.getByTestId("work-capsule");
    expect(capsule).toBeInTheDocument();
    expect(capsule).toHaveTextContent("32h / 160h");
    expect(capsule).toHaveTextContent("20%");
    expect(capsule.querySelector("svg")).not.toBeNull();
  });

  it("J. ensures no Staffing progress bar exists", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const staffingTile = screen.getByTestId("metric-tile-staffing");
    expect(staffingTile.querySelector('[role="progressbar"]')).toBeNull();
    expect(staffingTile.querySelector(".h-2, .rounded-full.bg-primary")).toBeNull();
  });

  it("K. ensures no Team-fill progress bar exists", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const teamTile = screen.getByTestId("metric-tile-team");
    expect(teamTile.querySelector('[role="progressbar"]')).toBeNull();
    expect(teamTile.querySelector(".h-2, .rounded-full.bg-primary")).toBeNull();
  });

  it("L. calls onViewTeam handler when action button is clicked", () => {
    const handleViewTeam = vi.fn();
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={handleViewTeam} />);
    const button = screen.getByTestId("view-team-button");
    expect(button).toHaveTextContent("View & Assign Team");
    fireEvent.click(button);
    expect(handleViewTeam).toHaveBeenCalledTimes(1);
    expect(handleViewTeam).toHaveBeenCalledWith(sampleProject);
  });

  it("shows 'View Team' button text when fully staffed", () => {
    const fullyStaffed = { ...sampleProject, staffing_status: "FULLY_STAFFED" };
    render(<ProjectStaffingCard project={fullyStaffed} onViewTeam={vi.fn()} />);
    expect(screen.getByTestId("view-team-button")).toHaveTextContent("View Team");
  });

  it("renders the professional Users/Team line icon inside the action button exactly once", () => {
    render(<ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />);
    const button = screen.getByTestId("view-team-button");
    expect(button.className).toContain("inline-flex");
    expect(button.className).toContain("gap-2");
    expect(button.className).toContain("items-center");
    expect(button.className).toContain("justify-center");

    const icon = screen.getByTestId("view-team-icon");
    expect(icon).toBeInTheDocument();
    expect(button.contains(icon)).toBe(true);
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon.className.baseVal || icon.className).toContain("w-[18px]");
    expect(icon.className.baseVal || icon.className).toContain("h-[18px]");

    // Verify it only renders once in the button
    const iconsInButton = button.querySelectorAll("svg");
    expect(iconsInButton).toHaveLength(1);
  });

  it("M. status badge renders correct textual status", () => {
    const { rerender } = render(
      <ProjectStaffingCard
        project={{ ...sampleProject, staffing_status: "PENDING" }}
        onViewTeam={vi.fn()}
      />
    );
    expect(screen.getByTestId("project-status-badge")).toHaveTextContent("Pending");

    rerender(
      <ProjectStaffingCard
        project={{ ...sampleProject, staffing_status: "FULLY_STAFFED" }}
        onViewTeam={vi.fn()}
      />
    );
    expect(screen.getByTestId("project-status-badge")).toHaveTextContent("Fully Staffed");
  });

  it("N. semantic status classes/themes are selected correctly", () => {
    const statusesToTest = [
      { status: "PENDING", expectedKey: "PENDING", expectedClass: "bg-amber-50" },
      { status: "ACTIVE", expectedKey: "ACTIVE", expectedClass: "bg-emerald-50" },
      { status: "FULLY_STAFFED", expectedKey: "COMPLETED", expectedClass: "bg-emerald-50" },
      { status: "ON_HOLD", expectedKey: "ON_HOLD", expectedClass: "bg-orange-50" },
      { status: "CANCELLED", expectedKey: "CANCELLED", expectedClass: "bg-rose-50" },
    ];

    for (const { status, expectedKey, expectedClass } of statusesToTest) {
      const { unmount } = render(
        <ProjectStaffingCard
          project={{ ...sampleProject, staffing_status: status }}
          onViewTeam={vi.fn()}
        />
      );
      const badge = screen.getByTestId("project-status-badge");
      expect(badge).toHaveAttribute("data-status", expectedKey);
      expect(badge.className).toContain(expectedClass);
      unmount();
    }
  });

  it("O. contains zero emojis across entire card output", () => {
    const { container } = render(
      <ProjectStaffingCard project={sampleProject} onViewTeam={vi.fn()} />
    );
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/u;
    expect(emojiRegex.test(container.textContent)).toBe(false);
  });
});
