export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_STYLES = {
  ACTIVE: "bg-success-bg text-success",
  ON_HOLD: "bg-surface-muted text-muted",
  COMPLETED: "bg-primary-light text-primary",
};

export function StatusBadge({ status }) {
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
 * Staffing status is DERIVED server-side from requirements vs.
 * assignments (never stored) — this just renders whatever the API
 * already computed. See pmProjectService.deriveStaffingStatus /
 * vendorProjectService on the backend.
 */
export function StaffingBadge({ status }) {
  const isFullyStaffed = status === "FULLY_STAFFED";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        isFullyStaffed ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
      }`}
    >
      {isFullyStaffed ? "✓ Fully Staffed" : "⚠ Pending"}
    </span>
  );
}

/**
 * "4 / 6" style progress readout, reused for both the overall project
 * total and each individual per-skill requirement row.
 */
export function StaffingProgress({ assigned, required }) {
  const isFull = assigned >= required;
  return (
    <span className={`font-medium ${isFull ? "text-success" : "text-text-secondary"}`}>
      {assigned} / {required}
    </span>
  );
}

/**
 * Renders an hours value with at most 2 decimal places and no trailing
 * zeros. Small, deliberate duplicate of
 * components/timesheets/format.jsx's formatHours rather than a
 * cross-folder import — projects/ and timesheets/ have otherwise never
 * depended on each other, and this is a two-line pure function, the same
 * "small duplication over a new coupling" tradeoff this codebase already
 * makes for parsePositiveInt across validator files.
 */
export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return rounded.toString();
}
