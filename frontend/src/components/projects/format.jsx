import ProgressBar from "../dashboard/ProgressBar";
import { resolveProjectStatusTheme } from "../../utils/projectStatusTheme";

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

// Use the shared status theme for consistent project colors and labels.
export function ProjectStatusBadge({ status, className = "" }) {
  const theme = resolveProjectStatusTheme(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold leading-tight ${theme.badgeClass} ${className}`}
      data-testid="project-status-badge"
      data-status={theme.key}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${theme.dotClass}`} aria-hidden="true" />
      <span>{theme.label}</span>
    </span>
  );
}

// Render staffing status computed by the server from requirements and assignments.
export function StaffingBadge({ status }) {
  const isFullyStaffed = status === "FULLY_STAFFED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isFullyStaffed
          ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
          : "bg-amber-50 text-amber-800 border-amber-200/80"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isFullyStaffed ? "bg-emerald-500" : "bg-amber-500"
        }`}
        aria-hidden="true"
      />
      <span>{isFullyStaffed ? "Fully Staffed" : "Pending"}</span>
    </span>
  );
}

export function StaffingProgress({ assigned, required }) {
  const isFull = assigned >= required;
  return (
    <span className={`font-medium ${isFull ? "text-success" : "text-text-secondary"}`}>
      {assigned} / {required}
    </span>
  );
}

// Keep hours-based staffing separate from headcount and omit it for legacy projects without targets.
export function HoursStaffingBadge({ status }) {
  if (!status) return null;
  const isFullyStaffed = status === "FULLY_STAFFED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isFullyStaffed
          ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
          : "bg-amber-50 text-amber-800 border-amber-200/80"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isFullyStaffed ? "bg-emerald-500" : "bg-amber-500"
        }`}
        aria-hidden="true"
      />
      <span>{isFullyStaffed ? "Fully Staffed" : "Pending Staffing"}</span>
    </span>
  );
}

// Display server-computed approved-work progress separately from staffing and milestone thresholds.
export function WorkProgress({ approvedHours, expectedHours, progressPercent }) {
  if (expectedHours === null || expectedHours === undefined) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary">
        Work: <span className="font-medium text-text">{formatHours(approvedHours)}</span>/
        {formatHours(expectedHours)}h{" "}
        <span className={progressPercent >= 100 ? "font-medium text-success" : ""}>
          {progressPercent}%
        </span>
      </span>
      <ProgressBar percent={progressPercent} size="sm" />
    </div>
  );
}

// Show allocated-hour capacity independently of headcount staffing.
export function HoursStaffingProgress({ allocatedHours, expectedHours }) {
  if (expectedHours === null || expectedHours === undefined) return null;
  return (
    <span className="text-text-secondary">
      Staffing: <span className="font-medium text-text">{formatHours(allocatedHours)}</span>/
      {formatHours(expectedHours)}h
    </span>
  );
}

export function formatHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return rounded.toString();
}
