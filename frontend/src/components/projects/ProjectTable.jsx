import { formatDate, StatusBadge, StaffingBadge, StaffingProgress } from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Desktop presentation — hidden below md, where ProjectCardList takes
 * over. Shared between PMProjectsPage (showId=true, rows carry
 * total_required/total_assigned/staffing_status — Module 3 revision) and
 * ContractorProjectsPage (showId=false, rows carry assigned_date +
 * assigned_skill instead). Extra columns render automatically based on
 * which fields are actually present on the rows, so this one component
 * serves both shapes without a prop for every variant.
 */
export default function ProjectTable({ projects, showId = true }) {
  const showAssignedDate = projects.some((p) => p.assigned_date !== undefined);
  const showAssignedSkill = projects.some((p) => p.assigned_skill !== undefined);
  const showCompany = projects.some((p) => p.company_name);
  const showStaffing = projects.some((p) => p.total_required !== undefined);

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
          <th className="py-3 pr-0 font-medium">Status</th>
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
            <td className="py-3 pr-0">
              <StatusBadge status={project.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
