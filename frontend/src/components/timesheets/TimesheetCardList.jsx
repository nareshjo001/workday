import { formatDate, formatDateTime, formatHours, TimesheetStatusBadge } from "./format";

/**
 * Mobile presentation of ONE WEEK's daily timesheet rows — visible below
 * md, where TimesheetTable takes over. Same per-week rendering context
 * and same "Edit only appears on REJECTED rows" rule as TimesheetTable —
 * see that file's comment.
 */
export default function TimesheetCardList({ logs, onEdit }) {
  return (
    <div className="flex flex-col gap-2.5 md:hidden">
      {logs.map((log) => (
        <div key={log.id} className="rounded-md border border-border bg-surface p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-text">{formatDate(log.work_date)}</p>
              <p className="text-xs text-muted">{formatHours(log.hours_logged)} hours</p>
            </div>
            <TimesheetStatusBadge status={log.status} />
          </div>
          <p className="mt-2 text-xs text-muted">Submitted {formatDateTime(log.submitted_at)}</p>
          {log.reviewed_at && (
            <p className="mt-1 text-xs text-muted">
              Reviewed {formatDateTime(log.reviewed_at)}
              {log.reviewer_name && ` by ${log.reviewer_name}`}
            </p>
          )}
          {log.status === "REJECTED" && (
            <button
              type="button"
              onClick={() => onEdit(log)}
              className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Edit &amp; Resubmit
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
