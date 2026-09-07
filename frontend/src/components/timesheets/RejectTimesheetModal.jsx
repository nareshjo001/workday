import { useState } from "react";
import Modal from "../Modal";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

export default function RejectTimesheetModal({ count, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    const value = reason.trim();
    if (!value) { setError("A rejection reason is required."); return; }
    setIsSubmitting(true); setError(null);
    try { await onConfirm(value); } catch (err) { setError(err.message); setIsSubmitting(false); }
  };
  return <Modal title={count === 1 ? "Reject timesheet" : `Reject ${count} timesheets`} onClose={onClose}>
    <form onSubmit={submit} className="flex flex-col gap-4">
      <AlertBanner message={error} />
      <div className="flex flex-col gap-1.5"><label htmlFor="rejectionReason" className="text-sm font-medium text-text-secondary">Reason</label><textarea id="rejectionReason" value={reason} maxLength={1000} rows={4} onChange={(event) => setReason(event.target.value)} className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Explain what must be corrected." /><p className="text-xs text-muted">This explanation is shown to the contractor.</p></div>
      <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary">Cancel</button><PrimaryButton className="flex-1" isLoading={isSubmitting} loadingText="Rejecting…">Reject</PrimaryButton></div>
    </form>
  </Modal>;
}
