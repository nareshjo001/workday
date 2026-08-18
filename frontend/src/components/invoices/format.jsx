import { formatDate } from "../projects/format";

export { formatDate };

/**
 * Invoice status badge — its own status vocabulary (PENDING_REVIEW/
 * AUTO_APPROVED/APPROVED/REJECTED), same "one badge component per status
 * set" convention as ../milestones/format's MilestoneStatusBadge and
 * ../timesheets/format's TimesheetStatusBadge.
 */
const STATUS_STYLES = {
  PENDING_REVIEW: "bg-warning-bg text-warning",
  AUTO_APPROVED: "bg-success-bg text-success",
  APPROVED: "bg-success-bg text-success",
  REJECTED: "bg-error-bg text-error",
};

const STATUS_LABELS = {
  PENDING_REVIEW: "Pending Review",
  AUTO_APPROVED: "Auto-Approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function InvoiceStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] || "bg-surface-muted text-muted"
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/**
 * Renders an amount as US dollars — same small deliberate duplicate of
 * ../milestones/format's formatCurrency every feature folder already
 * keeps its own copy of, rather than a cross-folder import.
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount) || 0);
}

/**
 * generated_at/reviewed_at are TIMESTAMP columns (config/db.js's
 * dateStrings:true), returned as "YYYY-MM-DD HH:MM:SS", not a bare date
 * — same date+time split pattern as
 * ../timesheets/format.formatDateTime, duplicated here rather than
 * cross-imported for the same "small duplication over a cross-folder
 * coupling" reason every other feature folder's format.jsx already uses.
 */
export function formatDateTime(value) {
  if (!value) return "—";
  const [datePart, timePart] = value.split(" ");
  const dateLabel = formatDate(datePart);
  if (!timePart) return dateLabel;

  const [hourStr, minuteStr] = timePart.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return dateLabel;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${dateLabel}, ${hour12}:${minuteStr} ${period}`;
}
