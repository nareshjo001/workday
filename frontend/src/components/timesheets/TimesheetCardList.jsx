import { formatDate, formatDateTime, formatHours, TimesheetStatusBadge } from "./format";

// Allow edits only for draft and rejected logs in the mobile weekly view.
export default function TimesheetCardList({ logs, onEdit }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {logs.map((log) => (
        <div key={log.id} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{formatDate(log.work_date)}</p>
              <p className="text-xs font-medium text-slate-600 tabular-nums">{formatHours(log.hours_logged)} hours</p>
            </div>
            <TimesheetStatusBadge status={log.status} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Submitted {formatDateTime(log.submitted_at)}</p>
          {log.description && <p className="mt-2 text-sm text-slate-700 leading-relaxed">{log.description}</p>}
          {log.reviewed_at && (
            <p className="mt-1 text-xs text-slate-500">
              Reviewed {formatDateTime(log.reviewed_at)}
              {log.reviewer_name && ` by ${log.reviewer_name}`}
            </p>
          )}
          {log.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => onEdit(log)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit draft</span>
            </button>
          )}
          {log.status === "REJECTED" && (
            <>
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900">
                <span className="font-semibold">Reason:</span> {log.rejection_reason || "No reason provided."}
              </div>
              <button
                type="button"
                onClick={() => onEdit(log)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Correct draft</span>
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
