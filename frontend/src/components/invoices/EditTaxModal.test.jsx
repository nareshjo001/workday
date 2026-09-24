import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EditTaxModal from "./EditTaxModal";

describe("EditTaxModal", () => {
  const mockInvoice = {
    id: 10,
    tax_rate: 8.5,
    adjustment_amount: -25,
    adjustments: [{ description: "Early discount", amount: -25 }],
  };

  it("renders with pre-filled tax rate and adjustment values", () => {
    render(<EditTaxModal invoice={mockInvoice} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: /edit tax and adjustment/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tax rate/i)).toHaveValue(8.5);
    expect(screen.getByLabelText(/adjustment \(\$\)/i)).toHaveValue(-25);
    expect(screen.getByLabelText(/adjustment description/i)).toHaveValue("Early discount");
  });

  it("calls onClose when Cancel button is clicked without saving", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<EditTaxModal invoice={mockInvoice} onClose={handleClose} onSave={handleSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(handleClose).toHaveBeenCalledOnce();
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(<EditTaxModal invoice={mockInvoice} onClose={handleClose} onSave={vi.fn()} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("validates tax rate bounds (0 - 100) and displays error", async () => {
    const handleSave = vi.fn();
    render(<EditTaxModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const taxInput = screen.getByLabelText(/tax rate/i);
    fireEvent.change(taxInput, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tax rate must be a valid percentage between 0 and 100 with at most 2 decimal places."
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("validates negative tax rate and displays error", async () => {
    const handleSave = vi.fn();
    render(<EditTaxModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const taxInput = screen.getByLabelText(/tax rate/i);
    fireEvent.change(taxInput, { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tax rate must be a valid percentage between 0 and 100"
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("submits valid tax and adjustment data to onSave", async () => {
    const handleSave = vi.fn().mockResolvedValue({});
    render(<EditTaxModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const taxInput = screen.getByLabelText(/tax rate/i);
    const adjInput = screen.getByLabelText(/adjustment \(\$\)/i);
    const descInput = screen.getByLabelText(/adjustment description/i);

    fireEvent.change(taxInput, { target: { value: "10" } });
    fireEvent.change(adjInput, { target: { value: "15" } });
    fireEvent.change(descInput, { target: { value: "Rush fee" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        taxRate: "10",
        adjustments: [{ description: "Rush fee", amount: "15" }],
      });
    });
  });

  it("submits empty adjustments array when adjustment amount is 0", async () => {
    const handleSave = vi.fn().mockResolvedValue({});
    render(<EditTaxModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const taxInput = screen.getByLabelText(/tax rate/i);
    const adjInput = screen.getByLabelText(/adjustment \(\$\)/i);

    fireEvent.change(taxInput, { target: { value: "5" } });
    fireEvent.change(adjInput, { target: { value: "0" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        taxRate: "5",
        adjustments: [],
      });
    });
  });

  it("submits on Enter key inside the form", async () => {
    const handleSave = vi.fn().mockResolvedValue({});
    render(<EditTaxModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const taxInput = screen.getByLabelText(/tax rate/i);
    fireEvent.change(taxInput, { target: { value: "7.5" } });
    fireEvent.submit(taxInput.closest("form"));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalled();
    });
  });
});
