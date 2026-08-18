import WeeklyGroup from "./WeeklyGroup";

/**
 * One project's section of the contractor's timesheet history — a
 * heading plus every week that has at least one logged day for this
 * project (see weekGrouping.groupTimesheetsByProjectAndWeek), newest
 * week first. Only the most recent week starts expanded; older weeks
 * start collapsed (see WeeklyGroup) so a contractor assigned to a
 * long-running project doesn't land on a page-long wall of daily rows.
 */
export default function ProjectTimesheetGroup({ project, onEdit }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {project.project_name}
      </h2>
      <div className="flex flex-col gap-2">
        {project.weeks.map((week, index) => (
          <WeeklyGroup key={week.weekStart} week={week} onEdit={onEdit} defaultOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}
