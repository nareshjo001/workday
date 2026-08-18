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
 * Mobile presentation — visible below md, where ProjectTable takes over.
 * Same field-presence detection as ProjectTable (company_name,
 * total_required/assigned/staffing_status, assigned_date/assigned_skill)
 * so the same component serves the PM and Contractor project lists.
 *
 * `onComplete`/`completingId` mirror ProjectTable's — see its comment.
 */
export default function ProjectCardList({ projects, showId = true, onComplete, completingId }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {projects.map((project) => (
        <div key={project.id} className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-text">{project.name}</p>
              {project.company_name && (
                <p className="text-xs text-muted">
                  {project.company_name}
                  {project.pm_name && ` · PM: ${project.pm_name}`}
                </p>
              )}
              {showId && <p className="text-xs text-muted">ID #{project.id}</p>}
            </div>
            <StatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-text-secondary">{project.description}</p>
          )}
          <p className="mt-3 text-sm text-text-secondary">
            {formatDate(project.start_date)} – {formatDate(project.end_date)}
          </p>
          {project.assigned_skill !== undefined && (
            <p className="mt-1 text-xs text-muted">Skill: {formatSkill(project.assigned_skill)}</p>
          )}
          {project.assigned_date !== undefined && (
            <p className="mt-1 text-xs text-muted">Assigned {formatDate(project.assigned_date)}</p>
          )}
          {project.total_required !== undefined && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted">
                Team: <StaffingProgress assigned={project.total_assigned} required={project.total_required} />
              </span>
              <StaffingBadge status={project.staffing_status} />
            </div>
          )}
          {project.expected_hours !== undefined && project.expected_hours !== null && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-xs">
              <WorkProgress
                approvedHours={project.approved_hours}
                expectedHours={project.expected_hours}
                progressPercent={project.work_progress_percent}
              />
              <div className="flex items-center justify-between gap-2">
                <HoursStaffingProgress
                  allocatedHours={project.allocated_hours}
                  expectedHours={project.expected_hours}
                />
                <HoursStaffingBadge status={project.hours_staffing_status} />
              </div>
            </div>
          )}
          {onComplete && project.status === "ACTIVE" && (
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => onComplete(project)}
                disabled={completingId === project.id}
                className="w-full rounded-md border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {completingId === project.id ? "Completing…" : "Complete Project"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
