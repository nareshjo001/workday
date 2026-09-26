import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ProjectTeamModal from "./ProjectTeamModal";

const sampleProject = {
  id: 1,
  name: "Atlas Commerce Modernization",
  company_name: "Atlas Commerce",
  pm_name: "Demo PM — Atlas",
  start_date: "2026-07-01",
  end_date: "2026-12-31",
  total_assigned: 3,
  total_required: 4,
  requirements: [
    {
      id: 10,
      skill: "BACKEND",
      required_count: 1,
      assigned_count: 0,
      contractors: [],
    },
    {
      id: 20,
      skill: "FRONTEND",
      required_count: 1,
      assigned_count: 1,
      contractors: [
        {
          contractor_id: 101,
          name: "Avery Frontend",
          skill: "FRONTEND",
          status: "ACTIVE",
          assignment_status: "ACTIVE",
          allocated_hours: 160,
          logged_hours: 79,
          approved_hours: 72,
          pending_hours: 4,
          remaining_hours: 84,
        },
      ],
    },
    {
      id: 30,
      skill: "QA",
      required_count: 2,
      assigned_count: 2,
      contractors: [
        {
          contractor_id: 201,
          name: "Quinn QA",
          skill: "QA",
          status: "ACTIVE",
          assignment_status: "ACTIVE",
          allocated_hours: 80,
          logged_hours: 13,
          approved_hours: 8,
          pending_hours: 5,
          remaining_hours: 67,
        },
        {
          contractor_id: 202,
          name: "Uma Upcoming",
          skill: "QA",
          status: "ACTIVE",
          assignment_status: "ACTIVE",
          allocated_hours: 60,
          logged_hours: 0,
          approved_hours: 0,
          pending_hours: 0,
          remaining_hours: 60,
        },
      ],
    },
  ],
};

describe("ProjectTeamModal", () => {
  it("1. renders project title correctly", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Atlas Commerce Modernization" })).toBeInTheDocument();
  });

  it("2. renders company name and PM name in metadata", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByText("Atlas Commerce")).toBeInTheDocument();
    expect(screen.getByText(/Demo PM — Atlas/)).toBeInTheDocument();
  });

  it("3. renders formatted date range", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByText(/Jul 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Dec 31, 2026/)).toBeInTheDocument();
  });

  it("4. renders team assigned/required count", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByText(/Team:/)).toBeInTheDocument();
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
  });

  it("5. renders all requirement sections", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByTestId("requirement-section-10")).toBeInTheDocument();
    expect(screen.getByTestId("requirement-section-20")).toBeInTheDocument();
    expect(screen.getByTestId("requirement-section-30")).toBeInTheDocument();
  });

  it("6. renders requirement assigned fractions", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByText("0 / 1 assigned")).toBeInTheDocument();
    expect(screen.getByText("1 / 1 assigned")).toBeInTheDocument();
    expect(screen.getByText("2 / 2 assigned")).toBeInTheDocument();
  });

  it("7. renders candidate submit action on unfilled requirement", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const submitBtn = screen.getByTestId("submit-candidate-btn-10");
    expect(submitBtn).toHaveTextContent("Submit Backend Candidate");
    expect(submitBtn).toBeInTheDocument();
  });

  it("8. renders unfilled info message when no contractors are assigned", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const emptyBanner = screen.getByTestId("empty-contractors-10");
    expect(emptyBanner).toHaveTextContent("No contractors assigned yet.");
  });

  it("9. renders Filled badge on filled requirements", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    expect(screen.getByTestId("filled-badge-20")).toHaveTextContent("Filled");
    expect(screen.getByTestId("filled-badge-30")).toHaveTextContent("Filled");
    expect(screen.queryByTestId("submit-candidate-btn-20")).toBeNull();
  });

  it("10. renders assigned contractor identity and avatar initials", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const averyRow = screen.getByTestId("contractor-row-101");
    expect(within(averyRow).getByText("Avery Frontend")).toBeInTheDocument();
    expect(within(averyRow).getByTestId("contractor-avatar")).toHaveTextContent("AF");
  });

  it("11. renders contractor skill and status", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const averyRow = screen.getByTestId("contractor-row-101");
    expect(within(averyRow).getByText("Frontend")).toBeInTheDocument();
    expect(within(averyRow).getByText("Active")).toBeInTheDocument();
  });

  it("12. renders existing hours metrics (Allocated, Logged, Approved, Pending, Remaining)", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const averyRow = screen.getByTestId("contractor-row-101");
    expect(averyRow).toHaveTextContent("Allocated: 160h");
    expect(averyRow).toHaveTextContent("Logged: 79h");
    expect(averyRow).toHaveTextContent("Approved: 72h");
    expect(averyRow).toHaveTextContent("Pending: 4h");
    expect(averyRow).toHaveTextContent("Remaining: 84h");
  });

  it("13. renders multiple contractors under one requirement", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const qaSection = screen.getByTestId("requirement-section-30");
    expect(within(qaSection).getByText("Quinn QA")).toBeInTheDocument();
    expect(within(qaSection).getByText("Uma Upcoming")).toBeInTheDocument();
  });

  it("14. triggers onAssignRequirement when candidate submit button is clicked", () => {
    const handleAssign = vi.fn();
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={handleAssign} />);
    const submitBtn = screen.getByTestId("submit-candidate-btn-10");
    fireEvent.click(submitBtn);
    expect(handleAssign).toHaveBeenCalledTimes(1);
    expect(handleAssign).toHaveBeenCalledWith(sampleProject.requirements[0]);
  });

  it("15. triggers onClose when close button, backdrop, or Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(<ProjectTeamModal project={sampleProject} onClose={handleClose} onAssignRequirement={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it("16. contains zero emojis across entire modal output", () => {
    const { container } = render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/u;
    expect(emojiRegex.test(container.textContent)).toBe(false);
  });

  it("17. renders contractor hours metrics region with subtle vertical divider classes for desktop", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const hoursBlock = screen.getByTestId("contractor-hours-101");
    expect(hoursBlock).toBeInTheDocument();
    expect(hoursBlock.className).toContain("md:border-l");
    expect(hoursBlock.className).toContain("md:border-slate-200");
    expect(hoursBlock.className).toContain("md:pl-5");
  });

  it("18. uses compact modal max width (~900px)", () => {
    render(<ProjectTeamModal project={sampleProject} onClose={vi.fn()} onAssignRequirement={vi.fn()} />);
    const modalShell = screen.getByTestId("project-team-modal");
    expect(modalShell.className).toContain("max-w-[900px]");
  });
});

