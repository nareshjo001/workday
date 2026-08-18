import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import InvoiceReviewModal from "../components/invoices/InvoiceReviewModal";
import pmInvoiceService from "../services/pmInvoiceService";

/**
 * PM's invoice-review queue (Module 6): every PENDING_REVIEW invoice
 * across the PM's own projects, with inline Approve / Reject actions.
 * AUTO_APPROVED invoices never appear here — they were never PM-actioned
 * in the first place (see invoiceService.determineInitialStatus on the
 * backend). This component never sends or reads a pm id itself; ownership
 * is enforced entirely server-side (see pmInvoiceService.listPending →
 * invoiceRepository.listPendingForPm's SQL join on projects.pm_id).
 */
export default function PmInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmInvoiceService.listPending();
      setInvoices(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleApprove = async (invoiceId) => {
    setActionError(null);
    setReviewingId(invoiceId);
    try {
      await pmInvoiceService.approveInvoice(invoiceId);
      // A reviewed invoice drops out of the PENDING_REVIEW queue
      // immediately — re-fetching the full list isn't necessary since
      // the only thing that changed is this one row leaving that state.
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      setSuccessMessage("Invoice approved.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const handleRejectConfirm = async (invoiceId, rejectionReason) => {
    setActionError(null);
    setReviewingId(invoiceId);
    try {
      await pmInvoiceService.rejectInvoice(invoiceId, rejectionReason);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      setSuccessMessage("Invoice rejected.");
      setRejectTarget(null);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout title="Invoice Review">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Invoice Review</h1>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        {isLoading ? (
          <Spinner label="Loading pending invoices…" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No invoices awaiting review.</p>
            <p className="max-w-sm text-sm text-muted">
              Invoices generated for milestones on your projects that are at or above the auto-approval
              threshold will show up here.
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
