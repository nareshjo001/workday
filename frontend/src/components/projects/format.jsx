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
 * Project hours/allocation redesign: HOURS staffing status
 * (PENDING_STAFFING / FULLY_STAFFED, derived from allocated vs.
 * expected_hours) — deliberately a SEPARATE badge from StaffingBadge
 * above, which renders the skill-HEADCOUNT staffing status. A project
 * can be fully staffed on headcount while still pending on hours, or vice
 * versa; these are never merged into one indicator. Renders nothing for
 * legacy projects with no expected_hours set (status is null there —
 * see pmProjectService.deriveHoursStaffingStatus on the backend).
 */
export function HoursStaffingBadge({ status }) {
  if (!status) return null;
  const isFullyStaffed = status === "FULLY_STAFFED";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        isFullyStaffed ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
      }`}
    >
      {isFullyStaffed ? "✓ Fully Staffed" : "⚠ Pending Staffing"}
    </span>
  );
}

/**
 * Project hours/allocation redesign: the "Work: 85/150h 56.7%" readout —
 * project-wide APPROVED hours over expected_hours, server-computed
 * (pmProjectService/vendorProjectService toProjectView), capped at 100%
 * for display. Deliberately distinct from StaffingProgress above (which
 * shows allocated/staffed capacity, not actual approved work) and from
 * milestone progress (which tracks discrete threshold checkpoints, not a
 * continuous percentage). Renders nothing for legacy projects with no
 * expected_hours set.
 */
export function WorkProgress({ approvedHours, expectedHours, progressPercent }) {
  if (expectedHours === null || expectedHours === undefined) return null;
  return (
    <span className="text-text-secondary">
      Work: <span className="font-medium text-text">{formatHours(approvedHours)}</span>/
      {formatHours(expectedHours)}h{" "}
      <span className={progressPercent >= 100 ? "font-medium text-success" : ""}>
        {progressPercent}%
      </span>
    </span>
  );
}

/**
 * Project hours/allocation redesign: the "Staffing: 150/150h" hours-based
 * counterpart to StaffingProgress (which counts headcount, not hours).
 */
export function HoursStaffingProgress({ allocatedHours, expectedHours }) {
  if (expectedHours === null || expectedHours === undefined) return null;
  return (
    <span className="text-text-secondary">
      Staffing: <span className="font-medium text-text">{formatHours(allocatedHours)}</span>/
      {formatHours(expectedHours)}h
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
