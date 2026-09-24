import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddContractorModal from "./AddContractorModal";

describe("AddContractorModal", () => {
  it("renders modal header, title, and accurate invitation subtitle", () => {
    render(<AddContractorModal onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 2, name: "Add Contractor" })).toBeInTheDocument();
    expect(
      screen.getByText("Create a new contractor and send them an invite to set their password.")
    ).toBeInTheDocument();
  });

  it("renders exact required fields (Name, Email, Hourly Rate) and NO Skill field", () => {
    render(<AddContractorModal onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();

    expect(screen.getByLabelText(/email \*/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter email address")).toBeInTheDocument();

    expect(screen.getByLabelText(/hourly rate/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();

    // Verify NO Skill selector is present (contractor sets skill later)
    expect(screen.queryByLabelText(/skill/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders the accurate invitation banner and INR helper text", () => {
    render(<AddContractorModal onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(
      screen.getByText("The contractor will receive a one-time email link to create their own password.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Set the contractor's hourly rate \(INR\)\./)).toBeInTheDocument();
  });

  it("triggers validation errors when submitting empty fields", async () => {
    const onCreate = vi.fn();
    render(<AddContractorModal onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /Add Contractor/i }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Hourly rate is required.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("validates negative or invalid hourly rates", async () => {
    const onCreate = vi.fn();
    render(<AddContractorModal onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { name: "name", value: "Taylor Swift" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "taylor@swift.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { name: "hourly_rate", value: "-25" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Contractor/i }));

    expect(screen.getByText("Enter a valid non-negative rate.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("calls onCreate with trimmed values and numeric hourlyRate on valid submission", async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 99 });
    const onClose = vi.fn();

    render(<AddContractorModal onClose={onClose} onCreate={onCreate} />);

    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { name: "name", value: "  Sam Contractor  " },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "  sam@contractor.dev  " },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { name: "hourly_rate", value: "125.5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Contractor/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: "Sam Contractor",
        email: "sam@contractor.dev",
        hourlyRate: 125.5,
      });
    });
  });

  it("displays loading state during submission", async () => {
    let resolveCreate;
    const onCreate = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    render(<AddContractorModal onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { name: "name", value: "Sam Contractor" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "sam@contractor.dev" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { name: "hourly_rate", value: "100" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Contractor/i }));

    expect(screen.getByText("Adding…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adding…/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();

    resolveCreate({ id: 101 });
  });

  it("surfaces server API errors inline in an alert banner", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("An account with this email already exists."));

    render(<AddContractorModal onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { name: "name", value: "Duplicate User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "duplicate@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { name: "hourly_rate", value: "150" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Contractor/i }));

    await waitFor(() => {
      expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
    });
  });

  it("invokes onClose when clicking the top-right close (X) button", () => {
    const onClose = vi.fn();
    render(<AddContractorModal onClose={onClose} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when clicking the Cancel button", () => {
    const onClose = vi.fn();
    render(<AddContractorModal onClose={onClose} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when pressing the Escape key", () => {
    const onClose = vi.fn();
    render(<AddContractorModal onClose={onClose} onCreate={vi.fn()} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when clicking the backdrop, but not when clicking inside modal", () => {
    const onClose = vi.fn();
    render(<AddContractorModal onClose={onClose} onCreate={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    // Clicking backdrop
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clicking inside dialog content (e.g. heading) does not close modal
    fireEvent.click(screen.getByRole("heading", { level: 2, name: "Add Contractor" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("contains zero emoji characters throughout the rendered modal", () => {
    const { container } = render(<AddContractorModal onClose={vi.fn()} onCreate={vi.fn()} />);
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.textContent)).toBe(false);
  });
});
