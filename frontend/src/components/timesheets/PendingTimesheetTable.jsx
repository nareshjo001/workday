import { formatDate, formatDateTime, formatHours } from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Desktop presentation of a PM's pending timesheet review queue — hidden
 * below md, where PendingTimesheetCardList takes over. Same split
 * pattern as components/projects/ProjectTable + ProjectCardList.
 *
 * Each row is one contractor's ONE DAY (daily-logging revision — see
 * backend migration 013); a PM approves/rejects individual days here,
 * never a whole week at once.
 *
 * `reviewingId` disables both actions on the row currently being
 * submitted (prevents a double Approve/Reject click from firing two
 * requests for the same row while the first is still in flight).
 */
export default function PendingTimesheetTable({ timesheets, reviewingId, onApprove, onReject }) {
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <th className="py-3 pr-4 font-medium">Contractor</th>
          <th className="py-3 pr-4 font-medium">Skill</th>
          <th className="py-3 pr-4 font-medium">Project</th>
          <th className="py-3 pr-4 font-medium">Date</th>
          <th className="py-3 pr-4 font-medium">Hours</th>
          <th className="py-3 pr-4 font-medium">Submitted</th>
          <th className="py-3 pr-0 font-medium">Review</th>
        </tr>
      </thead>
      <tbody>
        {timesheets.map((t) => {
          const isBusy = reviewingId === t.id;
          return (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="py-3 pr-4 font-medium text-text">{t.contractor_name}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatSkill(t.contractor_skill)}</td>
              <td className="py-3 pr-4 text-text-secondary">{t.project_name}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatDate(t.work_date)}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatHours(t.hours_logged)}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatDateTime(t.submitted_at)}</td>
              <td className="py-3 pr-0">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onApprove(t.id)}
                    className="rounded-md bg-success-bg px-3 py-1.5 text-xs font-medium text-success transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onReject(t.id)}
                    className="rounded-md bg-error-bg px-3 py-1.5 text-xs font-medium text-error transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
