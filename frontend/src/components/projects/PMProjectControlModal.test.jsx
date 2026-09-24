import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PMProjectControlModal from "./PMProjectControlModal";

const control = {
  project: { id: 2, name: "Atlas Commerce Modernization", status: "ACTIVE" },
  summary: { attention_count: 1, by_severity: { HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 } },
  findings: [{
    code: "PROJECT_NOT_READY_TO_CLOSE",
    severity: "HIGH",
    title: "Close blocked",
    summary: "Resolve blockers.",
    evidence: [{ key: "count", label: "Close blockers", value: 2 }],
    recommended_action: "Review close readiness.",
    source: { engine: "pm_project_control", version: "1" },
  }],
};

describe("PMProjectControlModal", () => {
  it("presents the styled Project Control summary and findings in a dialog", () => {
    const { container } = render(<MemoryRouter><PMProjectControlModal project={control.project} control={control} onClose={vi.fn()} onRefresh={vi.fn()} /></MemoryRouter>);
    const dialog = screen.getByRole("dialog", { name: "Project Control" });
    expect(dialog).toHaveTextContent("Atlas Commerce Modernization · ACTIVE");
    expect(dialog).toHaveTextContent("Attention Summary");
    expect(container.querySelectorAll(".project-control-summary-card")).toHaveLength(4);
    expect(container.querySelector(".project-control-severity-high svg")).toBeInTheDocument();
    expect(screen.getByText("Severity: HIGH")).toHaveClass("project-control-severity-pill");
    expect(dialog).toHaveTextContent("Close blocked");
    expect(dialog).toHaveTextContent("Review close readiness.");
  });

  it("preserves refresh and close behavior", () => {
    const onRefresh = vi.fn();
    const onClose = vi.fn();
    render(<MemoryRouter><PMProjectControlModal project={control.project} control={control} onClose={onClose} onRefresh={onRefresh} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Refresh attention" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("starts the scrollable body at the top for each project", () => {
    const { container, rerender } = render(<MemoryRouter><PMProjectControlModal project={control.project} control={control} onClose={vi.fn()} onRefresh={vi.fn()} /></MemoryRouter>);
    const body = container.querySelector(".project-control-modal-body");
    body.scrollTop = 240;
    const nextControl = { ...control, project: { id: 3, name: "Atlas Legacy Migration", status: "COMPLETED" } };
    rerender(<MemoryRouter><PMProjectControlModal project={nextControl.project} control={nextControl} onClose={vi.fn()} onRefresh={vi.fn()} /></MemoryRouter>);
    expect(body.scrollTop).toBe(0);
  });
});
