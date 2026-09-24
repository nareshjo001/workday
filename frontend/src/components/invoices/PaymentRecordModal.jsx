import { useEffect, useRef, useState } from "react";

/**
 * PaymentRecordModal
 *
 * Compact enterprise dialog for recording invoice payments.
 *
 * Dimensions: ~560px desktop max-width, natural height (fits in 1280x720 without scrolling).
 * Layout:
 * - Header: Title + Close [X]
 * - Summary: Invoice number, project name, currency, outstanding balance (~64-72px)
 * - Row 1: Amount * (with currency prefix) | Paid at *
 * - Row 2: Reference | Method
 * - Row 3: Notes (full width, ~76-80px height)
 * - Footer: Cancel + Record payment
 *
 * Accessibility: role="dialog", aria-modal="true", autoFocus on Amount,
 * Escape closes, Tab trap, focus restored upon unmount.
 */
export default function PaymentRecordModal({ invoice, onClose, onSave }) {
  const [amount, setAmount] = useState(invoice.outstanding_amount ?? "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16));
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef(null);
  const amountInputRef = useRef(null);
  const triggerElementRef = useRef(null);

  // Store trigger element to restore focus on unmount
  useEffect(() => {
    triggerElementRef.current = document.activeElement;
    return () => {
      triggerElementRef.current?.focus?.();
    };
  }, []);

  // Autofocus amount input on mount
  useEffect(() => {
    amountInputRef.current?.focus?.();
  }, []);

  // Keyboard navigation: Escape to cancel, Tab focus trap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    const outstanding = Number(invoice.outstanding_amount ?? 0);

    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive payment amount.");
      return;
    }
    if (Math.round(numAmount * 100) !== numAmount * 100) {
      setError("Payment amount cannot have more than two decimal places.");
      return;
    }
    if (outstanding <= 0 || invoice.payment_state === "PAID") {
      setError("This invoice is already fully paid.");
      return;
    }
    if (numAmount > outstanding) {
      setError(
        `Payment amount cannot exceed outstanding balance of ${invoice.currency || "$"} ${outstanding.toFixed(2)}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadAmount = typeof amount === "number" ? amount : (Number.isNaN(numAmount) ? amount : numAmount);
      await onSave({ amount: payloadAmount, paid_at: paidAt, reference, method, notes });
    } catch (cause) {
      setError(cause.message || "Failed to record payment.");
      setIsSubmitting(false);
    }
  };

  const currency = invoice.currency || "USD";
  const formattedOutstanding = Number(invoice.outstanding_amount || 0).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl transition-all max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h2
            id="record-payment-title"
            className="text-lg sm:text-[20px] font-bold text-slate-900 tracking-tight"
          >
            Record payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Invoice Summary */}
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 sm:p-3.5 min-h-[64px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80 shadow-xs"
              aria-hidden="true"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs sm:text-sm font-bold text-slate-900">
                Invoice: {invoice.invoice_number || `Draft #${invoice.id}`}
              </p>
              <p className="truncate text-[11px] sm:text-xs text-slate-500">
                {invoice.project_name || "Project details pending"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end justify-center rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-right shadow-2xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Outstanding
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#2446b8] tabular-nums">
              {currency} {formattedOutstanding}
            </span>
            <span className="sr-only">
              Outstanding: {currency} {formattedOutstanding}
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3.5 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={submit} noValidate className="mt-3.5 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
            {/* Amount */}
            <div>
              <label htmlFor="payment-amount" className="block text-xs font-semibold text-slate-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <span className="flex h-10 items-center justify-center px-3 border-r border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase select-none rounded-l-lg">
                  {currency}
                </span>
                <input
                  ref={amountInputRef}
                  id="payment-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(invoice.outstanding_amount) > 0 ? Number(invoice.outstanding_amount) : undefined}
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-10 w-full rounded-r-lg border-0 bg-transparent px-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 tabular-nums"
                  style={{ outline: "none", border: "none", boxShadow: "none" }}
                />
              </div>
            </div>

            {/* Paid at */}
            <div>
              <label htmlFor="payment-paid-at" className="block text-xs font-semibold text-slate-700 mb-1">
                Paid at <span className="text-red-500">*</span>
              </label>
              <input
                id="payment-paid-at"
                name="paidAt"
                type="datetime-local"
                required
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Reference */}
            <div>
              <label htmlFor="payment-reference" className="block text-xs font-semibold text-slate-700 mb-1">
                Reference
              </label>
              <input
                id="payment-reference"
                name="reference"
                type="text"
                maxLength={120}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Payment reference or transaction ID"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Method */}
            <div>
              <label htmlFor="payment-method" className="block text-xs font-semibold text-slate-700 mb-1">
                Method
              </label>
              <select
                id="payment-method"
                name="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select payment method</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="ACH">ACH</option>
                <option value="WIRE_TRANSFER">Wire transfer</option>
                <option value="CHECK">Check</option>
                <option value="CREDIT_CARD">Credit card</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="payment-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              id="payment-notes"
              name="notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal notes or transaction details"
              className="h-[76px] sm:h-[80px] w-full resize-none rounded-lg border border-slate-300 bg-white p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4.5 text-xs sm:text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? "Recording…" : "Record payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
