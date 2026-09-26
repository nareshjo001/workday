import { useState } from "react";
import { formatDate, formatHours } from "./format";
import TimesheetTable from "./TimesheetTable";
import TimesheetCardList from "./TimesheetCardList";

// Collapse historical weeks by default; the parent may expand the most recent week.
export default function WeeklyGroup({ week, onEdit, onSubmitWeek, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { totals } = week;
  const submittable = week.logs.filter((log) => log.status === "DRAFT" || log.status === "REJECTED");

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4 sm:px-5 text-left transition hover:bg-slate-50/70"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronIcon isOpen={isOpen} />
          <span className="text-sm sm:text-[15px] font-semibold text-slate-900 truncate">
            Week of {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium bg-slate-100/90 text-slate-700 border border-slate-200/80">
            Total: <strong className="font-semibold text-slate-900">{formatHours(totals.total)}h</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            Approved: <strong className="font-semibold text-emerald-900">{formatHours(totals.approved)}h</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
            Pending: <strong className="font-semibold text-amber-900">{formatHours(totals.pending)}h</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium bg-rose-50 text-rose-800 border border-rose-200/80">
            Rejected: <strong className="font-semibold text-rose-900">{formatHours(totals.rejected)}h</strong>
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
          {submittable.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
              <span className="font-medium">{submittable.length} draft{submittable.length === 1 ? "" : "s"} ready for review.</span>
              <button
                type="button"
                onClick={() => onSubmitWeek(submittable.map((log) => log.id))}
                className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-50 hover:border-amber-400 transition cursor-pointer"
              >
                Submit week
              </button>
            </div>
          )}
          <TimesheetTable logs={week.logs} onEdit={onEdit} />
          <TimesheetCardList logs={week.logs} onEdit={onEdit} />
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ isOpen }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90 text-slate-700" : "text-slate-400"}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
