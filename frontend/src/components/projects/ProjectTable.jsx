import {
  formatDate,
  StatusBadge,
  StaffingBadge,
  StaffingProgress,
  HoursStaffingBadge,
  WorkProgress,
  HoursStaffingProgress,
} from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Desktop presentation — hidden below md, where ProjectCardList takes
 * over. Shared between PMProjectsPage (showId=true, rows carry
 * total_required/total_assigned/staffing_status — Module 3 revision) and
 * ContractorProjectsPage (showId=false, rows carry assigned_date +
 * assigned_skill instead). Extra columns render automatically based on
 * which fields are actually present on the rows, so this one component
 * serves both shapes without a prop for every variant.
 *
 * Project hours/allocation redesign: an "Hours" column renders whenever a
 * row carries expected_hours (non-null) — separate from the existing
 * headcount "Team" column, since a project tracks staffing-by-headcount
 * and staffing-by-hours as two independent concepts (see format.jsx).
 * Legacy rows with expected_hours null simply don't get the column
 * populated for that row (the whole column is still shown if ANY row has
 * it, matching the showStaffing pattern already used here).
 *
 * `onComplete` (project hours/allocation redesign) is optional and, per
 * this codebase's "derive UI mode from callback presence" convention,
 * only PMProjectsPage passes it — a "Complete Project" button then
 * renders for that PM's own ACTIVE rows only. ContractorProjectsPage
 * never passes it, so a contractor never sees this control.
 */
export default function ProjectTable({ projects, showId = true, onComplete, completingId }) {
  const showAssignedDate = projects.some((p) => p.assigned_date !== undefined);
  const showAssignedSkill = projects.some((p) => p.assigned_skill !== undefined);
  const showCompany = projects.some((p) => p.company_name);
  const showStaffing = projects.some((p) => p.total_required !== undefined);
  const showHours = projects.some((p) => p.expected_hours !== undefined && p.expected_hours !== null);

  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          {showId && <th className="py-3 pr-4 font-medium">ID</th>}
          <th className="py-3 pr-4 font-medium">Name</th>
          {showCompany && <th className="py-3 pr-4 font-medium">Company</th>}
          <th className="py-3 pr-4 font-medium">Start</th>
          <th className="py-3 pr-4 font-medium">End</th>
          {showAssignedSkill && <th className="py-3 pr-4 font-medium">Skill</th>}
          {showAssignedDate && <th className="py-3 pr-4 font-medium">Assigned</th>}
          {showStaffing && <th className="py-3 pr-4 font-medium">Team</th>}
          {showHours && <th className="py-3 pr-4 font-medium">Hours</th>}
          <th className="py-3 pr-4 font-medium">Status</th>
          {onComplete && <th className="py-3 pr-0 font-medium" />}
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} className="border-b border-border last:border-0">
            {showId && (
              <td className="py-3 pr-4 font-mono text-text-secondary">#{project.id}</td>
            )}
            <td className="py-3 pr-4">
              <p className="font-medium text-text">{project.name}</p>
              {project.description && (
                <p className="max-w-xs truncate text-xs text-muted">{project.description}</p>
              )}
            </td>
            {showCompany && (
              <td className="py-3 pr-4 text-text-secondary">
                {project.company_name || "—"}
                {project.pm_name && <span className="block text-xs text-muted">PM: {project.pm_name}</span>}
              </td>
            )}
            <td className="py-3 pr-4 text-text-secondary">{formatDate(project.start_date)}</td>
            <td className="py-3 pr-4 text-text-secondary">{formatDate(project.end_date)}</td>
            {showAssignedSkill && (
              <td className="py-3 pr-4 text-text-secondary">{formatSkill(project.assigned_skill)}</td>
            )}
            {showAssignedDate && (
              <td className="py-3 pr-4 text-text-secondary">
                {formatDate(project.assigned_date)}
              </td>
            )}
            {showStaffing && (
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <StaffingProgress assigned={project.total_assigned} required={project.total_required} />
                  <StaffingBadge status={project.staffing_status} />
                </div>
              </td>
            )}
            {showHours && (
              <td className="py-3 pr-4">
                <div className="flex flex-col gap-1 text-xs">
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
              </td>
            )}
            <td className={onComplete ? "py-3 pr-4" : "py-3 pr-0"}>
              <StatusBadge status={project.status} />
            </td>
            {onComplete && (
              <td className="py-3 pr-0 text-right">
                {project.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => onComplete(project)}
                    disabled={completingId === project.id}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {completingId === project.id ? "Completing…" : "Complete Project"}
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
