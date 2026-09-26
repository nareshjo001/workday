import WeeklyGroup from "./WeeklyGroup";
import { formatHours } from "../projects/format";

// Group daily logs by week and use assignment data for allocation totals even when logs are absent.
export default function ProjectTimesheetGroup({ project, allocation, onEdit, onSubmitWeek }) {
  const hasAllocation =
    allocation && allocation.allocated_hours !== null && allocation.allocated_hours !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            {project.project_name}
          </h2>
          {allocation?.assignment_status === "RELEASED" && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              (released)
            </span>
          )}
        </div>
        {hasAllocation && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>Allocated: <strong className="font-semibold text-slate-700">{formatHours(allocation.allocated_hours)}h</strong></span>
            <span className="text-slate-300">·</span>
            <span>Approved: <strong className="font-semibold text-emerald-700">{formatHours(allocation.approved_hours)}h</strong></span>
            <span className="text-slate-300">·</span>
            <span>Pending: <strong className="font-semibold text-amber-700">{formatHours(allocation.pending_hours)}h</strong></span>
            <span className="text-slate-300">·</span>
            <span>Remaining: <strong className="font-semibold text-slate-700">{formatHours(allocation.remaining_hours)}h</strong></span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {project.weeks.map((week, index) => (
          <WeeklyGroup key={week.weekStart} week={week} onEdit={onEdit} onSubmitWeek={onSubmitWeek} defaultOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}
