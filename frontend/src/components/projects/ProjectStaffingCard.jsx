import {
  formatDate,
  formatHours,
  ProjectStatusBadge,
} from "./format";

/**
 * Modern contractor project card for Vendor "Projects Open for Staffing" list.
 * Refined compact enterprise density:
 * - Title (~16-17px, bold navy) + compact Semantic Status Pill
 * - PM line (~12-13px muted slate)
 * - Compact Client Chip + Neutral Date Range Chip
 * - 3 Compact Metric Tiles: Team, Work done, Staffing (~54-56px height, ~15px values, NO progress bar)
 * - Work Progress Section: Single-line capsule (clock icon, "32h / 160h", "20%") on header row
 * - Refined 6px progress bar directly below capsule
 * - Full-width Outlined Primary Button (~40-42px height)
 */
export default function ProjectStaffingCard({ project, onViewTeam }) {
  const isFullyStaffed = project.staffing_status === "FULLY_STAFFED";
  const hasExpectedHours =
    project.expected_hours !== undefined && project.expected_hours !== null;

  const totalAssigned = project.total_assigned ?? 0;
  const totalRequired = project.total_required ?? 0;
  const approvedHours = Number(project.approved_hours ?? 0);
  const allocatedHours = Number(project.allocated_hours ?? 0);
  const expectedHours = hasExpectedHours ? Number(project.expected_hours) : null;

  // Compute work progress percentage (clamped 0-100)
  let workPercent = 0;
  if (project.work_progress_percent !== undefined && project.work_progress_percent !== null) {
    workPercent = Math.min(100, Math.max(0, Math.round(Number(project.work_progress_percent))));
  } else if (expectedHours && expectedHours > 0) {
    workPercent = Math.min(100, Math.max(0, Math.round((approvedHours / expectedHours) * 100)));
  }

  // Active or derived status for badge lookup
  const statusValue = project.staffing_status || project.status || "PENDING";

  return (
    <div
      className="vendor-project-card flex flex-col justify-between h-full rounded-2xl border border-border/80 bg-surface p-4 sm:p-4.5 shadow-xs transition hover:shadow-md hover:border-slate-300"
      data-testid="project-staffing-card"
      data-project-id={project.id}
    >
      <div className="flex flex-col">
        {/* Top Header: Title + Semantic Status Pill */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] sm:text-[17px] font-semibold text-slate-900 tracking-tight leading-snug break-words">
              {project.name}
            </h2>
            {project.pm_name && (
              <p className="mt-0.5 text-[11.5px] sm:text-[12.5px] text-slate-500 leading-normal">
                PM: {project.pm_name}
              </p>
            )}
          </div>
          <div className="shrink-0 pt-0.5">
            <ProjectStatusBadge status={statusValue} />
          </div>
        </div>

        {/* Chips Row: Client Chip + Date Range Chip */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {project.company_name && (
            <span
              className="inline-flex items-center rounded-full bg-indigo-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200/70"
              data-testid="company-chip"
            >
              {project.company_name}
            </span>
          )}
          {(project.start_date || project.end_date) && (
            <span
              className="inline-flex items-center rounded-full bg-slate-100/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200/70"
              data-testid="date-range-chip"
            >
              {formatDate(project.start_date)} – {formatDate(project.end_date)}
            </span>
          )}
        </div>

        {/* 3 Compact Metric Tiles (Team, Work done, Staffing) */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 sm:gap-2.5">
          {/* Tile 1: Team */}
          <div
            className="flex flex-col items-center justify-center rounded-xl bg-slate-50/90 border border-slate-100/90 h-[54px] sm:h-[56px] py-1 px-1.5 text-center"
            data-testid="metric-tile-team"
          >
            <span className="text-[14.5px] sm:text-[15.5px] font-bold text-slate-800 tracking-tight leading-none">
              {totalAssigned} / {totalRequired}
            </span>
            <span className="mt-0.5 text-[10.5px] sm:text-[11px] font-medium text-slate-500">
              Team
            </span>
          </div>

          {/* Tile 2: Work done */}
          <div
            className="flex flex-col items-center justify-center rounded-xl bg-slate-50/90 border border-slate-100/90 h-[54px] sm:h-[56px] py-1 px-1.5 text-center"
            data-testid="metric-tile-work-done"
          >
            <span className="text-[14.5px] sm:text-[15.5px] font-bold text-slate-800 tracking-tight leading-none">
              {formatHours(approvedHours)}h
            </span>
            <span className="mt-0.5 text-[10.5px] sm:text-[11px] font-medium text-slate-500">
              Work done
            </span>
          </div>

          {/* Tile 3: Staffing */}
          <div
            className="flex flex-col items-center justify-center rounded-xl bg-slate-50/90 border border-slate-100/90 h-[54px] sm:h-[56px] py-1 px-1.5 text-center"
            data-testid="metric-tile-staffing"
          >
            <span className="text-[14.5px] sm:text-[15.5px] font-bold text-slate-800 tracking-tight leading-none">
              {formatHours(allocatedHours)}h
            </span>
            <span className="mt-0.5 text-[10.5px] sm:text-[11px] font-medium text-slate-500">
              Staffing
            </span>
          </div>
        </div>

        {/* Work Progress Section (ONLY Work has a progress bar) */}
        {hasExpectedHours && (
          <div className="mt-3.5 flex flex-col" data-testid="work-progress-section">
            {/* Header row: "Work" label + Single-line Capsule */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-slate-800">
                Work
              </span>
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 border border-slate-200/70 px-2.5 py-0.5 text-[11px] sm:text-[11.5px] leading-tight text-slate-600 whitespace-nowrap"
                data-testid="work-capsule"
              >
                <svg
                  className="w-3 h-3 text-slate-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>
                  <span className="font-medium text-slate-800">{formatHours(approvedHours)}</span>h / {formatHours(expectedHours)}h
                </span>
                <span className="text-slate-300 select-none" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`font-semibold ${
                    workPercent >= 100 ? "text-emerald-600" : "text-slate-900"
                  }`}
                >
                  {workPercent}%
                </span>
              </div>
            </div>

            {/* Slim 6px progress bar track */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#1c4375] transition-all duration-300"
                style={{ width: `${workPercent}%` }}
                role="progressbar"
                aria-valuenow={workPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Work completion progress"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action: Full-width Outlined Primary Button */}
      <button
        type="button"
        onClick={() => onViewTeam(project)}
        className="mt-3.5 sm:mt-4 inline-flex w-full h-[40px] sm:h-[42px] items-center justify-center gap-2 rounded-xl border border-primary/40 bg-white py-2 px-4 text-[13.5px] sm:text-sm font-semibold text-primary shadow-xs transition hover:bg-primary/5 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        data-testid="view-team-button"
      >
        <UsersIcon className="w-[18px] h-[18px] shrink-0 text-current" />
        <span>{isFullyStaffed ? "View Team" : "View & Assign Team"}</span>
      </button>
    </div>
  );
}

function UsersIcon({ className = "w-[18px] h-[18px] shrink-0" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-testid="view-team-icon"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
