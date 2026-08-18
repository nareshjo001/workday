import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import InvoiceReviewModal from "../components/invoices/InvoiceReviewModal";
import vendorInvoiceService from "../services/vendorInvoiceService";

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

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorInvoiceService.listInvoices();
      setInvoices(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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
          Review and approve or reject billing for your contractors. Once you decide, the Project
          Manager sees the outcome — they cannot approve or reject on your behalf.
        </p>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        {isLoading ? (
          <Spinner label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No invoices yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Invoices are generated automatically once one of your contractors' milestone
              contributions is billed.
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
    </DashboardLayout>
  );
}
