import { formatDate, formatDateTime, formatHours } from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Mobile presentation of a PM's pending timesheet review queue — visible
 * below md, where PendingTimesheetTable takes over. Same split pattern
 * as components/projects/ProjectCardList. Each card is one contractor's
 * one day (daily-logging revision) — see PendingTimesheetTable's comment.
 */
export default function PendingTimesheetCardList({ timesheets, reviewingId, onApprove, onReject }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {timesheets.map((t) => {
        const isBusy = reviewingId === t.id;
        return (
          <div key={t.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-text">{t.contractor_name}</p>
                <p className="text-xs text-muted">{formatSkill(t.contractor_skill)}</p>
              </div>
              <span className="text-xs text-muted">{formatHours(t.hours_logged)} hrs</span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">{t.project_name}</p>
            <p className="mt-1 text-xs text-muted">{formatDate(t.work_date)}</p>
            <p className="mt-1 text-xs text-muted">Submitted {formatDateTime(t.submitted_at)}</p>
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onApprove(t.id)}
                className="flex-1 rounded-md bg-success-bg px-3 py-2 text-sm font-medium text-success transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onReject(t.id)}
                className="flex-1 rounded-md bg-error-bg px-3 py-2 text-sm font-medium text-error transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
