import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import pmInvoiceService from "../services/pmInvoiceService";
import ListControls from "../components/ListControls";
import InvoiceDocumentPanel from "../components/invoices/InvoiceDocumentPanel";

/**
 * PM invoice review and history for the PM's own projects. Submitted
 * invoices expose the existing approve/reject actions; every other state
 * remains an immutable history view.
 * Ownership is enforced entirely server-side (pmInvoiceService.listInvoices
 * → invoiceRepository.listForPm's SQL join on projects.pm_id).
 */
export default function PmInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const [reviewError,setReviewError]=useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmInvoiceService.listInvoices({ page, pageSize: 25, sort: "generated_at", order: "desc" });
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
  }, [loadInvoices]);
  const review=async(id,status)=>{const rejection_reason=status==='REJECTED'?window.prompt('Rejection reason (required):'):null;if(status==='REJECTED'&&!rejection_reason)return;try{await pmInvoiceService.reviewInvoice(id,status,rejection_reason);loadInvoices();}catch(e){setReviewError(e.message);}};
  const download = async () => { if (!selectedInvoice?.pdf_storage_key) return; try { const url = await pmInvoiceService.downloadPdf(selectedInvoice.id); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (error) { setReviewError(error.message); } };

  return (
    <DashboardLayout title="Invoices">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Invoices</h1>
        <p className="text-sm text-muted">
          Review invoices submitted by Vendors for your projects, then track approved invoices and
          their settlement state.
        </p>

        <AlertBanner message={loadError} />
        <AlertBanner message={reviewError} />
        {selectedInvoice && <InvoiceDocumentPanel invoice={selectedInvoice} onDownload={download} onPrint={() => window.print()} />}

        {isLoading ? (
          <Spinner label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No invoices yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Vendor-submitted invoices will appear here when they are ready for client review.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <InvoiceTable invoices={invoices} />
            <InvoiceCardList invoices={invoices} />
            <div className="mt-3 flex flex-wrap gap-2">{invoices.map((invoice) => <button key={invoice.id} className="rounded border border-border px-2 py-1 text-xs" onClick={() => setSelectedInvoice(invoice)}>{invoice.invoice_number || `Draft #${invoice.id}`}</button>)}</div>
            <div className="mt-4 flex flex-wrap gap-2">{invoices.filter(i=>i.status==='SUBMITTED').map(i=><div key={i.id} className="flex items-center gap-2 text-sm"><span>Invoice #{i.id}</span><button className="rounded bg-primary px-2 py-1 text-white" onClick={()=>review(i.id,'APPROVED')}>Approve</button><button className="rounded border border-danger px-2 py-1 text-danger" onClick={()=>review(i.id,'REJECTED')}>Reject</button></div>)}</div>
            <ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
