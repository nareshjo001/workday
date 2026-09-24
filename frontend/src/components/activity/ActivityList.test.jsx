import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityList from "./ActivityList";

const mockActivity = {
  project: { id: 2, name: "Atlas", status: "ACTIVE" },
  items: [
    {
      id: 1,
      occurred_at: "2026-09-14T10:15:00.000Z",
      event: "INVOICE_APPROVED",
      actor: { display_name: "Sarah Chen", role: "CLIENT" },
      entity: { type: "INVOICE", id: "INV-2026-001" },
      title: "Invoice approved",
      summary: "Sarah Chen approved Invoice #INV-2026-001.",
      details: [
        { label: "Status", value: "SUBMITTED → APPROVED" },
        { label: "Amount", value: "$3,000.00" },
        { label: "Allocated hours", value: "40.00 → 40" },
      ],
    },
    {
      id: 2,
      occurred_at: "2026-09-12T10:00:00.000Z",
      event: "TIMESHEET_SUBMITTED",
      actor: { display_name: "Alex", role: "CONTRACTOR" },
      entity: { type: "TIMESHEET", id: "5" },
      title: "Timesheet submitted",
      summary: "Alex submitted a timesheet.",
      details: [{ label: "Hours", value: 8 }],
    },
    {
      id: 3,
      occurred_at: "2026-09-10T08:00:00.000Z",
      event: "CUSTOM_UNKNOWN_EVENT",
      actor: { display_name: "System", role: "SYSTEM" },
      entity: { type: "DOCUMENT", id: "99" },
      title: "Document processed",
      summary: "Document processed by system.",
      details: [],
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    total: 3,
    total_pages: 2,
  },
};

describe("ActivityList", () => {
  it("renders activity items with correct headers, actors, summaries, and entity labels", () => {
    render(<ActivityList activity={mockActivity} onRetry={vi.fn()} />);

    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Track all important events across your projects, assignments, invoices and payments."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Invoice approved")).toBeInTheDocument();
    expect(
      screen.getByText("Sarah Chen approved Invoice #INV-2026-001.")
    ).toBeInTheDocument();
    expect(screen.getByText("Invoice #INV-2026-001")).toBeInTheDocument();

    expect(screen.getByText("Timesheet submitted")).toBeInTheDocument();
    expect(screen.getByText("Alex submitted a timesheet.")).toBeInTheDocument();
  });

  it("renders 2-line right-aligned timestamps with date and time", () => {
    const { container } = render(
      <ActivityList activity={mockActivity} onRetry={vi.fn()} />
    );

    const timeElements = container.querySelectorAll("time");
    expect(timeElements.length).toBe(3);

    expect(screen.getByText("Sep 14 2026")).toBeInTheDocument();
    expect(screen.getByText("Sep 12 2026")).toBeInTheDocument();
  });

  it("renders semantic status badges for state transitions", () => {
    render(<ActivityList activity={mockActivity} onRetry={vi.fn()} />);

    const approvedStatus = screen.getByText("APPROVED");
    expect(approvedStatus).toBeInTheDocument();
    expect(approvedStatus.className).toContain("text-emerald-600");
  });

  it("suppresses meaningless changes (e.g. 40.00 -> 40)", () => {
    render(<ActivityList activity={mockActivity} onRetry={vi.fn()} />);

    expect(screen.queryByText(/Allocated hours/i)).not.toBeInTheDocument();
    expect(screen.getByText("Hours:")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders category icons without emojis", () => {
    const { container } = render(
      <ActivityList activity={mockActivity} onRetry={vi.fn()} />
    );

    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(3);

    const textContent = container.textContent || "";
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(textContent)).toBe(false);
  });

  it("renders loading state when isLoading is true", () => {
    render(<ActivityList isLoading onRetry={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading activity");
  });

  it("renders refreshing state on the Refresh button without blanking the feed", () => {
    render(
      <ActivityList
        activity={mockActivity}
        isRefreshing={true}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("Invoice approved")).toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", { name: "Refreshing activity" });
    expect(refreshBtn).toBeDisabled();
    expect(refreshBtn).toHaveTextContent("Refreshing…");
  });

  it("calls onRetry when Refresh activity button is clicked", () => {
    const onRetryMock = vi.fn();
    render(<ActivityList activity={mockActivity} onRetry={onRetryMock} />);

    const refreshBtn = screen.getByRole("button", { name: "Refresh activity" });
    fireEvent.click(refreshBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it("renders error state with retry button when error occurs", () => {
    const onRetryMock = vi.fn();
    render(<ActivityList error={true} onRetry={onRetryMock} />);

    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    const retryBtn = screen.getByRole("button", { name: "Retry activity" });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when items array is empty", () => {
    render(
      <ActivityList
        activity={{ ...mockActivity, items: [] }}
        onRetry={vi.fn()}
      />
    );
    expect(
      screen.getByText("No activity recorded for this scope yet.")
    ).toBeInTheDocument();
  });

  it("renders pagination and calls navigation handlers", () => {
    const onPrevMock = vi.fn();
    const onNextMock = vi.fn();

    render(
      <ActivityList
        activity={mockActivity}
        onRetry={vi.fn()}
        onPrevious={onPrevMock}
        onNext={onNextMock}
      />
    );

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("3 results")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: "Previous" });
    const nextBtn = screen.getByRole("button", { name: "Next" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(onNextMock).toHaveBeenCalledTimes(1);
  });
});
