import { useEffect, useRef, useState } from "react";

export default function EditTaxModal({ invoice, onClose, onSave }) {
  const existingTax = invoice?.tax_rate ?? 0;
  const existingAdj =
    invoice?.adjustments?.[0]?.amount ?? invoice?.adjustment_amount ?? 0;
  const existingDesc =
    invoice?.adjustments?.[0]?.description ??
    (Number(invoice?.adjustment_amount) ? "Adjustment" : "");

  const [taxRate, setTaxRate] = useState(String(existingTax));
  const [adjustmentAmount, setAdjustmentAmount] = useState(String(existingAdj));
  const [adjustmentDescription, setAdjustmentDescription] = useState(existingDesc);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef(null);
  const taxInputRef = useRef(null);
  const triggerRef = useRef(null);

  // Restore focus to the opening trigger when the modal closes.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      triggerRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    taxInputRef.current?.focus?.();
  }, []);

  // Keep keyboard focus inside the dialog and allow Escape to close it.
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const taxNum = Number(taxRate);
    if (
      taxRate === "" ||
      Number.isNaN(taxNum) ||
      taxNum < 0 ||
      taxNum > 100 ||
      Math.round(taxNum * 100) !== taxNum * 100
    ) {
      setError("Tax rate must be a valid percentage between 0 and 100 with at most 2 decimal places.");
      return;
    }

    const adjNum = Number(adjustmentAmount);
    if (
      adjustmentAmount !== "" &&
      (Number.isNaN(adjNum) || Math.round(adjNum * 100) !== adjNum * 100)
    ) {
      setError("Adjustment amount must be a valid number with at most 2 decimal places.");
      return;
    }

    const trimmedDesc = adjustmentDescription.trim();
    if (adjNum !== 0 && trimmedDesc.length > 200) {
      setError("Adjustment description cannot exceed 200 characters.");
      return;
    }

    const adjustments =
      adjNum !== 0
        ? [
            {
              description: trimmedDesc || "Adjustment",
              amount: String(adjNum),
            },
          ]
        : [];

    setIsSubmitting(true);
    try {
      await onSave({
        taxRate: String(taxNum),
        adjustments,
      });
    } catch (err) {
      setError(err.message || "Failed to update draft terms.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-tax-title"
      aria-describedby="edit-tax-description"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[390px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4">
          <h2
            id="edit-tax-title"
            className="text-base sm:text-lg font-bold text-slate-900 tracking-tight"
          >
            Edit tax and adjustment
          </h2>
          <p
            id="edit-tax-description"
            className="mt-0.5 text-xs sm:text-sm text-slate-500"
          >
            Set the tax percentage and adjustment for this draft invoice.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <div>
            <label
              htmlFor="tax-rate-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Tax rate (%)
            </label>
            <div className="relative">
              <input
                ref={taxInputRef}
                id="tax-rate-input"
                name="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                %
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="adjustment-amount-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Adjustment ($)
            </label>
            <input
              id="adjustment-amount-input"
              name="adjustmentAmount"
              type="number"
              step="0.01"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label
              htmlFor="adjustment-description-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Adjustment description
            </label>
            <input
              id="adjustment-description-input"
              name="adjustmentDescription"
              type="text"
              maxLength={200}
              value={adjustmentDescription}
              onChange={(e) => setAdjustmentDescription(e.target.value)}
              placeholder="e.g. Handling, Discount"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs sm:text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
