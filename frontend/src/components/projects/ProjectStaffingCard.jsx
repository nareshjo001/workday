import {
  formatDate,
  StaffingBadge,
  StaffingProgress,
  HoursStaffingBadge,
  WorkProgress,
  HoursStaffingProgress,
} from "./format";

/**
 * One project card in the Vendor's staffing-available browse list
 * (Module 3 revision spec section 9). Presentational only — all data and
 * the "view team" click handler come from VendorAssignmentsPage, which
 * owns the page-level state.
 *
 * Project hours/allocation redesign: also shows the hours-based staffing
 * (allocated/expected) and work-progress (approved/expected) readouts
 * alongside the existing headcount Team readout, when the project has
 * expected_hours set (see vendorProjectService.toProjectView).
 */
export default function ProjectStaffingCard({ project, onViewTeam }) {
  const isFullyStaffed = project.staffing_status === "FULLY_STAFFED";
  const hasHours = project.expected_hours !== undefined && project.expected_hours !== null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text">{project.name}</p>
          <p className="text-sm text-muted">
            {project.company_name}
            {project.pm_name && <span className="text-muted"> · PM: {project.pm_name}</span>}
          </p>
        </div>
        <StaffingBadge status={project.staffing_status} />
      </div>

      <p className="mt-2 text-sm text-text-secondary">
        {formatDate(project.start_date)} – {formatDate(project.end_date)}
      </p>

      <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <span>Team:</span>
        <StaffingProgress assigned={project.total_assigned} required={project.total_required} />
      </div>

      {hasHours && (
        <div className="mt-2 flex flex-col gap-1 text-sm text-text-secondary">
          <WorkProgress
            approvedHours={project.approved_hours}
            expectedHours={project.expected_hours}
            progressPercent={project.work_progress_percent}
          />
          <div className="flex items-center gap-2">
            <HoursStaffingProgress
              allocatedHours={project.allocated_hours}
              expectedHours={project.expected_hours}
            />
            <HoursStaffingBadge status={project.hours_staffing_status} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onViewTeam(project)}
        className="mt-4 w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted sm:w-auto"
      >
        {isFullyStaffed ? "View Team" : "View & Assign Team"}
      </button>
    </div>
  );
}
