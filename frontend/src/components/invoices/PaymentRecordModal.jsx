import { useState } from "react";

export default function PaymentRecordModal({ invoice, onClose, onSave }) {
  const [amount, setAmount] = useState(invoice.outstanding_amount ?? "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16));
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const submit = async (event) => { event.preventDefault(); setError(null); try { await onSave({ amount, paid_at: paidAt, reference, method, notes }); } catch (cause) { setError(cause.message); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Record payment">
    <form className="ui-modal-panel w-full max-w-xl rounded-lg bg-surface p-5 shadow-card sm:p-6" onSubmit={submit}>
      <h2 className="text-lg font-semibold text-text">Record payment</h2>
      <p className="mt-1 text-sm text-muted">Outstanding: {invoice.currency} {Number(invoice.outstanding_amount || 0).toFixed(2)}</p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <label className="mt-4 block text-sm">Amount<input required inputMode="decimal" className="mt-1 w-full rounded border border-border p-2" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="mt-3 block text-sm">Paid at<input required type="datetime-local" className="mt-1 w-full rounded border border-border p-2" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></label>
      <label className="mt-3 block text-sm">Reference<input className="mt-1 w-full rounded border border-border p-2" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      <label className="mt-3 block text-sm">Method<input className="mt-1 w-full rounded border border-border p-2" value={method} onChange={(e) => setMethod(e.target.value)} /></label>
      <label className="mt-3 block text-sm">Notes<textarea className="mt-1 w-full rounded border border-border p-2" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded border border-border px-3 py-2 text-sm" onClick={onClose}>Cancel</button><button className="rounded bg-primary px-3 py-2 text-sm text-white">Record payment</button></div>
    </form>
  </div>;
}
