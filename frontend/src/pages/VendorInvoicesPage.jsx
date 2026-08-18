import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import vendorInvoiceService from "../services/vendorInvoiceService";

/**
 * Vendor's read-only invoice history (Module 6): every invoice for this
 * vendor's own contractors, newest first, across every status. No
 * approve/reject controls anywhere on this page — a Vendor can see the
 * outcome but never act on it (that's the PM's role, see
 * PmInvoicesPage). Ownership is enforced entirely server-side (see
 * vendorInvoiceService.listForVendor → invoiceRepository.listForVendor's
 * SQL filter on the invoice's own snapshotted vendor_id).
 */
export default function VendorInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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

  return (
    <DashboardLayout title="Invoices">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Invoices</h1>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No invoices yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Invoices are generated automatically once one of your contractors' milestones is met.
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
