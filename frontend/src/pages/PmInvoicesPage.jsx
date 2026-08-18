import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import pmInvoiceService from "../services/pmInvoiceService";

/**
 * PM's invoice HISTORY (Module 6, narrowed by the invoice-workflow
 * redesign): every invoice across the PM's own projects, any status,
 * READ-ONLY — a PM no longer approves or rejects (that authority moved
 * to the Vendor, see VendorInvoicesPage). Vendor-approved invoices sort
 * first (see invoiceRepository.listForPm's ORDER BY) since they're the
 * primary financial record a PM cares about; PENDING_REVIEW/
 * AUTO_APPROVED/REJECTED still show for full visibility. No
 * approve/reject controls are rendered anywhere on this page — passing
 * neither onApprove nor onReject to InvoiceTable/InvoiceCardList puts
 * both into their read-only branch (see those components' own comments).
 * Ownership is enforced entirely server-side (pmInvoiceService.listInvoices
 * → invoiceRepository.listForPm's SQL join on projects.pm_id).
 */
export default function PmInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmInvoiceService.listInvoices();
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

  return (
    <DashboardLayout title="Invoices">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Invoices</h1>
        <p className="text-sm text-muted">
          Read-only billing history for your projects. Vendors review and approve or reject each
          invoice — once approved, it appears here as your project's financial record.
        </p>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No invoices yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Invoices are generated automatically once a project milestone is met, and appear here
              once a Vendor has reviewed them.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <InvoiceTable invoices={invoices} />
            <InvoiceCardList invoices={invoices} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
