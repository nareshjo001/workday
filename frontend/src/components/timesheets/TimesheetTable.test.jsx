import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import TimesheetTable from "./TimesheetTable";

const logs = [
  { id: 1, work_date: "2026-09-08", hours_logged: 4, description: "Draft log work", status: "DRAFT", submitted_at: null },
  { id: 2, work_date: "2026-09-09", hours_logged: 4, description: "Submitted log work", status: "SUBMITTED", submitted_at: "2026-09-09 09:30:00" },
  { id: 3, work_date: "2026-09-10", hours_logged: 4, description: "Approved log work", status: "APPROVED", submitted_at: "2026-09-10 09:30:00", reviewed_at: "2026-09-10 12:30:00" },
  { id: 4, work_date: "2026-09-11", hours_logged: 4, description: "Rejected log work", status: "REJECTED", submitted_at: "2026-09-11 09:30:00", rejection_reason: "Add more detail." },
];

describe("TimesheetTable edit availability", () => {
  test("renders an edit action for DRAFT and REJECTED rows, and empty action cell for SUBMITTED and APPROVED rows", () => {
    const onEdit = vi.fn();
    render(<TimesheetTable logs={logs} onEdit={onEdit} />);

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    expect(editButtons).toHaveLength(2);

    const draftRow = screen.getByText("Draft log work").closest("tr");
    const submittedRow = screen.getByText("Submitted log work").closest("tr");
    const approvedRow = screen.getByText("Approved log work").closest("tr");
    const rejectedRow = screen.getByText("Rejected log work").closest("tr");

    // DRAFT row has edit action
    expect(draftRow).toContainElement(editButtons[0]);
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(logs[0]);

    // REJECTED row has edit action
    expect(rejectedRow).toContainElement(editButtons[1]);
    fireEvent.click(editButtons[1]);
    expect(onEdit).toHaveBeenCalledWith(logs[3]);

    // SUBMITTED and APPROVED rows have NO edit action (cell is empty)
    expect(submittedRow.querySelector("button")).toBeNull();
    expect(approvedRow.querySelector("button")).toBeNull();
  });
});
