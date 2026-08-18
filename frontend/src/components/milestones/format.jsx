import { formatDate } from "../projects/format";

export { formatDate };

/**
 * Milestone status badge — its own small status vocabulary
 * (PENDING/MET), same "one badge component per status set" convention as
 * ../timesheets/format's TimesheetStatusBadge and ../projects/format's
 * StatusBadge/StaffingBadge.
 */
const STATUS_STYLES = {
  PENDING: "bg-warning-bg text-warning",
  MET: "bg-success-bg text-success",
};

export function MilestoneStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] || "bg-surface-muted text-muted"
      }`}
    >
      {status === "MET" ? "✓ Met" : status}
    </span>
  );
}

/**
 * Renders an hours value with at most 2 decimal places and no trailing
 * zeros — same small deliberate duplicate of formatHours every other
 * feature folder (projects/, timesheets/) already keeps its own copy of,
 * rather than a cross-folder import.
 */
export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return rounded.toString();
}

/**
 * Renders a billing_amount as US dollars. billing_amount is null for a
 * still-PENDING milestone (no billing row exists yet) — callers should
 * check that themselves before deciding what to show; this only formats
 * an actual number.
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount) || 0);
}
