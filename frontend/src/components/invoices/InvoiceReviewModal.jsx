import { useState } from "react";
import Modal from "../Modal";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";
import { inputClassName } from "../FormField";
import { formatCurrency } from "./format";

const REJECTION_REASON_MAX_LENGTH = 500;

/**
 * Confirms a PM's rejection of a PENDING_REVIEW invoice, collecting the
 * required rejection reason (Approve needs no extra input, so it's a
 * direct one-click action on the table/card row — this modal is only
 * ever opened for Reject, mirroring how AssignContractorModal/
 * CreateMilestoneModal are each opened for one specific action rather
 * than being a generic multi-purpose dialog).
 */
export default function InvoiceReviewModal({ invoice, onClose, onReject }) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = reason.trim();
    if (!trimmed) {
      setFieldError("A rejection reason is required.");
      return;
    }
    if (trimmed.length > REJECTION_REASON_MAX_LENGTH) {
      setFieldError(`Rejection reason must be at most ${REJECTION_REASON_MAX_LENGTH} characters.`);
      return;
    }
    setFieldError(null);

    setIsSubmitting(true);
    try {
      await onReject(invoice.id, trimmed);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Reject Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />

        <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text-secondary">
          <p className="font-medium text-text">{invoice.project_name}</p>
          <p>{invoice.contractor_name} — {invoice.milestone_name}</p>
          <p className="mt-1 font-medium text-text">{formatCurrency(invoice.amount)}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rejection_reason" className="text-sm font-medium text-text-secondary">
            Rejection Reason
          </label>
          <textarea
            id="rejection_reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setFieldError(null);
            }}
            placeholder="e.g. Incorrect billing amount"
            className={inputClassName(fieldError)}
          />
          {fieldError && <p className="text-sm text-error">{fieldError}</p>}
        </div>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Rejecting…" className="flex-1">
            Reject Invoice
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
