import { useState } from "react";
import AlertBanner from "../AlertBanner";
import Spinner from "../Spinner";

const actionable = new Set(["SUBMITTED", "SHORTLISTED"]);

export default function CandidateReviewQueue({ submissions, loading, error, onDecision }) {
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(null);
  const queue = (submissions || []).filter((item) => actionable.has(item.status));

  const decide = async (item, status, rejectionReason = null) => {
    setBusyId(item.id); setActionError(null);
    try {
      await onDecision(item.id, status, rejectionReason);
      setSuccess(`${item.contractor_name} was ${status.toLowerCase()}.`);
      setRejecting(null); setReason("");
    } catch (err) { setActionError(err.message); } finally { setBusyId(null); }
  };

  return <section className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6" aria-labelledby="candidate-review-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 id="candidate-review-title" className="text-lg font-semibold text-text">Candidate review queue</h2><p className="mt-1 text-sm text-muted">Review candidates submitted to your projects. Acceptance creates the assignment through the existing protected workflow.</p></div><span className="text-sm text-muted">{queue.length} awaiting review</span></div>
    <div className="mt-4"><AlertBanner message={actionError || error} /><AlertBanner message={success} variant="success" /></div>
    {loading ? <div className="mt-5"><Spinner label="Loading candidate reviews…" /></div> : queue.length === 0 ? <p className="mt-5 rounded border border-dashed border-border p-5 text-sm text-muted">No candidates are awaiting review.</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-border text-muted"><tr><th className="pb-2 pr-3">Candidate</th><th className="pb-2 pr-3">Vendor</th><th className="pb-2 pr-3">Project / requirement</th><th className="pb-2 pr-3">Proposed dates</th><th className="pb-2">Decision</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id} data-testid={`candidate-${item.id}`} className="border-b border-border align-top last:border-0"><td className="py-3 pr-3 font-medium text-text">{item.contractor_name}</td><td className="py-3 pr-3 text-text-secondary">{item.vendor_name}</td><td className="py-3 pr-3"><div>{item.project_name}</div><div className="text-muted">{item.skill}</div></td><td className="py-3 pr-3 text-text-secondary">{item.proposed_start_date}{item.proposed_end_date ? ` – ${item.proposed_end_date}` : ""}</td><td className="py-3"><div className="flex flex-wrap gap-2"><button type="button" data-testid={`accept-candidate-${item.id}`} disabled={busyId === item.id} onClick={() => decide(item, "ACCEPTED")} className="rounded bg-success-bg px-3 py-1.5 text-xs font-medium text-success disabled:opacity-50">Accept</button><button type="button" data-testid={`reject-candidate-${item.id}`} disabled={busyId === item.id} onClick={() => { setRejecting(item); setReason(""); setActionError(null); }} className="rounded border border-danger px-3 py-1.5 text-xs font-medium text-danger disabled:opacity-50">Reject</button></div></td></tr>)}</tbody></table></div>}
    {rejecting && <div className="mt-4 rounded border border-danger/30 bg-surface-muted p-4" role="dialog" aria-label="Reject candidate"><p className="font-medium text-text">Reject {rejecting.contractor_name}</p><label className="mt-3 block text-sm text-text-secondary" htmlFor="candidate-rejection-reason">Reason <textarea id="candidate-rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block min-h-20 w-full rounded border border-border bg-surface p-2 text-text" /></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setRejecting(null); setReason(""); }} className="rounded border border-border px-3 py-2 text-sm">Cancel</button><button type="button" disabled={!reason.trim() || busyId === rejecting.id} onClick={() => decide(rejecting, "REJECTED", reason.trim())} className="rounded bg-danger px-3 py-2 text-sm text-white disabled:opacity-50">Confirm rejection</button></div></div>}
  </section>;
}
