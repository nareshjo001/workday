import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PMProjectActivityModal from "./PMProjectActivityModal";

const mockActivity = {
  project: { id: 2, name: "Atlas Commerce Modernization", status: "ACTIVE" },
  items: [
    {
      id: 1,
      occurred_at: "2026-09-14T10:15:00.000Z",
      event: "INVOICE_APPROVED",
      actor: { display_name: "Sarah Chen", role: "CLIENT" },
      entity: { type: "INVOICE", id: "INV-2026-001" },
      title: "Invoice approved",
      summary: "Sarah Chen approved Invoice #INV-2026-001.",
      details: [{ label: "Amount", value: "$3,000.00" }],
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    total: 1,
    total_pages: 1,
  },
};

describe("PMProjectActivityModal", () => {
  it("renders as a centered modal dialog overlay with unified two-column header", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();

    render(
      <PMProjectActivityModal
        project={{ id: 2, name: "Atlas Commerce Modernization", status: "ACTIVE" }}
        activity={mockActivity}
        isLoading={false}
        error={null}
        onClose={onClose}
        onRetry={onRetry}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Activity" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    // Modal panel styling check
    const panel = dialog.querySelector(".project-activity-modal");
    expect(panel).toBeInTheDocument();

    // Verify unified header on the left
    expect(screen.getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(
      screen.getByText("Track all important events across your projects, assignments, invoices and payments.")
    ).toBeInTheDocument();
    expect(screen.getByText("Atlas Commerce Modernization · ACTIVE")).toBeInTheDocument();

    // Verify right actions: Refresh activity and Close button sit in same action group
    const actionsGroup = dialog.querySelector(".ui-modal-header-actions");
    expect(actionsGroup).toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", { name: "Refresh activity" });
    expect(refreshBtn).toBeInTheDocument();
    expect(refreshBtn).toHaveClass("project-activity-refresh-btn");
    expect(actionsGroup).toContainElement(refreshBtn);

    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn).toBeInTheDocument();
    expect(actionsGroup).toContainElement(closeBtn);

    // Verify activity item
    expect(screen.getByText("Invoice approved")).toBeInTheDocument();

    // Body scroll locked
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("calls onClose when close button is clicked or Escape key is pressed", () => {
    const onClose = vi.fn();

    render(
      <PMProjectActivityModal
        project={{ id: 2, name: "Atlas Commerce Modernization", status: "ACTIVE" }}
        activity={mockActivity}
        isLoading={false}
        error={null}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("calls onRetry when Refresh activity is clicked", () => {
    const onRetry = vi.fn();

    render(
      <PMProjectActivityModal
        project={{ id: 2, name: "Atlas Commerce Modernization", status: "ACTIVE" }}
        activity={mockActivity}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables refresh button and displays refreshing state when isLoading is true", () => {
    render(
      <PMProjectActivityModal
        project={{ id: 2, name: "Atlas Commerce Modernization", status: "ACTIVE" }}
        activity={mockActivity}
        isLoading={true}
        error={null}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const refreshBtn = screen.getByRole("button", { name: "Refreshing activity" });
    expect(refreshBtn).toBeDisabled();
    expect(refreshBtn).toHaveTextContent("Refreshing…");
  });
});
