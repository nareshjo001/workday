import { formatDate } from "../projects/format";

export { formatDate };

/**
 * Timesheet status badge — a different status set (PENDING/APPROVED/
 * REJECTED) from project's StatusBadge (ACTIVE/ON_HOLD/COMPLETED) in
 * ../projects/format, so this is its own small component rather than
 * overloading that one with an unrelated status vocabulary.
 */
const STATUS_STYLES = {
  PENDING: "bg-warning-bg text-warning",
  APPROVED: "bg-success-bg text-success",
  REJECTED: "bg-error-bg text-error",
};

export function TimesheetStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] || "bg-surface-muted text-muted"
      }`}
    >
      {status}
    </span>
  );
}

/**
 * submitted_at/reviewed_at are TIMESTAMP columns, returned as
 * "YYYY-MM-DD HH:MM:SS" strings (config/db.js's dateStrings:true pool
 * option applies to TIMESTAMP just like DATE) — NOT a bare "YYYY-MM-DD"
 * date. ../projects/format's formatDate expects exactly the latter (it
 * splits on "-" into exactly 3 parts), so passing a full timestamp
 * straight through would silently produce "Invalid Date". This splits
 * off the date portion first (reusing formatDate for it, no duplicated
 * date-formatting logic) and appends a plain, non-timezone-converted
 * HH:MM read of the time portion — deliberately not run through a Date
 * object at all, so there's no local-timezone reinterpretation of a
 * server-local TIMESTAMP value.
 */
/**
 * Renders an hours value (a raw number, e.g. a weekly total summed
 * client-side by weekGrouping.js) with at most 2 decimal places and no
 * trailing zeros — "7" stays "7", "7.5" stays "7.5", but floating-point
 * sums like "7.1 + 0.2" render as "7.3" rather than "7.300000000000001".
 */
export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return rounded.toString();
}

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
