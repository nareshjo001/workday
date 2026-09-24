import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import vendorInvoiceService from "../services/vendorInvoiceService";
import VendorInvoicesPage from "./VendorInvoicesPage";

vi.mock("../services/vendorInvoiceService", () => ({
  default: {
    listInvoices: vi.fn(),
    billingQueue: vi.fn(),
    createDraft: vi.fn(),
    submitDraft: vi.fn(),
    updateDraft: vi.fn(),
    downloadPdf: vi.fn(),
    recordPayment: vi.fn(),
  },
}));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <div>{children}</div> }));

const lineItem = { id: 81, contractor_name_snapshot: "Avery Frontend", skill_name_snapshot: "FRONTEND", approved_hours: 8, bill_rate: 180, amount: 1440 };
const draft = { id: 8, invoice_number: null, project_name: "Demo Platform Upgrade", generated_at: "2026-09-14 09:30:00", status: "DRAFT", items: [lineItem], amount: 1440, subtotal_amount: 1440, tax_rate: 10, tax_amount: 144, adjustment_amount: -20, total_amount: 1564, adjustments: [] };
const submitted = { ...draft, id: 7, invoice_number: "INV-2026-000007", project_name: "Atlas Commerce Modernization", status: "SUBMITTED", total_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0 };
const approved = { ...draft, id: 6, invoice_number: "INV-2026-000006", project_name: "Nova Analytics Platform", status: "APPROVED", total_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, reviewed_at: "2026-09-13 10:00:00", payment_state: "PARTIALLY_PAID", paid_amount: 400, outstanding_amount: 1040, due_date: "2026-10-14", payments: [], pdf_storage_key: "invoices/inv-6.pdf" };
const rejected = { ...draft, id: 5, invoice_number: "INV-2026-000005", status: "REJECTED", total_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, reviewed_at: "2026-09-12 10:00:00", rejection_reason: "Purchase order reference is missing." };
const invoices = [draft, submitted, approved, rejected];
const queueItem = { milestone_billing_id: 91, milestone_name: "Platform launch", contractor_name: "Avery Frontend", skill_name: "FRONTEND", approved_hours: 8, amount: 1440, currency: "USD" };

const pageData = (items = invoices, page = 1) => ({ items, total: 28, page, page_size: 10, total_pages: 3 });

