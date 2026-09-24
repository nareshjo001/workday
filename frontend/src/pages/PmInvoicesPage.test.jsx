import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PmInvoicesPage from "./PmInvoicesPage";
import pmInvoiceService from "../services/pmInvoiceService";

vi.mock("../layouts/DashboardLayout", () => ({ default: ({ title, children }) => <div data-testid="dashboard-layout" data-title={title}>{children}</div> }));
vi.mock("../services/pmInvoiceService", () => ({ default: { listInvoices: vi.fn(), reviewInvoice: vi.fn(), downloadPdf: vi.fn() } }));

const submitted = {
  id: 7,
  invoice_number: "INV-2026-000007",
  project_name: "Atlas Commerce Modernization",
  status: "SUBMITTED",
  generated_at: "2026-09-14 09:30:00",
  reviewed_at: null,
  subtotal_amount: 1440,
  tax_rate: 10,
  tax_amount: 144,
  adjustment_amount: 0,
  total_amount: 1584,
  pdf_storage_key: "invoices/7.pdf",
  items: [{ id: 81, contractor_name_snapshot: "Avery Frontend", skill_name_snapshot: "FRONTEND", approved_hours: 8, bill_rate: 180, amount: 1440 }],
};
const approved = { ...submitted, id: 6, invoice_number: "INV-2026-000006", project_name: "Demo Platform Upgrade", status: "APPROVED", reviewed_at: "2026-09-15 10:00:00", payment_state: "PARTIALLY_PAID", paid_amount: 400, outstanding_amount: 1184, due_date: "2026-10-14" };

