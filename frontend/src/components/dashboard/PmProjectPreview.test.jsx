import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PmProjectPreview from "./PmProjectPreview";

const projects = [
  { id: 1, name: "Atlas Commerce Modernization", company_name: "Atlas Commerce", status: "ACTIVE", staffing_status: "PENDING", start_date: "2026-07-01", end_date: "2026-12-31", approved_hours: 80, expected_hours: 240, work_progress_percent: 33.3, total_assigned: 1, total_required: 2 },
  { id: 2, name: "Atlas Mobile Expansion", company_name: "Atlas Commerce", status: "ON_HOLD", staffing_status: "FULLY_STAFFED", start_date: "2026-07-01", end_date: "2026-12-31", approved_hours: 6, expected_hours: 100, work_progress_percent: 6, total_assigned: 2, total_required: 2 },
  { id: 3, name: "Atlas Legacy Migration", company_name: "Atlas Commerce", status: "COMPLETED", staffing_status: "PENDING", start_date: "2026-04-01", end_date: "2026-06-30", approved_hours: 25, expected_hours: 80, work_progress_percent: 31.3, total_assigned: 0, total_required: 2 },
  { id: 4, name: "Excluded fourth project", company_name: "Atlas Commerce", status: "ACTIVE", staffing_status: "PENDING", start_date: "2026-07-01", end_date: "2026-12-31", approved_hours: 12, expected_hours: 120, work_progress_percent: 10, total_assigned: 0, total_required: 2 },
];

function view(props = {}) { return render(<PmProjectPreview projects={projects} {...props} />); }

test("renders every source-ordered project with a shared building icon and grouped detail columns", () => {
  const { container } = view();
  const grid = screen.getByTestId("pm-project-preview-grid");
  const cards = within(grid).getAllByRole("article");
  expect(cards).toHaveLength(4);
  expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual(projects.map((project) => project.name));
  expect(container.querySelectorAll(".pm-project-preview-icon svg")).toHaveLength(4);
  expect(cards[0]).toHaveTextContent("80h / 240h");
  expect(cards[0]).toHaveTextContent("1 / 2");
  expect(within(cards[0]).getByText("Status")).toBeInTheDocument();
  expect(within(cards[0]).getAllByText("Active", { exact: true })).toHaveLength(2);
  expect(screen.queryByText("View Details")).not.toBeInTheDocument();
});

test("opens the compact real-action menu, dismisses it with Escape, and dispatches the existing project action", () => {
  const onActivity = vi.fn();
  view({ onSettings: vi.fn(), onRequirements: vi.fn(), onControl: vi.fn(), onActivity });
  const trigger = screen.getByRole("button", { name: "Project actions for Atlas Commerce Modernization" });
  fireEvent.click(trigger);
  const menu = screen.getByRole("menu", { name: "Atlas Commerce Modernization actions" });
  expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Settings", "Requirements", "Project Control", "Activity"]);
  fireEvent.click(screen.getByRole("button", { name: "Project actions for Atlas Mobile Expansion" }));
  expect(screen.queryByRole("menu", { name: "Atlas Commerce Modernization actions" })).not.toBeInTheDocument();
  expect(screen.getByRole("menu", { name: "Atlas Mobile Expansion actions" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Project actions for Atlas Commerce Modernization" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Activity" }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(onActivity).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1 }),
    trigger,
  );
});
