import WeeklyGroup from "./WeeklyGroup";
import { formatHours } from "../projects/format";

/**
 * One project's section of the contractor's timesheet history — a
 * heading plus every week that has at least one logged day for this
 * project (see weekGrouping.groupTimesheetsByProjectAndWeek), newest
 * week first. Only the most recent week starts expanded; older weeks
 * start collapsed (see WeeklyGroup) so a contractor assigned to a
 * long-running project doesn't land on a page-long wall of daily rows.
 *
 * PROJECT HOURS/ALLOCATION REDESIGN: `allocation` (looked up by
 * ContractorTimesheetsPage from the contractor's own assigned-projects
 * list, see assignmentRepository.listProjectsForContractor) carries this
 * contractor's own allocated/approved/pending/remaining hours on THIS
 * project — rendered as a small banner under the heading. Optional/null
 * for legacy assignments with no allocated_hours set, or if the lookup
 * ever misses (e.g. a stale group with no matching assignment row).
 */
export default function ProjectTimesheetGroup({ project, allocation, onEdit }) {
  const hasAllocation =
    allocation && allocation.allocated_hours !== null && allocation.allocated_hours !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {project.project_name}
        </h2>
        {hasAllocation && (
          <p className="text-xs text-text-secondary">
            Allocated: {formatHours(allocation.allocated_hours)}h · Approved:{" "}
            {formatHours(allocation.approved_hours)}h · Pending: {formatHours(allocation.pending_hours)}h ·
            Remaining: {formatHours(allocation.remaining_hours)}h
            {allocation.assignment_status === "RELEASED" && (
              <span className="ml-2 font-medium text-muted">(released)</span>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {project.weeks.map((week, index) => (
          <WeeklyGroup key={week.weekStart} week={week} onEdit={onEdit} defaultOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}
