import { formatDate, StatusBadge, StaffingBadge, StaffingProgress } from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Mobile presentation — visible below md, where ProjectTable takes over.
 * Same field-presence detection as ProjectTable (company_name,
 * total_required/assigned/staffing_status, assigned_date/assigned_skill)
 * so the same component serves the PM and Contractor project lists.
 */
export default function ProjectCardList({ projects, showId = true }) {
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
        </div>
      ))}
    </div>
  );
}
