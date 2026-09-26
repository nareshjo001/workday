import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import AlertBanner from "../AlertBanner";
import { formatDate } from "./format";

const REJECTION_REASON_MAX_LENGTH = 500;

function RejectIcon({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h6M9 16h6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function HeaderArtwork() {
  return (
    <svg aria-hidden="true" className="hidden h-16 w-[168px] lg:block" viewBox="0 0 330 126" fill="none">
      <path d="M26 121C73 62 129 41 194 55c45 10 79 35 116 61" stroke="#FCA5A5" strokeWidth="1.5" strokeDasharray="6 7" />
      <path d="M0 126c44-50 92-68 142-55 42 11 75 43 123 55H0Z" fill="#FEE2E2" fillOpacity=".42" />
      <circle cx="41" cy="50" r="9" fill="#FCA5A5" />
      <circle cx="297" cy="101" r="8" fill="#FCA5A5" />
      <rect x="151" y="6" width="112" height="116" rx="15" fill="white" fillOpacity=".78" stroke="#FCA5A5" strokeWidth="3" />
      <path d="M177 33h55M177 52h43M177 71h47M177 90h31" stroke="#FCA5A5" strokeWidth="8" strokeLinecap="round" strokeOpacity=".58" />
      <circle cx="262" cy="87" r="33" fill="#EF4444" />
      <path d="m248 73 28 28m0-28-28 28" stroke="white" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function invoiceDate(value) {
  if (!value) return "—";
  return formatDate(String(value).split(/[ T]/)[0]);
}

// Capture the rejection trigger so focus returns to it when the dialog closes.
export default function InvoiceReviewModal({ invoice, returnFocusElement, onClose, onReject }) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = returnFocusElement || document.activeElement;
    textareaRef.current?.focus();
    return () => triggerRef.current?.focus?.();
  }, [returnFocusElement]);

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setFieldError("A rejection reason is required.");
      return;
    }
    if (trimmedReason.length > REJECTION_REASON_MAX_LENGTH) {
      setFieldError(`Rejection reason must be at most ${REJECTION_REASON_MAX_LENGTH} characters.`);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);
    try {
      await onReject(invoice.id, trimmedReason);
    } catch (error) {
      setFormError(error.message || "Unable to reject this invoice.");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Reject invoice"
      subtitle="Provide a reason for rejecting this invoice."
      icon={<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600" aria-hidden="true"><RejectIcon className="h-5 w-5" /></span>}
      headerActions={<HeaderArtwork />}
      onClose={close}
      lockDocumentScroll
      panelClassName="max-h-[calc(100dvh-32px)] !w-[calc(100vw-32px)] !max-w-[600px] overflow-y-auto rounded-2xl p-0 shadow-2xl sm:p-0"
      headerClassName="relative mb-0 min-h-[84px] items-start overflow-hidden bg-gradient-to-r from-white via-red-50/35 to-red-50/80 px-5 py-3.5 sm:min-h-[90px] sm:px-6 sm:py-4 [&>div:first-child]:items-center [&_h2]:text-base [&_h2]:font-bold [&_h2]:tracking-tight [&_p]:mt-0.5 [&_p]:text-[11px] [&_p]:leading-4 sm:[&_h2]:text-lg sm:[&_p]:text-xs [&_.ui-modal-header-actions]:items-start [&_.ui-modal-header-actions_button_svg]:h-4 [&_.ui-modal-header-actions_button_svg]:w-4"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-3 px-5 py-3.5 sm:px-6 sm:py-4">
          <AlertBanner message={formError} />

          <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex min-w-0 items-center gap-3 p-3 sm:px-3.5 sm:py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true"><InvoiceIcon /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-[11px]">Invoice</p>
                <p className="mt-0.5 truncate text-sm font-bold tracking-tight text-slate-900 sm:text-[15px]" title={invoice.invoice_number || `Invoice #${invoice.id}`}>{invoice.invoice_number || `Invoice #${invoice.id}`}</p>
                <p className="truncate text-[11px] text-slate-500 sm:text-xs" title={invoice.project_name || "Project unavailable"}>{invoice.project_name || "Project unavailable"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 border-t border-slate-200 p-3 sm:border-l sm:border-t-0 sm:px-3.5 sm:py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-xs ring-1 ring-slate-200 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true"><CalendarIcon /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-[11px]">Invoice date</p>
                <p className="mt-0.5 text-[13px] font-semibold text-slate-900 sm:text-sm">{invoiceDate(invoice.generated_at)}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="invoice-rejection-reason" className="text-[13px] font-semibold text-slate-900">
                Rejection reason <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <span className="text-[11px] tabular-nums text-slate-500 sm:text-xs" aria-hidden="true">{reason.length}/{REJECTION_REASON_MAX_LENGTH}</span>
            </div>
            <textarea
              ref={textareaRef}
              id="invoice-rejection-reason"
              rows={4}
              maxLength={REJECTION_REASON_MAX_LENGTH}
              required
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setFieldError(null);
              }}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "invoice-rejection-reason-error" : undefined}
              placeholder="Enter the reason for rejection..."
              className={`h-[88px] min-h-[88px] w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${fieldError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"}`}
            />
            {fieldError && <p id="invoice-rejection-reason-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">{fieldError}</p>}
          </div>

          <div className="flex min-h-9 items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-[11px] text-blue-900 sm:items-center">
            <span className="mt-0.5 shrink-0 text-blue-600 sm:mt-0" aria-hidden="true"><InfoIcon /></span>
            <p className="leading-relaxed">This reason will be visible to the vendor and recorded in the invoice history.</p>
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <button type="button" onClick={close} disabled={isSubmitting} className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-24">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[150px]">
            {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <RejectIcon className="h-4 w-4" />}
            {isSubmitting ? "Rejecting…" : "Reject invoice"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
