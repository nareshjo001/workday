import DataTableScroll from "../DataTableScroll";
import { formatDate, formatDateTimeSplit, formatHours, TimesheetStatusBadge } from "./format";

/**
 * Desktop presentation of ONE WEEK's daily timesheet rows — hidden below
 * md, where TimesheetCardList takes over. Rendered inside WeeklyGroup's
 * expanded section (one instance per project+week).
 *
 * Strict lifecycle enforcement:
 * - ONLY DRAFT and REJECTED rows render the pencil Edit action.
 * - SUBMITTED and APPROVED render an empty cell (no button, no disabled element).
 */
export default function TimesheetTable({ logs, onEdit }) {
  return (
    <DataTableScroll label="Timesheet Table" className="hidden md:block">
      <table className="hidden w-full min-w-[860px] table-fixed text-left text-sm md:table">
        <colgroup>
          <col style={{ width: "120px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ minWidth: "220px" }} />
          <col style={{ width: "115px" }} />
          <col style={{ width: "125px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "64px" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="py-2.5 px-4 font-semibold text-left">Date</th>
            <th className="py-2.5 px-2 font-semibold text-center">Hours</th>
            <th className="py-2.5 px-4 font-semibold text-left">Description</th>
            <th className="py-2.5 px-2 font-semibold text-center">Status</th>
            <th className="py-2.5 px-2 font-semibold text-center">Submitted</th>
            <th className="py-2.5 px-2 font-semibold text-center">Reviewed</th>
            <th className="py-2.5 px-1 font-semibold text-center">Edit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => {
            const submitted = formatDateTimeSplit(log.submitted_at);
            const reviewed = formatDateTimeSplit(log.reviewed_at);

            return (
              <tr
                key={log.id}
                className="transition-colors hover:bg-slate-50/50"
              >
                {/* Date */}
                <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap align-middle text-left">
                  {formatDate(log.work_date)}
                </td>

                {/* Hours */}
                <td className="py-3.5 px-2 font-semibold text-slate-800 tabular-nums align-middle text-center">
                  {formatHours(log.hours_logged)}
                </td>

                {/* Description */}
                <td className="py-3.5 px-4 text-slate-600 text-xs sm:text-sm align-middle text-left">
                  <span className="block leading-relaxed break-words">{log.description || "—"}</span>
                  {log.rejection_reason && (
                    <span className="mt-1 inline-block text-xs font-medium text-rose-600">
                      Reason: {log.rejection_reason}
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="py-3.5 px-2 align-middle whitespace-nowrap text-center">
                  <TimesheetStatusBadge status={log.status} />
                </td>

                {/* Submitted */}
                <td className="py-3.5 px-2 align-middle whitespace-nowrap text-center">
                  {submitted ? (
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium text-slate-800">{submitted.date}</span>
                      <span className="text-[11px] text-slate-500">{submitted.time}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal">—</span>
                  )}
                </td>

                {/* Reviewed */}
                <td className="py-3.5 px-2 align-middle whitespace-nowrap text-center">
                  {reviewed ? (
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium text-slate-800">{reviewed.date}</span>
                      <span className="text-[11px] text-slate-500">{reviewed.time}</span>
                      {log.reviewer_name && (
                        <span className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[130px]" title={`by ${log.reviewer_name}`}>
                          by {log.reviewer_name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal">—</span>
                  )}
                </td>

                {/* Edit Action: ONLY for DRAFT and REJECTED rows */}
                <td className="py-3.5 px-1 align-middle text-center whitespace-nowrap">
                  {log.status === "DRAFT" || log.status === "REJECTED" ? (
                    <button
                      type="button"
                      onClick={() => onEdit(log)}
                      aria-label="Edit"
                      title={log.status === "REJECTED" ? "Edit rejected log" : "Edit draft log"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/60 shadow-2xs transition cursor-pointer"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableScroll>
  );
}

function PencilIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
      />
    </svg>
  );
}
