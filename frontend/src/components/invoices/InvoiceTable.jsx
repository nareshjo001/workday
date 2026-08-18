import { formatDateTime, formatCurrency, InvoiceStatusBadge } from "./format";

/**
 * Desktop presentation of an invoice list — hidden below md, where
 * InvoiceCardList takes over. Same split pattern as
 * components/projects/ProjectTable + ProjectCardList, and shared between
 * two different screens the same way ProjectTable is shared between the
 * PM and Contractor project lists:
 *
 *   - VendorInvoicesPage (invoice-workflow redesign: approval authority
 *     moved here from the PM) passes `reviewingId`/`onApprove`/`onReject`
 *     over its FULL invoice history (every status, not just
 *     PENDING_REVIEW) — an Actions column renders for each row still
 *     PENDING_REVIEW; every other row (already APPROVED/REJECTED/
 *     AUTO_APPROVED) shows Status/Reviewed instead, since there is
 *     nothing left to action on a terminal-state invoice.
 *   - PmInvoicesPage passes neither (read-only history across every
 *     status, PM can no longer approve/reject at all) — Status/Reviewed
 *     render for every row.
 *
 * Whether review CONTROLS are even offered is derived from whether
 * `onApprove` was passed at all (same "extra columns render
 * automatically based on which fields are actually present" idea
 * ProjectTable already uses, just keyed off a callback prop instead of a
 * data field); WHICH rows actually show them is then further narrowed to
 * `status === 'PENDING_REVIEW'` per row.
 */
export default function InvoiceTable({ invoices, reviewingId, onApprove, onReject }) {
  const reviewModeAvailable = typeof onApprove === "function";

  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <th className="py-3 pr-4 font-medium">Project</th>
          <th className="py-3 pr-4 font-medium">Contractor</th>
          <th className="py-3 pr-4 font-medium">Milestone</th>
          <th className="py-3 pr-4 font-medium">Amount</th>
          <th className="py-3 pr-4 font-medium">Generated</th>
          {reviewModeAvailable ? (
            <th className="py-3 pr-0 font-medium">Review</th>
          ) : (
            <>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-0 font-medium">Reviewed</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => {
          const isBusy = reviewingId === inv.id;
          const showActions = reviewModeAvailable && inv.status === "PENDING_REVIEW";
          return (
            <tr key={inv.id} className="border-b border-border last:border-0">
              <td className="py-3 pr-4 font-medium text-text">{inv.project_name}</td>
              <td className="py-3 pr-4 text-text-secondary">{inv.contractor_name}</td>
              <td className="py-3 pr-4 text-text-secondary">{inv.milestone_name}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatCurrency(inv.amount)}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatDateTime(inv.generated_at)}</td>
              {reviewModeAvailable ? (
                <td className="py-3 pr-0">
                  {showActions ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onApprove(inv.id)}
                        className="rounded-md bg-success-bg px-3 py-1.5 text-xs font-medium text-success transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onReject(inv.id)}
                        className="rounded-md bg-error-bg px-3 py-1.5 text-xs font-medium text-error transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <InvoiceStatusBadge status={inv.status} />
                      {inv.rejection_reason && (
                        <span className="text-xs text-error">{inv.rejection_reason}</span>
                      )}
                    </div>
                  )}
                </td>
              ) : (
                <>
                  <td className="py-3 pr-4">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="py-3 pr-0 text-text-secondary">
                    {inv.reviewed_at ? formatDateTime(inv.reviewed_at) : "—"}
                    {inv.rejection_reason && (
                      <p className="mt-1 max-w-xs text-xs text-error">{inv.rejection_reason}</p>
                    )}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