describe("VendorInvoicesPage", { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorInvoiceService.listInvoices.mockResolvedValue(pageData());
    vendorInvoiceService.billingQueue.mockResolvedValue([queueItem]);
    window.print = vi.fn();
    window.open = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders the workflow with operational summary, eligible billing, selected invoice, and history", async () => {
    const { container } = render(<VendorInvoicesPage />);
    expect(await screen.findByRole("heading", { name: "Invoices", level: 1 })).toBeInTheDocument();

    // 1. Operational summary based on real authoritative data
    const summary = screen.getByLabelText("Operational Summary");
    expect(within(summary).getByText("Eligible billing")).toBeInTheDocument();
    expect(within(summary).getByText("$1,440.00 · 8h")).toBeInTheDocument();
    expect(within(summary).getByText("Approved")).toBeInTheDocument();
    expect(within(summary).getByText("$1,440.00 total")).toBeInTheDocument();
    expect(within(summary).getByText("Pending review")).toBeInTheDocument();
    expect(within(summary).getByText("$1,440.00 awaiting PM")).toBeInTheDocument();
    expect(within(summary).getByText("Rejected")).toBeInTheDocument();
    expect(within(summary).getByText("Requires attention")).toBeInTheDocument();

    // 2. Eligible billing renders
    expect(screen.getByRole("heading", { name: "Eligible billing" })).toBeInTheDocument();
    expect(screen.getByText("Approved billable work that can be added to a draft invoice.")).toBeInTheDocument();
    expect(screen.getByText("Platform launch")).toBeInTheDocument();
    expect(screen.getByText("8h")).toBeInTheDocument();

    // 3. Selected invoice initially shows empty selection guidance
    expect(await screen.findByRole("heading", { name: "Select an invoice" })).toBeInTheDocument();
    expect(screen.getByText(/Choose an invoice from the history below/)).toBeInTheDocument();
    expect(screen.getByText("Select a row below")).toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();

    // 4. History section
    const history = screen.getByTestId("invoice-history");
    expect(within(history).getByRole("heading", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("28 results")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    // Check left alignment of invoice identifier button and cell
    const invoiceButton = within(history).getAllByRole("button", { name: "Draft #8" })[0];
    expect(invoiceButton).toHaveClass("text-left", "block", "w-full");
    expect(invoiceButton.closest("td")).toHaveClass("text-left");

    // Confirm no fake actions column, no ellipsis menu, no duplicate chips
    expect(within(history).queryByRole("columnheader", { name: /actions/i })).not.toBeInTheDocument();
    expect(within(history).queryByRole("button", { name: /more|options|\.\.\./i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-number-chips")).not.toBeInTheDocument();

    // Confirm zero emojis in text
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.textContent)).toBe(false);
  });

  it("moves existing invoice selection into history, updates selected invoice, and displays rejection reason and settlement", async () => {
    render(<VendorInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");

    // Select REJECTED invoice
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000005" })[0]);
    const selected = screen.getByTestId("selected-invoice");
    expect(within(selected).getByRole("heading", { name: "INV-2026-000005" })).toBeInTheDocument();
    expect(within(selected).getByText(/Purchase order reference is missing/)).toBeInTheDocument();
    expect(within(selected).getByText("REJECTED")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-number-chips")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "INV-2026-000005" }).every((button) => history.contains(button))).toBe(true);

    // Select APPROVED invoice with settlement
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000006" })[0]);
    expect(within(selected).getByRole("heading", { name: "INV-2026-000006" })).toBeInTheDocument();
    expect(within(selected).getByText("Settlement")).toBeInTheDocument();
    expect(within(selected).getByText("$1,040.00")).toBeInTheDocument();
    expect(within(selected).queryByRole("button", { name: "Submit invoice" })).not.toBeInTheDocument();
    expect(within(selected).getByRole("button", { name: "Record payment" })).toBeInTheDocument();

    // Test PDF download when storage key exists
    vendorInvoiceService.downloadPdf.mockResolvedValue("blob:http://localhost/inv-6");
    fireEvent.click(within(selected).getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(vendorInvoiceService.downloadPdf).toHaveBeenCalledWith(6));
  });

  it("preserves draft creation, editing, submission, and print actions inside the selected card", async () => {
    const updatedDraft = { ...draft, tax_rate: 5, tax_amount: 72, adjustment_amount: 10, total_amount: 1522, adjustments: [{ description: "Handling", amount: 10 }] };
    const submittedDraft = { ...updatedDraft, invoice_number: "INV-2026-000008", status: "SUBMITTED" };
    vendorInvoiceService.updateDraft.mockResolvedValue(updatedDraft);
    vendorInvoiceService.submitDraft.mockResolvedValue(submittedDraft);
    const promptSpy = vi.spyOn(window, "prompt");
    render(<VendorInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "Draft #8" })[0]);
    const selected = await screen.findByTestId("selected-invoice");

    fireEvent.click(within(selected).getByRole("button", { name: "Edit tax and adjustment" }));
    const modal = await screen.findByRole("dialog", { name: /edit tax and adjustment/i });
    expect(promptSpy).not.toHaveBeenCalled();

    fireEvent.change(within(modal).getByLabelText(/tax rate/i), { target: { value: "5" } });
    fireEvent.change(within(modal).getByLabelText(/adjustment \(\$\)/i), { target: { value: "10" } });
    fireEvent.change(within(modal).getByLabelText(/adjustment description/i), { target: { value: "Handling" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(vendorInvoiceService.updateDraft).toHaveBeenCalledWith(8, { tax_rate: "5", adjustments: [{ description: "Handling", amount: "10" }] }));
    expect(within(selected).getByText("$1,522.00")).toBeInTheDocument();

    fireEvent.click(within(selected).getByRole("button", { name: "Print" }));
    expect(window.print).toHaveBeenCalledOnce();

    fireEvent.click(within(selected).getByRole("button", { name: "Submit invoice" }));
    await waitFor(() => expect(vendorInvoiceService.submitDraft).toHaveBeenCalledWith(8));
    expect(within(selected).getByText("SUBMITTED")).toBeInTheDocument();
  });

  it("creates a draft from eligible billing and keeps real pagination", async () => {
    const created = { ...draft, id: 9 };
    vendorInvoiceService.createDraft.mockResolvedValue(created);
    vendorInvoiceService.listInvoices.mockResolvedValueOnce(pageData()).mockResolvedValueOnce(pageData([created, ...invoices]));
    render(<VendorInvoicesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(vendorInvoiceService.createDraft).toHaveBeenCalledWith(91));
    expect(screen.queryByText("Platform launch")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("selected-invoice")).getByRole("heading", { name: "Draft #9" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(vendorInvoiceService.listInvoices).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, sort: "generated_at", order: "desc" }));
  });

  it("hides Record payment for fully paid invoices and shows it for unpaid/partially paid approved invoices", async () => {
    const fullyPaidInvoice = {
      ...draft,
      id: 4,
      invoice_number: "INV-2026-000004",
      project_name: "Nova Customer Portal",
      status: "APPROVED",
      currency: "USD",
      total_amount: 3000,
      paid_amount: 3000,
      outstanding_amount: 0,
      payment_state: "PAID",
      due_date: "2026-06-30",
      payments: [
        { id: 11, amount: 3000, method: "BANK_TRANSFER", reference: "DEMO-NOVA-FULL-001", paid_at: "2026-07-01 10:00:00" },
      ],
    };
    const partiallyPaidInvoice = {
      ...draft,
      id: 3,
      invoice_number: "INV-2026-000003",
      project_name: "Atlas Legacy Migration",
      status: "APPROVED",
      currency: "USD",
      total_amount: 1250,
      paid_amount: 500,
      outstanding_amount: 750,
      payment_state: "PARTIALLY_PAID",
      due_date: "2026-06-30",
      payments: [
        { id: 10, amount: 500, method: "BANK_TRANSFER", reference: "DEMO-ATLAS-PARTIAL-001", paid_at: "2026-07-01 10:00:00" },
      ],
    };
    vendorInvoiceService.listInvoices.mockResolvedValue(pageData([fullyPaidInvoice, partiallyPaidInvoice]));
    render(<VendorInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");

    // Select fully paid invoice from history
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000004" })[0]);
    const selected = screen.getByTestId("selected-invoice");
    expect(within(selected).getByRole("heading", { name: "INV-2026-000004" })).toBeInTheDocument();
    const settlement = within(selected).getByLabelText("Settlement details");
    expect(within(settlement).getByText("Settlement")).toBeInTheDocument();
    expect(within(settlement).getByText("PAID")).toBeInTheDocument();
    expect(within(settlement).getByText("Paid")).toBeInTheDocument();
    expect(within(settlement).getByText("Outstanding")).toBeInTheDocument();
    expect(within(settlement).getByText("$0.00")).toBeInTheDocument();
    expect(within(settlement).getByText("DEMO-NOVA-FULL-001")).toBeInTheDocument();
    // Record payment button MUST be absent
    expect(within(selected).queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();

    // Select partially paid invoice
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000003" })[0]);
    expect(within(selected).getByRole("heading", { name: "INV-2026-000003" })).toBeInTheDocument();
    expect(within(selected).getByText("PARTIALLY_PAID")).toBeInTheDocument();
    expect(within(selected).getByText("$750.00")).toBeInTheDocument();
    // Record payment button MUST be present
    expect(within(selected).getByRole("button", { name: "Record payment" })).toBeInTheDocument();

    // Click Record payment to open modal
    fireEvent.click(within(selected).getByRole("button", { name: "Record payment" }));
    const modal = screen.getByRole("dialog", { name: "Record payment" });
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/Outstanding:\s*USD\s*750\.00/)).toBeInTheDocument();

    // Submit payment that pays off the invoice
    vendorInvoiceService.recordPayment.mockResolvedValue({
      paid_amount: 1250,
      outstanding_amount: 0,
      payment_state: "PAID",
      overdue: false,
      payments: [
        { id: 10, amount: 500, method: "BANK_TRANSFER", reference: "DEMO-ATLAS-PARTIAL-001", paid_at: "2026-07-01 10:00:00" },
        { id: 12, amount: 750, method: "BANK_TRANSFER", reference: "FINAL-PAY", paid_at: "2026-07-05 10:00:00" },
      ],
    });

    fireEvent.click(within(modal).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(vendorInvoiceService.recordPayment).toHaveBeenCalledWith(3, expect.objectContaining({ amount: 750 })));
    expect(screen.queryByRole("dialog", { name: "Record payment" })).not.toBeInTheDocument();

    // Now that it is fully paid, Record payment button disappears from selected invoice
    expect(within(selected).getByText("PAID")).toBeInTheDocument();
    expect(within(selected).queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
  });

  it("allows recording payment for AUTO_APPROVED invoices when unpaid or partially paid, and hides when paid", async () => {
    const autoApprovedUnpaid = {
      ...draft,
      id: 21,
      invoice_number: "INV-2026-000021",
      project_name: "Auto-approved Portal",
      status: "AUTO_APPROVED",
      currency: "USD",
      total_amount: 500,
      paid_amount: 0,
      outstanding_amount: 500,
      payment_state: "UNPAID",
      due_date: "2026-08-01",
      payments: [],
    };
    vendorInvoiceService.listInvoices.mockResolvedValue(pageData([autoApprovedUnpaid]));
    render(<VendorInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000021" })[0]);
    const selected = await screen.findByTestId("selected-invoice");
    expect(within(selected).getByRole("heading", { name: "INV-2026-000021" })).toBeInTheDocument();
    expect(within(selected).getByText("AUTO APPROVED")).toBeInTheDocument();
    expect(within(selected).getByRole("button", { name: "Record payment" })).toBeInTheDocument();

    // Click Record payment to open modal
    fireEvent.click(within(selected).getByRole("button", { name: "Record payment" }));
    const modal = screen.getByRole("dialog", { name: "Record payment" });
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/Outstanding:\s*USD\s*500\.00/)).toBeInTheDocument();

    // Submit payoff
    vendorInvoiceService.recordPayment.mockResolvedValue({
      paid_amount: 500,
      outstanding_amount: 0,
      payment_state: "PAID",
      overdue: false,
      payments: [
        { id: 25, amount: 500, method: "BANK_TRANSFER", reference: "AUTO-PAY", paid_at: "2026-08-02 10:00:00" },
      ],
    });
    fireEvent.click(within(modal).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(vendorInvoiceService.recordPayment).toHaveBeenCalledWith(21, expect.objectContaining({ amount: 500 })));
    expect(screen.queryByRole("dialog", { name: "Record payment" })).not.toBeInTheDocument();
    expect(within(selected).getByText("PAID")).toBeInTheDocument();
    expect(within(selected).queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
  });

  it("satisfies all Generated column and row selection UX requirements (A-I)", async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<VendorInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    const table = within(history).getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1); // skip header row

    // Row 0: draft (id: 8, generated_at: "2026-09-14 09:30:00", reviewed_at: null)
    // Row 1: submitted (id: 7, generated_at: "2026-09-14 09:30:00", reviewed_at: null)
    // Row 2: approved (id: 6, generated_at: "2026-09-14 09:30:00", reviewed_at: "2026-09-13 10:00:00")

    // A. Generated column renders date on first line
    const generatedCells = rows.map((row) => within(row).getAllByRole("cell")[3]);
    expect(within(generatedCells[0]).getByText("Sep 14 2026")).toBeInTheDocument();
    expect(within(generatedCells[0]).getByText("Sep 14 2026")).toHaveClass("whitespace-nowrap", "font-medium");

    // B. Generated column renders time on second line
    expect(within(generatedCells[0]).getByText("9:30 AM")).toBeInTheDocument();
    expect(within(generatedCells[0]).getByText("9:30 AM")).toHaveClass("whitespace-nowrap", "text-[11px]", "text-slate-500");

    // C. Reviewed column remains unchanged
    const reviewedCells = rows.map((row) => within(row).getAllByRole("cell")[5]);
    expect(within(reviewedCells[0]).getByText("—")).toBeInTheDocument();
    expect(within(reviewedCells[2]).getByText("Sep 13, 2026, 10:00 AM")).toBeInTheDocument();

    // Initial state: No row is selected initially
    expect(rows[0]).toHaveClass("border-l-transparent");
    expect(rows[0]).not.toHaveClass("border-l-blue-500");
    expect(rows[2]).toHaveClass("border-l-transparent");
    expect(rows[2]).not.toHaveClass("border-l-blue-500");
    expect(screen.getByRole("heading", { name: "Select an invoice" })).toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();

    // D. Clicking an invoice row selects it
    fireEvent.click(rows[0]);

    // Selected row receives selected styling and renders selected-invoice
    expect(rows[0]).toHaveClass("bg-blue-50/60", "border-l-2", "border-l-blue-500");
    const selected = screen.getByTestId("selected-invoice");
    expect(within(selected).getByRole("heading", { name: "Draft #8" })).toBeInTheDocument();

    // E. Clicking another invoice row selects it
    fireEvent.click(rows[2]);

    // Selected row receives selected styling
    expect(rows[2]).toHaveClass("bg-blue-50/60", "border-l-2", "border-l-blue-500");

    // F. Previous row loses selected styling
    expect(rows[0]).toHaveClass("border-l-transparent");
    expect(rows[0]).not.toHaveClass("border-l-blue-500");

    // G. Selected Invoice section updates to clicked invoice
    expect(within(selected).getByRole("heading", { name: "INV-2026-000006" })).toBeInTheDocument();

    // H. Selection triggers scrollIntoView with smooth behavior
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    // Verify scroll-mt-24 or scroll-mt-28 is on the selected-invoice section
    expect(selected.className).toMatch(/scroll-mt-2[48]/);

    // I. Reduced-motion behavior remains accessible (uses "auto")
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    scrollIntoViewMock.mockClear();
    // Select row 1 (submitted)
    fireEvent.click(rows[1]);
    expect(within(selected).getByRole("heading", { name: "INV-2026-000007" })).toBeInTheDocument();

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      });
    });
  });

  it("replaces native prompt with EditTaxModal dialog with full keyboard, validation, cancel, and save support", async () => {
    const updatedDraft = {
      ...draft,
      tax_rate: 15,
      tax_amount: 216,
      adjustment_amount: 50,
      total_amount: 1706,
      adjustments: [{ description: "Expedited shipping", amount: 50 }],
    };
    vendorInvoiceService.updateDraft.mockResolvedValue(updatedDraft);
    const promptSpy = vi.spyOn(window, "prompt");

    render(<VendorInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "Draft #8" })[0]);
    const selected = await screen.findByTestId("selected-invoice");

    // 1. Click "Edit tax and adjustment" -> Opens modal, window.prompt is NEVER called
    fireEvent.click(within(selected).getByRole("button", { name: "Edit tax and adjustment" }));
    expect(promptSpy).not.toHaveBeenCalled();

    let modal = await screen.findByRole("dialog", { name: /edit tax and adjustment/i });
    expect(modal).toBeInTheDocument();

    // 2. Pre-fills current tax rate (draft has 10)
    const taxInput = within(modal).getByLabelText(/tax rate/i);
    expect(taxInput).toHaveValue(10);

    // 3. Escape key closes modal without saving
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /edit tax and adjustment/i })).not.toBeInTheDocument();
    });
    expect(vendorInvoiceService.updateDraft).not.toHaveBeenCalled();

    // 4. Re-open modal and verify Cancel button closes without saving
    fireEvent.click(within(selected).getByRole("button", { name: "Edit tax and adjustment" }));
    modal = await screen.findByRole("dialog", { name: /edit tax and adjustment/i });
    fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /edit tax and adjustment/i })).not.toBeInTheDocument();
    });
    expect(vendorInvoiceService.updateDraft).not.toHaveBeenCalled();

    // 5. Re-open modal and test validation (tax > 100)
    fireEvent.click(within(selected).getByRole("button", { name: "Edit tax and adjustment" }));
    modal = await screen.findByRole("dialog", { name: /edit tax and adjustment/i });
    const taxField = within(modal).getByLabelText(/tax rate/i);
    fireEvent.change(taxField, { target: { value: "120" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Save" }));
    expect(await within(modal).findByRole("alert")).toHaveTextContent(/between 0 and 100/i);
    expect(vendorInvoiceService.updateDraft).not.toHaveBeenCalled();

    // 6. Enter submits when valid
    fireEvent.change(taxField, { target: { value: "15" } });
    const adjField = within(modal).getByLabelText(/adjustment \(\$\)/i);
    const descField = within(modal).getByLabelText(/adjustment description/i);
    fireEvent.change(adjField, { target: { value: "50" } });
    fireEvent.change(descField, { target: { value: "Expedited shipping" } });

    // Submit via form submit / Enter key
    fireEvent.submit(taxField.closest("form"));

    await waitFor(() => {
      expect(vendorInvoiceService.updateDraft).toHaveBeenCalledWith(8, {
        tax_rate: "15",
        adjustments: [{ description: "Expedited shipping", amount: "50" }],
      });
    });

    // 7. Modal closes and totals refresh
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /edit tax and adjustment/i })).not.toBeInTheDocument();
    });
    expect(within(selected).getByText("$1,706.00")).toBeInTheDocument();
    expect(within(selected).getByText("Tax (15%)")).toBeInTheDocument();
  });

  it("satisfies requirement A-H: initial empty state, history row selection, create draft auto-selection, and distinct loading states", async () => {
    const createdDraft = {
      ...draft,
      id: 99,
      invoice_number: null,
      status: "DRAFT",
      amount: 1440,
      total_amount: 1440,
    };
    vendorInvoiceService.createDraft.mockResolvedValue(createdDraft);
    vendorInvoiceService.listInvoices.mockResolvedValue(pageData());

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<VendorInvoicesPage />);

    // A. Initial invoice load does NOT auto-select first invoice
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();

    // B. Initial Selected Invoice area shows "Select an invoice" guidance
    expect(await screen.findByRole("heading", { name: "Select an invoice" })).toBeInTheDocument();
    expect(screen.getByText("Select a row below")).toBeInTheDocument();
    expect(screen.getByText(/Choose an invoice from the history below/)).toBeInTheDocument();

    // C. No history row has selected styling initially
    const history = screen.getByTestId("invoice-history");
    const table = within(history).getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    for (const row of rows) {
      expect(row).toHaveClass("border-l-transparent");
      expect(row).not.toHaveClass("border-l-blue-500");
    }

    // D. Clicking a history row selects invoice, highlights row, renders invoice detail, triggers smooth scroll
    scrollIntoViewMock.mockClear();
    fireEvent.click(rows[0]);

    expect(rows[0]).toHaveClass("bg-blue-50/60", "border-l-2", "border-l-blue-500");
    const selected = await screen.findByTestId("selected-invoice");
    expect(within(selected).getByRole("heading", { name: "Draft #8" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select an invoice" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    // E. Selecting another row switches selection
    scrollIntoViewMock.mockClear();
    fireEvent.click(rows[1]);
    expect(rows[0]).toHaveClass("border-l-transparent");
    expect(rows[1]).toHaveClass("bg-blue-50/60", "border-l-2", "border-l-blue-500");
    expect(within(selected).getByRole("heading", { name: "INV-2026-000007" })).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    // F. Create draft success: automatically selects new draft, renders new draft, scrolls to selected invoice
    scrollIntoViewMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => {
      expect(vendorInvoiceService.createDraft).toHaveBeenCalledWith(91);
    });
    await waitFor(() => {
      expect(within(screen.getByTestId("selected-invoice")).getByRole("heading", { name: "Draft #99" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    // G. Reduced-motion behavior switches to "auto"
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    scrollIntoViewMock.mockClear();
    fireEvent.click(rows[2]);
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      });
    });
  });

  it("H. maintains distinct states for loading, no-invoices, and unselected invoices", async () => {
    // Test genuinely loading state
    let resolveList;
    vendorInvoiceService.listInvoices.mockReturnValue(new Promise((res) => { resolveList = res; }));
    const { unmount } = render(<VendorInvoicesPage />);
    expect(screen.getByText("Loading invoices…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select an invoice" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();
    resolveList(pageData([]));
    unmount();

    // Test zero invoices state
    vendorInvoiceService.listInvoices.mockResolvedValue(pageData([]));
    render(<VendorInvoicesPage />);
    expect(await screen.findByText("No invoices yet. Select eligible billing above to create a draft.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select an invoice" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();
  });
});

