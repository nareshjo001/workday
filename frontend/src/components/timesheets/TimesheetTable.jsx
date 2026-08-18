import { formatDate, formatDateTime, formatHours, TimesheetStatusBadge } from "./format";

/**
 * Desktop presentation of ONE WEEK's daily timesheet rows — hidden below
 * md, where TimesheetCardList takes over. Rendered inside WeeklyGroup's
 * expanded section (one instance per project+week), not once for the
 * whole page — the daily-logging revision replaced the old "one big flat
 * table of every timesheet" layout with this per-week breakdown grouped
 * by weekGrouping.js. Same desktop/mobile split pattern as
 * components/projects/ProjectTable + ProjectCardList.
 *
 * `onEdit` is only ever invoked for a REJECTED row (the Edit button is
 * only rendered for that status — see the inline check below) — PENDING
 * and APPROVED rows are immutable, enforced again server-side by
 * contractorTimesheetService.updateTimesheet regardless of what this UI
 * shows.
 */
export default function TimesheetTable({ logs, onEdit }) {
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <th className="py-2 pr-4 font-medium">Date</th>
          <th className="py-2 pr-4 font-medium">Hours</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Submitted</th>
          <th className="py-2 pr-4 font-medium">Reviewed</th>
          <th className="py-2 pr-0 font-medium">Edit</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} className="border-b border-border last:border-0">
            <td className="py-2.5 pr-4 font-medium text-text">{formatDate(log.work_date)}</td>
            <td className="py-2.5 pr-4 text-text-secondary">{formatHours(log.hours_logged)}</td>
            <td className="py-2.5 pr-4">
              <TimesheetStatusBadge status={log.status} />
            </td>
            <td className="py-2.5 pr-4 text-text-secondary">{formatDateTime(log.submitted_at)}</td>
            <td className="py-2.5 pr-4 text-text-secondary">
              {log.reviewed_at ? (
                <>
                  {formatDateTime(log.reviewed_at)}
                  {log.reviewer_name && (
                    <span className="block text-xs text-muted">by {log.reviewer_name}</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </td>
            <td className="py-2.5 pr-0">
              {log.status === "REJECTED" && (
                <button
                  type="button"
                  onClick={() => onEdit(log)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface-muted"
                >
                  Edit
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
