import { formatDate, formatDateTime, formatHours } from "./format";
import { formatSkill } from "../../constants/skills";

export default function PendingTimesheetCardList({
  timesheets,
  reviewingId,
  onApprove,
  onReject,
  selectedIds = [],
  onToggle,
  emptyTitle,
  emptySubtitle,
}) {
  if (timesheets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 md:hidden">
        <p className="text-sm font-medium text-slate-700">{emptyTitle || "No timesheets awaiting review"}</p>
        <p className="text-xs text-slate-400">{emptySubtitle || "Submitted contractor timesheets will appear here when action is required."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {timesheets.map((t) => {
        const isBusy = reviewingId === t.id || reviewingId === "bulk";
        const isApproved = t.status === "APPROVED";
        const isRejected = t.status === "REJECTED";
        const isReviewed = isApproved || isRejected;

        return (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{t.contractor_name}</p>
                <p className="text-xs font-medium text-slate-500">{formatSkill(t.contractor_skill)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {formatHours(t.hours_logged)} hrs
                </span>
                <input
                  aria-label={`Select ${t.contractor_name} timesheet`}
                  type="checkbox"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => onToggle(t.id)}
                  disabled={isReviewed}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 disabled:opacity-40"
                />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-800">{t.project_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>Work date: {formatDate(t.work_date)}</span>
              <span>·</span>
              <span>Submitted: {formatDateTime(t.submitted_at)}</span>
            </div>
            {t.description && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{t.description}</p>}
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              {isApproved ? (
                <span className="w-full text-center rounded-md bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Approved
                </span>
              ) : isRejected ? (
                <span className="w-full text-center rounded-md bg-red-50 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                  Rejected
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onApprove(t.id)}
                    className="flex-1 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onReject(t.id)}
                    className="flex-1 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
