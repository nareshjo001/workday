import { formatDate, formatHours } from "./format";
import { formatSkill } from "../../constants/skills";

function formatSubmittedParts(value) {
  if (!value) return { date: "—", time: "" };
  const [datePart, timePart] = value.split(" ");
  const dateLabel = formatDate(datePart);
  if (!timePart) return { date: dateLabel, time: "" };

  const [hourStr, minuteStr] = timePart.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return { date: `${dateLabel},`, time: "" };
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    date: `${dateLabel},`,
    time: `${hour12}:${minuteStr} ${period}`,
  };
}

export default function PendingTimesheetTable({
  timesheets,
  reviewingId,
  onApprove,
  onReject,
  selectedIds = [],
  onToggle,
  onToggleAll,
  sortField,
  sortOrder,
  onSort,
  emptyTitle,
  emptySubtitle,
  page = 1,
  pageSize = 10,
  totalPages = 1,
  totalItems = 0,
  onPrevious,
  onNext,
  onPageSizeChange,
}) {
  const allSelected = timesheets.length > 0 && timesheets.every((t) => selectedIds.includes(t.id));

  const SortHeader = ({ field, label, align = "left", className = "px-3", style }) => {
    return (
      <th
        style={style}
        className={`py-4 text-[11px] font-semibold tracking-wider text-slate-500 uppercase select-none ${className} ${onSort ? "cursor-pointer hover:text-slate-700" : ""}`}
        onClick={() => onSort && onSort(field)}
      >
        <div className={`flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
          <span>{label}</span>
          {onSort && (
            <span className="inline-flex text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
              </svg>
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="pm-timesheets-table w-full min-w-[928px] table-fixed text-left text-xs">
          <colgroup>
            <col style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "95px" }} />
            <col />
            <col style={{ width: "112px" }} />
            <col style={{ width: "60px" }} />
            <col style={{ width: "125px" }} />
            <col style={{ width: "172px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-[#fafbfc]">
              <th
                className="w-12 py-4 text-left"
                style={{ width: "48px", minWidth: "48px", maxWidth: "48px", paddingLeft: "16px", paddingRight: "8px" }}
              >
                <input
                  aria-label="Select all timesheets"
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
              </th>
              <SortHeader field="contractor_name" label="Contractor" className="pr-3 whitespace-nowrap" style={{ paddingLeft: "8px" }} />
              <SortHeader field="contractor_skill" label="Skill" className="px-3 whitespace-nowrap" />
              <SortHeader field="project_name" label="Project" className="px-3" />
              <SortHeader field="work_date" label="Date" className="px-3 whitespace-nowrap" />
              <SortHeader field="hours_logged" label="Hours" className="px-3 whitespace-nowrap" />
              <SortHeader field="submitted_at" label="Submitted" className="px-3 whitespace-nowrap" />
              <SortHeader field="review" label="Review" align="right" className="pl-3 pr-5 text-right whitespace-nowrap" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {timesheets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-700">{emptyTitle || "No timesheets awaiting review"}</p>
                    <p className="text-xs text-slate-400">{emptySubtitle || "Submitted contractor timesheets will appear here when action is required."}</p>
                  </div>
                </td>
              </tr>
            ) : (
              timesheets.map((t) => {
                const isBusy = reviewingId === t.id || reviewingId === "bulk";
                const isApproved = t.status === "APPROVED";
                const isRejected = t.status === "REJECTED";
                const isReviewed = isApproved || isRejected;
                const submitted = formatSubmittedParts(t.submitted_at);

                return (
                  <tr key={t.id} className="transition-colors hover:bg-slate-50/50">
                    <td
                      className="w-12 py-3.5 text-left"
                      style={{ width: "48px", minWidth: "48px", maxWidth: "48px", paddingLeft: "16px", paddingRight: "8px" }}
                    >
                      <input
                        aria-label={`Select ${t.contractor_name} timesheet`}
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => onToggle(t.id)}
                        disabled={isReviewed}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-40"
                      />
                    </td>
                    <td className="overflow-hidden pr-3 py-3.5 whitespace-nowrap" style={{ paddingLeft: "8px" }}>
                      <span className="block truncate font-semibold text-slate-900" title={t.contractor_name}>{t.contractor_name}</span>
                    </td>
                    <td className="overflow-hidden px-3 py-3.5 whitespace-nowrap text-slate-600">
                      <span className="block truncate" title={formatSkill(t.contractor_skill)}>{formatSkill(t.contractor_skill)}</span>
                    </td>
                    <td className="overflow-hidden px-3 py-3.5 text-slate-700">
                      <div className="truncate font-normal leading-snug" title={t.project_name}>
                        {t.project_name}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-slate-600">
                      {formatDate(t.work_date)}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-slate-700">
                      {formatHours(t.hours_logged)}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600">
                      <div className="leading-tight">
                        <div>{submitted.date}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{submitted.time}</div>
                      </div>
                    </td>
                    <td className="pl-3 pr-4 py-3.5 text-right whitespace-nowrap">
                      {isApproved ? (
                        <span className="inline-flex items-center rounded-lg bg-[#eefbf3] px-3.5 py-1.5 text-xs font-medium text-[#168a4a]">
                          Approved
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center rounded-lg bg-[#fff1f1] px-3.5 py-1.5 text-xs font-medium text-[#dc3545]">
                          Rejected
                        </span>
                      ) : (
                        <div className="timesheet-action-group flex items-center justify-end gap-2 flex-nowrap">
                          <button
                            type="button"
                            title="Approve"
                            aria-label="Approve"
                            disabled={isBusy}
                            onClick={() => onApprove(t.id)}
                            className="timesheet-action-btn timesheet-action-btn--approve cursor-pointer rounded-lg bg-[#eefbf3] text-xs font-medium text-[#168a4a] transition-colors hover:bg-[#e1f7e9] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="timesheet-action-icon-wrap" aria-hidden="true">
                              <svg
                                className="timesheet-action-icon h-4 w-4 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span className="timesheet-action-text">Approve</span>
                          </button>
                          <button
                            type="button"
                            title="Reject"
                            aria-label="Reject"
                            disabled={isBusy}
                            onClick={() => onReject(t.id)}
                            className="timesheet-action-btn timesheet-action-btn--reject cursor-pointer rounded-lg bg-[#fff1f1] text-xs font-medium text-[#dc3545] transition-colors hover:bg-[#ffe5e5] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="timesheet-action-icon-wrap" aria-hidden="true">
                              <svg
                                className="timesheet-action-icon h-4 w-4 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </span>
                            <span className="timesheet-action-text">Reject</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-slate-100">
        {timesheets.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p className="text-sm font-medium text-slate-700">{emptyTitle || "No timesheets awaiting review"}</p>
            <p className="text-xs text-slate-400">{emptySubtitle || "Submitted contractor timesheets will appear here when action is required."}</p>
          </div>
        ) : (
          timesheets.map((t) => {
            const isBusy = reviewingId === t.id || reviewingId === "bulk";
            const isApproved = t.status === "APPROVED";
            const isRejected = t.status === "REJECTED";
            const isReviewed = isApproved || isRejected;
            const submitted = formatSubmittedParts(t.submitted_at);

            return (
              <div key={t.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{t.contractor_name}</p>
                    <p className="text-xs text-slate-500">{formatSkill(t.contractor_skill)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {formatHours(t.hours_logged)} hrs
                    </span>
                    <input
                      aria-label={`Select ${t.contractor_name} timesheet`}
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => onToggle(t.id)}
                      disabled={isReviewed}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-40"
                    />
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-800">{t.project_name}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Work date: {formatDate(t.work_date)}</span>
                  <span>·</span>
                  <span>Submitted: {submitted.date} {submitted.time}</span>
                </div>
                {t.description && (
                  <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{t.description}</p>
                )}
                <div className="flex gap-2 pt-1">
                  {isApproved ? (
                    <span className="w-full text-center rounded-lg bg-[#eefbf3] py-1.5 text-xs font-medium text-[#168a4a]">
                      Approved
                    </span>
                  ) : isRejected ? (
                    <span className="w-full text-center rounded-lg bg-[#fff1f1] py-1.5 text-xs font-medium text-[#dc3545]">
                      Rejected
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onApprove(t.id)}
                        className="flex-1 cursor-pointer rounded-lg bg-[#eefbf3] py-1.5 text-xs font-medium text-[#168a4a] transition hover:bg-[#e1f7e9] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onReject(t.id)}
                        className="flex-1 cursor-pointer rounded-lg bg-[#fff1f1] py-1.5 text-xs font-medium text-[#dc3545] transition hover:bg-[#ffe5e5] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {onPrevious && onNext && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-3.5 text-xs text-slate-500">
          <div>
            <span className="font-normal text-slate-600">
              {timesheets.length === totalItems
                ? `${totalItems} result${totalItems === 1 ? "" : "s"}`
                : `Showing ${timesheets.length} of ${totalItems} results`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={onPrevious}
              className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 font-normal text-slate-600 shadow-none transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            >
              Previous
            </button>
            <span className="text-xs font-normal text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={onNext}
              className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 font-normal text-slate-600 shadow-none transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page</span>
            <select
              id="pm-timesheets-page-size"
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
