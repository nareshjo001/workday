/**
 * Dashboard folder's own small format helpers — same deliberate
 * "duplicate the formatter rather than cross-import between feature
 * folders" convention already used by projects/format.jsx,
 * timesheets/format.jsx, milestones/format.jsx, and invoices/format.jsx
 * (each keeps its own formatCurrency/formatDateTime copy). Currency
 * stays USD, matching every other formatCurrency in this app — the
 * dashboards don't introduce a new currency convention.
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount) || 0);
}

export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return `${rounded}h`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * TIMESTAMP columns come back as "YYYY-MM-DD HH:MM:SS" strings
 * (config/db.js's dateStrings:true) — same split-and-format approach as
 * invoices/format.jsx's formatDateTime.
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
