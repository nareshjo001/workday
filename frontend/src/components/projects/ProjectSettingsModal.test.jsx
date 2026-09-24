import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectSettingsModal from "./ProjectSettingsModal";

const project = {
  id: 7,
  name: "Atlas Legacy Migration",
  description: "Completed legacy data migration.",
  start_date: "2026-04-01",
  end_date: "2026-06-30",
  expected_hours: 80,
  budget: 22000,
  currency: "USD",
  max_hours_per_day: 12,
  max_hours_per_week: 50,
  backdate_limit_days: 120,
  candidate_response_sla_hours: 48,
  allow_weekend: false,
  status: "COMPLETED",
};

describe("ProjectSettingsModal", () => {
  it("renders the polished section structure with stacked full-width basic fields", () => {
    const { unmount } = render(<ProjectSettingsModal project={project} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Project settings: Atlas Legacy Migration" })).toBeInTheDocument();
    expect(screen.getByText("Manage project details, limits, and workflow settings.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Basic information" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline & effort" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget & limits" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Additional settings" })).toBeInTheDocument();

    const name = screen.getByLabelText(/Name/);
    const description = screen.getByLabelText("Description");
    const stack = name.closest(".project-settings-stack");
    expect(stack).toContainElement(description);
    expect(name.closest("label").nextElementSibling).toBe(description.closest("label"));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("preserves the existing values and payload conversions when saving", async () => {
    const onSave = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();
    render(<ProjectSettingsModal project={project} onClose={onClose} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(7, {
      name: "Atlas Legacy Migration",
      description: "Completed legacy data migration.",
      start_date: "2026-04-01",
      end_date: "2026-06-30",
      expected_hours: 80,
      budget: 22000,
      currency: "USD",
      max_hours_per_day: 12,
      max_hours_per_week: 50,
      backdate_limit_days: 120,
      candidate_response_sla_hours: 48,
      allow_weekend: false,
      status: "COMPLETED",
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps Cancel, Close, and the existing completion action behavior", () => {
    const onClose = vi.fn();
    const onComplete = vi.fn();
    render(<ProjectSettingsModal project={{ ...project, status: "ACTIVE" }} onClose={onClose} onSave={vi.fn()} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete project" }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 7, status: "ACTIVE" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
