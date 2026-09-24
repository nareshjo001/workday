import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateProjectModal from "./CreateProjectModal";

function futureDateString(daysAhead = 10) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function pastDateString(daysBehind = 5) {
  const d = new Date();
  d.setDate(d.getDate() - daysBehind);
  return d.toISOString().slice(0, 10);
}

describe("CreateProjectModal", () => {
  it("renders with 3 section cards, header badge, and initial requirement row", () => {
    const onClose = vi.fn();
    const onCreate = vi.fn();

    render(<CreateProjectModal onClose={onClose} onCreate={onCreate} />);

    // Header check
    expect(screen.getByRole("dialog", { name: "Create Project" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Project" })).toBeInTheDocument();
    expect(
      screen.getByText("Set up a new project with key details and staffing requirements.")
    ).toBeInTheDocument();

    // Section 1 check
    expect(screen.getByRole("heading", { name: "Basic Information" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Project Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();

    // Section 2 check
    expect(screen.getByRole("heading", { name: "Timeline & Capacity" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected Hours \(total project capacity\)/i)).toBeInTheDocument();

    // Section 3 check
    expect(screen.getByRole("heading", { name: "Staffing Requirements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add skill/i })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Select skill" })).toHaveLength(1);
    expect(screen.getAllByRole("spinbutton", { name: "Staffing headcount" })).toHaveLength(1);

    // Footer actions check
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
  });

  it("validates required fields on empty submit and displays error messages", async () => {
    const onCreate = vi.fn();
    render(<CreateProjectModal onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Start date is required.")).toBeInTheDocument();
    expect(screen.getByText("Enter a positive number of hours.")).toBeInTheDocument();
    expect(screen.getByText("Select a skill.")).toBeInTheDocument();
    expect(screen.getByText("Enter a positive whole number.")).toBeInTheDocument();
  });

  it("validates date rules: past dates and end date before start date", () => {
    render(<CreateProjectModal onClose={vi.fn()} onCreate={vi.fn()} />);

    const startInput = screen.getByLabelText(/Start Date/i);
    const endInput = screen.getByLabelText(/End Date \(optional\)/i);

    // Set past start date
    fireEvent.change(startInput, { target: { name: "start_date", value: pastDateString(3) } });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    expect(screen.getByText("Start date cannot be in the past.")).toBeInTheDocument();

    // Set future start date and earlier end date
    fireEvent.change(startInput, { target: { name: "start_date", value: futureDateString(10) } });
    fireEvent.change(endInput, { target: { name: "end_date", value: futureDateString(5) } });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    expect(screen.getByText("End date cannot be before start date.")).toBeInTheDocument();
  });

  it("supports dynamically adding and removing staffing requirement rows", () => {
    render(<CreateProjectModal onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getAllByRole("combobox", { name: "Select skill" })).toHaveLength(1);

    // Initial single row cannot be removed
    const initialRemoveBtn = screen.getByRole("button", { name: "Remove requirement" });
    expect(initialRemoveBtn).toBeDisabled();

    // Add a second row
    fireEvent.click(screen.getByRole("button", { name: /Add skill/i }));
    expect(screen.getAllByRole("combobox", { name: "Select skill" })).toHaveLength(2);

    // Select skill in first row to verify filtering in second row
    const selects = screen.getAllByRole("combobox", { name: "Select skill" });
    fireEvent.change(selects[0], { target: { value: "FRONTEND" } });

    // Second dropdown should not offer FRONTEND
    const secondSelectOptions = Array.from(selects[1].querySelectorAll("option")).map((o) => o.value);
    expect(secondSelectOptions).not.toContain("FRONTEND");

    // Remove first row
    const removeButtons = screen.getAllByRole("button", { name: "Remove requirement" });
    expect(removeButtons[0]).toBeEnabled();
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByRole("combobox", { name: "Select skill" })).toHaveLength(1);
  });

  it("submits valid project payload to onCreate", async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 99, name: "Atlas Commerce Modernization" });
    const onClose = vi.fn();

    render(<CreateProjectModal onClose={onClose} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { name: "name", value: "Atlas Commerce Modernization" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { name: "description", value: "Core infrastructure overhaul." },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { name: "start_date", value: futureDateString(5) },
    });
    fireEvent.change(screen.getByLabelText(/End Date \(optional\)/i), {
      target: { name: "end_date", value: futureDateString(60) },
    });
    fireEvent.change(screen.getByLabelText(/Expected Hours \(total project capacity\)/i), {
      target: { name: "expected_hours", value: "320" },
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Select skill" }), {
      target: { value: "BACKEND" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Staffing headcount" }), {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      name: "Atlas Commerce Modernization",
      description: "Core infrastructure overhaul.",
      startDate: futureDateString(5),
      endDate: futureDateString(60),
      expectedHours: 320,
      requirements: [{ skill: "BACKEND", requiredCount: 3 }],
    });
  });

  it("displays server error banner when submission fails", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("A project with this name already exists."));
    render(<CreateProjectModal onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { name: "name", value: "Duplicate Project" },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { name: "start_date", value: futureDateString(1) },
    });
    fireEvent.change(screen.getByLabelText(/Expected Hours \(total project capacity\)/i), {
      target: { name: "expected_hours", value: "100" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Select skill" }), {
      target: { value: "QA" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Staffing headcount" }), {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByText("A project with this name already exists.")).toBeInTheDocument();
  });

  it("calls onClose when Cancel button or modal close button is clicked", () => {
    const onClose = vi.fn();
    render(<CreateProjectModal onClose={onClose} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
