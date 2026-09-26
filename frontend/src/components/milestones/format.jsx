import { formatDate } from "../projects/format";

export { formatDate };

const STATUS_STYLES = {
  PENDING: "bg-warning-bg text-warning",
  MET: "bg-success-bg text-success",
};

export function MilestoneStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${
        STATUS_STYLES[status] || "bg-surface-muted text-muted"
      }`}
    >
      {status === "MET" && (
        <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="10" r="9" />
          <path d="m6 10 2.5 2.5L14.5 7" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {status === "MET" ? "Met" : status}
    </span>
  );
}

export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return rounded.toString();
}

// Format numeric billing amounts only; callers handle pending milestones without billing.
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount) || 0);
}
