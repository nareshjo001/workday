// Format dashboard currency consistently as USD.
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

// Format MySQL timestamp strings without reinterpreting their timezone.
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
