import { formatDate } from "../projects/format";

export { formatDate };

const STATUS_STYLES = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
};

export function TimesheetStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
        STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

// Round hours to two decimals without trailing zeros.
export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return rounded.toString();
}

// Format server-local timestamps without timezone conversion.
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

export function formatDateTimeSplit(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split(" ");
  const dateLabel = formatDate(datePart);
  if (!timePart) return { date: dateLabel, time: "" };

  const [hourStr, minuteStr] = timePart.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return { date: dateLabel, time: "" };
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    date: dateLabel,
    time: `${hour12}:${minuteStr} ${period}`,
  };
}
