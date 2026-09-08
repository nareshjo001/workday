import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import InvoiceReviewModal from "../components/invoices/InvoiceReviewModal";
import vendorInvoiceService from "../services/vendorInvoiceService";
import ListControls from "../components/ListControls";
import InvoiceDocumentPanel from "../components/invoices/InvoiceDocumentPanel";
import PaymentRecordModal from "../components/invoices/PaymentRecordModal";

/**
 * Vendor's invoice review queue (Module 6, invoice-workflow redesign):
 * every invoice for this vendor's own contractors, across every status,
 * with inline Approve / Reject actions on any row still PENDING_REVIEW
 * (approval authority moved here from the PM — see PmInvoicesPage, now
 * read-only). This component never sends or reads a vendor id itself;
 * ownership is enforced entirely server-side (see
 * vendorInvoiceService.listInvoices → invoiceRepository.listForVendor's
 * SQL filter on the invoice's own snapshotted vendor_id, and
 * vendorInvoiceService.reviewInvoice → invoiceRepository.lockOwnedByVendorForReview
 * for the mutation).
 */
export default function VendorInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const [queue,setQueue]=useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorInvoiceService.listInvoices({ page, pageSize: 25, sort: "generated_at", order: "desc" });
      setInvoices(data.items);
      setSelectedInvoice((current) => data.items.find((invoice) => invoice.id === current?.id) || data.items[0] || null);
      setPageInfo(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadInvoices();
    vendorInvoiceService.billingQueue().then(setQueue).catch(()=>{});
  }, [loadInvoices]);
  const createDraft=async(billingId)=>{try{const draft=await vendorInvoiceService.createDraft(billingId);setSelectedInvoice(draft);setSuccessMessage(`Draft #${draft.id} created.`);setQueue(q=>q.filter(x=>x.milestone_billing_id!==billingId));await loadInvoices();}catch(e){setActionError(e.message);}};
  const submitDraft=async()=>{if(selectedInvoice?.status!=="DRAFT")return;try{const updated=await vendorInvoiceService.submitDraft(selectedInvoice.id);setSelectedInvoice(updated);setInvoices(items=>items.map(invoice=>invoice.id===updated.id?updated:invoice));setSuccessMessage("Invoice submitted for client review.");}catch(error){setActionError(error.message);}};
  const download = async () => { if (!selectedInvoice?.pdf_storage_key) return; try { const url = await vendorInvoiceService.downloadPdf(selectedInvoice.id); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (error) { setActionError(error.message); } };
  const editDraftTerms = async () => { if (selectedInvoice?.status !== "DRAFT") return; const taxRate = window.prompt("Tax rate (%)", selectedInvoice.tax_rate ?? 0); if (taxRate === null) return; const description = window.prompt("Adjustment description", selectedInvoice.adjustments?.[0]?.description || ""); if (description === null) return; const amount = description ? window.prompt("Adjustment amount", selectedInvoice.adjustments?.[0]?.amount ?? 0) : "0"; if (amount === null) return; try { const updated = await vendorInvoiceService.updateDraft(selectedInvoice.id, { tax_rate: taxRate, adjustments: description ? [{ description, amount }] : [] }); setSelectedInvoice(updated); setInvoices((items) => items.map((invoice) => invoice.id === updated.id ? updated : invoice)); setSuccessMessage("Draft totals updated."); } catch (error) { setActionError(error.message); } };
  const recordPayment = async (payload) => { const result = await vendorInvoiceService.recordPayment(paymentTarget.id, payload); const updated = { ...paymentTarget, paid_amount: result.paid_amount, outstanding_amount: result.outstanding_amount, payment_state: result.payment_state, overdue: result.overdue, payments: result.payments }; setSelectedInvoice(updated); setInvoices((items) => items.map((invoice) => invoice.id === updated.id ? updated : invoice)); setPaymentTarget(null); setSuccessMessage("Payment recorded."); };

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleApprove = async (invoiceId) => {
    setActionError(null);
    setReviewingId(invoiceId);
    try {
      const updated = await vendorInvoiceService.approveInvoice(invoiceId);
      // Update in place (rather than dropping the row) — this page shows
      // full history, not just a pending queue, so a reviewed invoice
      // stays visible, just re-rendered in its read-only state.
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
      setSuccessMessage("Invoice approved.");
    } catch (err) {
      // A 409 here most often means someone else (or another tab) already
      // reviewed this exact invoice — refresh so the row reflects the true
      // server-side outcome instead of staying stuck on stale buttons.
      setActionError(err.message);
      loadInvoices();
    } finally {
      setReviewingId(null);
    }
  };

  const handleRejectConfirm = async (invoiceId, rejectionReason) => {
    setActionError(null);
    setReviewingId(invoiceId);
    try {
      const updated = await vendorInvoiceService.rejectInvoice(invoiceId, rejectionReason);
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
      setSuccessMessage("Invoice rejected.");
      setRejectTarget(null);
    } catch (err) {
      setActionError(err.message);
      loadInvoices();
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout title="Invoices">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Invoices</h1>
        <p className="text-sm text-muted">
          Build drafts from eligible milestone billings, submit them, then track client review.
        </p>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />
        {queue.length>0&&<section className="rounded-lg border border-border p-4"><h2 className="font-medium">Eligible billing queue</h2>{queue.map(item=><div key={item.milestone_billing_id} className="mt-2 flex items-center justify-between text-sm"><span>{item.approved_hours}h · {item.currency} {item.amount}</span><button className="rounded bg-primary px-2 py-1 text-white" onClick={()=>createDraft(item.milestone_billing_id)}>Create draft</button></div>)}</section>}
        {selectedInvoice && <><InvoiceDocumentPanel invoice={selectedInvoice} onDownload={download} onPrint={() => window.print()} onRecordPayment={selectedInvoice.status === "APPROVED" ? () => setPaymentTarget(selectedInvoice) : undefined} />{selectedInvoice.status === "DRAFT" && <div className="flex flex-wrap gap-2"><button className="rounded border border-border px-3 py-2 text-sm" onClick={editDraftTerms}>Edit tax and adjustment</button><button data-testid={`submit-invoice-${selectedInvoice.id}`} className="rounded bg-primary px-3 py-2 text-sm text-white" onClick={submitDraft}>Submit invoice</button></div>}</>}

        {isLoading ? (
          <Spinner label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No invoices yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Select an eligible milestone contribution above to create a draft.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <InvoiceTable
              invoices={invoices}
              reviewingId={reviewingId}
              onApprove={handleApprove}
              onReject={(id) => setRejectTarget(invoices.find((inv) => inv.id === id))}
            />
            <InvoiceCardList
              invoices={invoices}
              reviewingId={reviewingId}
              onApprove={handleApprove}
              onReject={(id) => setRejectTarget(invoices.find((inv) => inv.id === id))}
            />
            <div className="mt-3 flex flex-wrap gap-2">{invoices.map((invoice) => <button key={invoice.id} className="rounded border border-border px-2 py-1 text-xs" onClick={() => setSelectedInvoice(invoice)}>{invoice.invoice_number || `Draft #${invoice.id}`}</button>)}</div>
            <ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
          </div>
        )}
      </div>

      {rejectTarget && (
        <InvoiceReviewModal
          invoice={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleRejectConfirm}
        />
      )}
      {paymentTarget && <PaymentRecordModal invoice={paymentTarget} onClose={() => setPaymentTarget(null)} onSave={recordPayment} />}
    </DashboardLayout>
  );
}
