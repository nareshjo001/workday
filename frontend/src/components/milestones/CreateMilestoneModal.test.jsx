import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateMilestoneModal from "./CreateMilestoneModal";

describe("CreateMilestoneModal", () => {
  it("renders the existing five milestone fields in the redesigned dialog", () => {
    render(<CreateMilestoneModal onClose={vi.fn()} onCreate={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Create Milestone" });
    expect(document.activeElement).toBe(within(dialog).getByLabelText(/Milestone Name/));
    expect(within(dialog).getByLabelText(/Description/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Sequence/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Due date/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Hours Threshold/)).toBeInTheDocument();
    expect(within(dialog).getByText(/every contractor staffed on it contributes toward the same hours threshold/i)).toBeInTheDocument();
  });

  it("preserves required-field validation and the exact creation payload", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateMilestoneModal onClose={vi.fn()} onCreate={onCreate} />);
    const dialog = screen.getByRole("dialog", { name: "Create Milestone" });
    const submit = within(dialog).getByRole("button", { name: "Create Milestone" });

    fireEvent.click(submit);
    expect(await within(dialog).findByText("Name is required.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a positive number of hours.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Milestone Name/), { target: { value: " Phase 1 Completion " } });
    fireEvent.change(within(dialog).getByLabelText(/Description/), { target: { value: "Delivery checkpoint" } });
    fireEvent.change(within(dialog).getByLabelText(/Sequence/), { target: { value: "2" } });
    fireEvent.change(within(dialog).getByLabelText(/Due date/), { target: { value: "2026-10-31" } });
    fireEvent.change(within(dialog).getByLabelText(/Hours Threshold/), { target: { value: "40" } });
    fireEvent.click(submit);

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      name: "Phase 1 Completion",
      thresholdHours: 40,
      description: "Delivery checkpoint",
      sequenceOrder: 2,
      dueDate: "2026-10-31",
    }));
  });

  it("keeps Cancel and Escape wired to the existing close behavior", () => {
    const onClose = vi.fn();
    const { unmount } = render(<CreateMilestoneModal onClose={onClose} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    const secondClose = vi.fn();
    render(<CreateMilestoneModal onClose={secondClose} onCreate={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(secondClose).toHaveBeenCalledTimes(1);
  });
});
