/**
 * Reusable "nothing here yet" block — the same visual pattern every
 * existing page in this app already repeats inline (e.g.
 * VendorAssignmentsPage, PmMilestonesPage: "rounded-lg border-dashed
 * border-border bg-surface px-6 py-12 text-center"), pulled out into one
 * component for the dashboards so every KPI/chart/section renders the
 * exact same empty look rather than several slightly different ones.
 * `compact` shrinks the padding for use inside an already-boxed chart
 * card rather than as a full-page placeholder.
 */
export default function EmptyState({ message, hint, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface-muted text-center ${
        compact ? "px-4 py-6" : "px-6 py-12"
      }`}
    >
      <p className="text-sm text-text-secondary">{message}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}
