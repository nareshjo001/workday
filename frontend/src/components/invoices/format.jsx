import { formatDate } from "../projects/format";

export { formatDate };

const STATUS_STYLES = {
  DRAFT: "border border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border border-blue-200 bg-blue-50 text-blue-700",
  PENDING_REVIEW: "bg-warning-bg text-warning",
  AUTO_APPROVED: "bg-success-bg text-success",
  APPROVED: "bg-success-bg text-success",
  REJECTED: "bg-error-bg text-error",
  PAID: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border border-slate-200 bg-slate-100 text-slate-500",
};

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_REVIEW: "Pending Review",
  AUTO_APPROVED: "Auto-Approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export function InvoiceStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold leading-none ${
        STATUS_STYLES[status] || "bg-surface-muted text-muted"
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount) || 0);
}

// Format MySQL date/time strings without local-timezone conversion.
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