describe("PmInvoicesPage Vendor-aligned presentation", () => {
  let scrollIntoView;

  beforeEach(() => {
    vi.clearAllMocks();
    scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", (callback) => { callback(); return 1; });
    pmInvoiceService.listInvoices.mockResolvedValue({ items: [submitted, approved], total: 2, total_pages: 1, page: 1 });
    pmInvoiceService.reviewInvoice.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads invoice history without selecting the first invoice", async () => {
    render(<PmInvoicesPage />);
    expect(await screen.findByRole("heading", { name: "Invoice Reviews" })).toBeInTheDocument();
    expect(pmInvoiceService.listInvoices).toHaveBeenCalledWith({ page: 1, pageSize: 25, sort: "generated_at", order: "desc" });

    expect(await screen.findByTestId("selected-invoice-empty")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select an invoice" })).toBeInTheDocument();
    expect(screen.getByText("Select a row below")).toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    const history = screen.getByTestId("invoice-history");
    expect(within(history).getByRole("heading", { name: "Invoice history" })).toBeInTheDocument();
    expect(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]).not.toHaveAttribute("aria-current");
    const table = within(history).getByLabelText("Invoice history table");
    expect(within(table).getAllByText("Sep 14, 2026")).toHaveLength(2);
    expect(within(table).getAllByText("9:30 AM")).toHaveLength(2);
  });

  it("selects only the invoice row clicked and renders its existing details", async () => {
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000006" })[0]);
    const selected = screen.getByTestId("selected-invoice");
    expect(within(selected).getByRole("heading", { name: "INV-2026-000006" })).toBeInTheDocument();
    expect(within(selected).getByRole("heading", { name: "Settlement" })).toBeInTheDocument();
    expect(within(history).getAllByRole("button", { name: "INV-2026-000006" })[0]).toHaveAttribute("aria-current", "true");
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "smooth", block: "start" });

    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    expect(screen.queryByRole("button", { name: "Edit tax and adjustment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit invoice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
  });

  it("preserves the existing approve endpoint and payload", async () => {
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    const selected = screen.getByTestId("selected-invoice");
    fireEvent.click(within(selected).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(pmInvoiceService.reviewInvoice).toHaveBeenCalledWith(7, "APPROVED", null));
    expect(pmInvoiceService.listInvoices).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("selected-invoice")).toHaveTextContent("INV-2026-000007");
  });

  it("opens the in-app rejection modal, validates the reason, and preserves the rejection payload", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    const selected = screen.getByTestId("selected-invoice");
    const rejectTrigger = within(selected).getByRole("button", { name: "Reject" });

    fireEvent.click(rejectTrigger);
    const dialog = screen.getByRole("dialog", { name: "Reject invoice" });
    expect(within(dialog).getByText("INV-2026-000007")).toBeInTheDocument();
    expect(within(dialog).getByText("Atlas Commerce Modernization")).toBeInTheDocument();
    expect(within(dialog).getByText("Sep 14, 2026")).toBeInTheDocument();
    expect(within(dialog).getByText("Provide a reason for rejecting this invoice.")).toBeInTheDocument();
    expect(within(dialog).getByText("This reason will be visible to the vendor and recorded in the invoice history.")).toBeInTheDocument();
    const reason = within(dialog).getByRole("textbox", { name: /Rejection reason/ });
    expect(reason).toHaveAttribute("maxlength", "500");
    expect(reason).toHaveAttribute("placeholder", "Enter the reason for rejection...");
    await waitFor(() => expect(reason).toHaveFocus());
    expect(promptSpy).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject invoice" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("A rejection reason is required.");
    expect(pmInvoiceService.reviewInvoice).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "  Incorrect billing amount  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject invoice" }));
    await waitFor(() => expect(pmInvoiceService.reviewInvoice).toHaveBeenCalledWith(7, "REJECTED", "Incorrect billing amount"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Reject invoice" })).not.toBeInTheDocument());
    expect(rejectTrigger).toHaveFocus();
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it("cancels the rejection modal with Cancel or Escape without making a request", async () => {
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    const rejectTrigger = within(screen.getByTestId("selected-invoice")).getByRole("button", { name: "Reject" });

    fireEvent.click(rejectTrigger);
    let dialog = screen.getByRole("dialog", { name: "Reject invoice" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Rejection reason/ }), { target: { value: "Do not save" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Reject invoice" })).not.toBeInTheDocument();
    expect(rejectTrigger).toHaveFocus();
    expect(pmInvoiceService.reviewInvoice).not.toHaveBeenCalled();

    fireEvent.click(rejectTrigger);
    dialog = screen.getByRole("dialog", { name: "Reject invoice" });
    expect(within(dialog).getByRole("textbox", { name: /Rejection reason/ })).toHaveValue("");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Reject invoice" })).not.toBeInTheDocument();
    expect(rejectTrigger).toHaveFocus();
    expect(pmInvoiceService.reviewInvoice).not.toHaveBeenCalled();

    fireEvent.click(rejectTrigger);
    dialog = screen.getByRole("dialog", { name: "Reject invoice" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Reject invoice" })).not.toBeInTheDocument();
    expect(rejectTrigger).toHaveFocus();
    expect(pmInvoiceService.reviewInvoice).not.toHaveBeenCalled();
  });

  it("keeps the modal open on rejection failure and prevents double submission", async () => {
    let rejectRequest;
    pmInvoiceService.reviewInvoice.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectRequest = { resolve, reject }; }));
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    fireEvent.click(within(screen.getByTestId("selected-invoice")).getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject invoice" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Rejection reason/ }), { target: { value: "Incorrect billing amount" } });
    const submit = within(dialog).getByRole("button", { name: "Reject invoice" });

    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(pmInvoiceService.reviewInvoice).toHaveBeenCalledTimes(1);

    rejectRequest.reject(new Error("Unable to reject invoice."));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Unable to reject invoice.");
    expect(screen.getByRole("dialog", { name: "Reject invoice" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reject invoice" })).toBeEnabled();
  });

  it("does not auto-select after pagination and keeps the zero-invoice state distinct", async () => {
    pmInvoiceService.listInvoices
      .mockResolvedValueOnce({ items: [submitted], total: 2, total_pages: 2, page: 1 })
      .mockResolvedValueOnce({ items: [approved], total: 2, total_pages: 2, page: 2 });
    render(<PmInvoicesPage />);
    await screen.findByTestId("selected-invoice-empty");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(pmInvoiceService.listInvoices).toHaveBeenLastCalledWith({ page: 2, pageSize: 25, sort: "generated_at", order: "desc" }));
    expect(screen.getByTestId("selected-invoice-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();

    pmInvoiceService.listInvoices.mockResolvedValueOnce({ items: [], total: 0, total_pages: 0, page: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("No invoices yet. Vendor-submitted invoices will appear here when they are ready for client review.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select an invoice" })).not.toBeInTheDocument();
  });

  it("returns to no selection when the selected invoice disappears on refresh", async () => {
    pmInvoiceService.listInvoices
      .mockResolvedValueOnce({ items: [submitted, approved], total: 2, total_pages: 1, page: 1 })
      .mockResolvedValueOnce({ items: [approved], total: 1, total_pages: 1, page: 1 });
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    fireEvent.click(within(screen.getByTestId("selected-invoice")).getByRole("button", { name: "Approve" }));
    expect(await screen.findByTestId("selected-invoice-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("selected-invoice")).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("uses immediate positioning when reduced motion is preferred", async () => {
    window.matchMedia.mockReturnValue({ matches: true });
    render(<PmInvoicesPage />);
    const history = await screen.findByTestId("invoice-history");
    fireEvent.click(within(history).getAllByRole("button", { name: "INV-2026-000007" })[0]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });
});
