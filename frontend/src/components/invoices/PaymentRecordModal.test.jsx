import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaymentRecordModal from "./PaymentRecordModal";

describe("PaymentRecordModal", () => {
  const mockInvoice = {
    id: 14,
    invoice_number: "DEMO-ATLAS-2026-0003",
    project_name: "FinTech Migration",
    currency: "USD",
    outstanding_amount: 1500.5,
    payment_state: "PARTIALLY_PAID",
  };

  it("renders dialog with invoice summary, currency, and prefilled outstanding amount", () => {
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: /record payment/i })).toBeInTheDocument();
    expect(screen.getByText("Invoice: DEMO-ATLAS-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("FinTech Migration")).toBeInTheDocument();

    const outstandingEl = screen.getByText("USD 1500.50");
    expect(outstandingEl).toBeInTheDocument();
    expect(outstandingEl).toHaveClass("text-[#2446b8]");

    const amountInput = screen.getByLabelText(/amount/i);
    expect(amountInput).toHaveValue(1500.5);
    expect(amountInput).toHaveClass("outline-none");
  });

  it("renders exactly five professional payment methods with Check (not Cheque)", () => {
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={vi.fn()} />);

    const methodSelect = screen.getByLabelText(/method/i);
    const options = Array.from(methodSelect.querySelectorAll("option"));

    expect(options).toHaveLength(6); // 1 placeholder + 5 methods
    expect(options.map((o) => o.textContent)).toEqual([
      "Select payment method",
      "Bank transfer",
      "ACH",
      "Wire transfer",
      "Check",
      "Credit card",
    ]);

    expect(options.map((o) => o.value)).toEqual([
      "",
      "BANK_TRANSFER",
      "ACH",
      "WIRE_TRANSFER",
      "CHECK",
      "CREDIT_CARD",
    ]);

    // Explicitly verify "Check" is used, not "Cheque"
    expect(screen.queryByText(/cheque/i)).not.toBeInTheDocument();
    expect(screen.getByText("Check")).toBeInTheDocument();
  });

  it("calls onClose when Cancel button or Close [X] is clicked", () => {
    const handleClose = vi.fn();
    render(<PaymentRecordModal invoice={mockInvoice} onClose={handleClose} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(<PaymentRecordModal invoice={mockInvoice} onClose={handleClose} onSave={vi.fn()} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("shows error when amount is empty or non-positive", async () => {
    const handleSave = vi.fn();
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a valid positive payment amount."
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("shows error when amount has more than 2 decimal places", async () => {
    const handleSave = vi.fn();
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "100.555" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Payment amount cannot have more than two decimal places."
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("shows error when amount exceeds outstanding balance", async () => {
    const handleSave = vi.fn();
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Payment amount cannot exceed outstanding balance of USD 1500.50."
    );
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("submits valid payment details to onSave", async () => {
    const handleSave = vi.fn().mockResolvedValue({});
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    const amountInput = screen.getByLabelText(/amount/i);
    const paidAtInput = screen.getByLabelText(/paid at/i);
    const refInput = screen.getByLabelText(/reference/i);
    const methodSelect = screen.getByLabelText(/method/i);
    const notesInput = screen.getByLabelText(/notes/i);

    fireEvent.change(amountInput, { target: { value: "500" } });
    fireEvent.change(paidAtInput, { target: { value: "2026-09-14T14:30" } });
    fireEvent.change(refInput, { target: { value: "TXN-987654" } });
    fireEvent.change(methodSelect, { target: { value: "BANK_TRANSFER" } });
    fireEvent.change(notesInput, { target: { value: "First tranche settlement" } });

    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        amount: 500,
        paid_at: "2026-09-14T14:30",
        reference: "TXN-987654",
        method: "BANK_TRANSFER",
        notes: "First tranche settlement",
      });
    });
  });

  it("handles onSave failure gracefully and displays the error", async () => {
    const handleSave = vi.fn().mockRejectedValue(new Error("Server error recording payment"));
    render(<PaymentRecordModal invoice={mockInvoice} onClose={vi.fn()} onSave={handleSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error recording payment");
  });
});
