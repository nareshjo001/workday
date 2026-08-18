import { formatDateTime, formatCurrency, InvoiceStatusBadge } from "./format";

/**
 * Mobile presentation of an invoice list — visible below md, where
 * InvoiceTable takes over. Same split pattern as
 * components/projects/ProjectCardList, and shared between Vendor review
 * mode and PM read-only history the same way InvoiceTable is — see that
 * component's own comment for the reviewModeAvailable/showActions
 * rationale (invoice-workflow redesign: review controls only ever render
 * for a row still PENDING_REVIEW, even on the Vendor's page, which shows
 * full history not just the pending queue).
 */
export default function InvoiceCardList({ invoices, reviewingId, onApprove, onReject }) {
  const reviewModeAvailable = typeof onApprove === "function";

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {invoices.map((inv) => {
        const isBusy = reviewingId === inv.id;
        const showActions = reviewModeAvailable && inv.status === "PENDING_REVIEW";
        return (
          <div key={inv.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-text">{inv.project_name}</p>
                <p className="text-xs text-muted">{inv.contractor_name}</p>
              </div>
              {!showActions && <InvoiceStatusBadge status={inv.status} />}
            </div>
            <p className="mt-2 text-sm text-text-secondary">{inv.milestone_name}</p>
            <p className="mt-1 text-sm font-medium text-text">{formatCurrency(inv.amount)}</p>
            <p className="mt-1 text-xs text-muted">Generated {formatDateTime(inv.generated_at)}</p>

            {showActions ? (
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onApprove(inv.id)}
                  className="flex-1 rounded-md bg-success-bg px-3 py-2 text-sm font-medium text-success transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onReject(inv.id)}
                  className="flex-1 rounded-md bg-error-bg px-3 py-2 text-sm font-medium text-error transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs text-muted">
                  {inv.reviewed_at ? `Reviewed ${formatDateTime(inv.reviewed_at)}` : "Not yet reviewed"}
                </p>
                {inv.rejection_reason && <p className="mt-1 text-xs text-error">{inv.rejection_reason}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
