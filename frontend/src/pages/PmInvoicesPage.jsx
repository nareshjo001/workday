import { useCallback, useEffect, useRef, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import InvoiceTable from "../components/invoices/InvoiceTable";
import InvoiceCardList from "../components/invoices/InvoiceCardList";
import pmInvoiceService from "../services/pmInvoiceService";
import ListControls from "../components/ListControls";
import InvoiceDocumentPanel from "../components/invoices/InvoiceDocumentPanel";
import InvoiceReviewModal from "../components/invoices/InvoiceReviewModal";

function Icon({ children }) {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function HistoryIcon() { return <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Icon>; }

function EmptySelectedInvoice() {
  return <section data-testid="selected-invoice-empty" aria-labelledby="empty-invoice-heading" className="flex min-h-[190px] scroll-mt-24 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:min-h-[220px] sm:scroll-mt-28 sm:p-8">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-blue-100/70 bg-blue-50 text-blue-600 shadow-xs sm:h-12 sm:w-12" aria-hidden="true">
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    </div>
    <h2 id="empty-invoice-heading" className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Select an invoice</h2>
    <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm">Choose an invoice from the history below to view its details, totals, actions, and payment information.</p>
    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
      <span>Select a row below</span>
      <svg className="h-3 w-3 text-slate-400" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
    </div>
  </section>;
}

/**
 * PM invoice review and history for the PM's own projects. Ownership and
 * review eligibility remain server-enforced; this page only presents the
 * existing PM workflow using the shared invoice visual language.
 */
export default function PmInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const [reviewError, setReviewError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const rejectionTriggerRef = useRef(null);
  const selectedCardRef = useRef(null);
  const pendingScrollIdRef = useRef(null);

  const scrollSelectedInvoiceIntoView = useCallback(() => {
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      if (selectedCardRef.current && typeof selectedCardRef.current.scrollIntoView === "function") {
        selectedCardRef.current.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      }
    });
  }, []);

  const handleSelectInvoice = useCallback((invoice) => {
    if (!invoice) return;
    if (invoice.id === selectedInvoice?.id) {
      scrollSelectedInvoiceIntoView();
      return;
    }
    pendingScrollIdRef.current = invoice.id;
    setSelectedInvoice(invoice);
  }, [scrollSelectedInvoiceIntoView, selectedInvoice?.id]);

  useEffect(() => {
    if (pendingScrollIdRef.current && selectedInvoice?.id === pendingScrollIdRef.current) {
      pendingScrollIdRef.current = null;
      scrollSelectedInvoiceIntoView();
    }
  }, [scrollSelectedInvoiceIntoView, selectedInvoice?.id]);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmInvoiceService.listInvoices({ page, pageSize: 25, sort: "generated_at", order: "desc" });
      setInvoices(data.items);
      setSelectedInvoice((current) => current ? data.items.find((invoice) => invoice.id === current.id) || null : null);
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

  const approve = async (id) => {
    try {
      await pmInvoiceService.reviewInvoice(id, "APPROVED", null);
      loadInvoices();
    } catch (error) {
      setReviewError(error.message);
    }
  };

  const openRejectionModal = (id, triggerElement) => {
    const target = invoices.find((invoice) => invoice.id === id);
    if (!target) return;
    rejectionTriggerRef.current = triggerElement;
    setReviewError(null);
    setRejectionTarget(target);
  };

  const reject = async (id, rejectionReason) => {
    setReviewError(null);
    try {
      await pmInvoiceService.reviewInvoice(id, "REJECTED", rejectionReason);
      setRejectionTarget(null);
      loadInvoices();
    } catch (error) {
      setReviewError(error.message);
      throw error;
    }
  };

  const download = async () => {
    if (!selectedInvoice?.pdf_storage_key) return;
    try {
      const url = await pmInvoiceService.downloadPdf(selectedInvoice.id);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setReviewError(error.message);
    }
  };

  return <DashboardLayout title="Invoice reviews">
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Invoice Reviews</h1>
        <p className="text-xs text-slate-500 sm:text-sm">Review invoices submitted by Vendors for your projects, then track approved invoices and their settlement state.</p>
      </header>

      <AlertBanner message={loadError} />
      <AlertBanner message={reviewError} />

      {!isLoading && invoices.length > 0 && !selectedInvoice && <EmptySelectedInvoice />}
      {selectedInvoice && <div ref={selectedCardRef} className="scroll-mt-24 sm:scroll-mt-28"><InvoiceDocumentPanel invoice={selectedInvoice} onDownload={download} onPrint={() => window.print()} onApprove={approve} onReject={openRejectionModal} /></div>}

      {isLoading ? <Spinner label="Loading invoices…" /> : invoices.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Invoice history</h2>
          <p className="mt-1 text-sm text-slate-500">No invoices yet. Vendor-submitted invoices will appear here when they are ready for client review.</p>
        </section>
      ) : (
        <section data-testid="invoice-history" aria-labelledby="invoice-history-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600" aria-hidden="true"><HistoryIcon /></span>
            <div className="min-w-0"><h2 id="invoice-history-heading" className="text-base font-semibold text-slate-900">Invoice history</h2><p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Review submitted invoices and track their current status.</p></div>
          </div>
          <InvoiceTable invoices={invoices} selectedId={selectedInvoice?.id} onSelect={handleSelectInvoice} stackDateTime />
          <InvoiceCardList invoices={invoices} selectedId={selectedInvoice?.id} onSelect={handleSelectInvoice} />
          <ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
        </section>
      )}
    </main>
    {rejectionTarget && <InvoiceReviewModal invoice={rejectionTarget} returnFocusElement={rejectionTriggerRef.current} onClose={() => setRejectionTarget(null)} onReject={reject} />}
  </DashboardLayout>;
}
