import { useState } from "react";
import { formatDate, formatHours } from "./format";
import TimesheetTable from "./TimesheetTable";
import TimesheetCardList from "./TimesheetCardList";

/**
 * One collapsible week within a project's timesheet history — the
 * accordion node the daily-logging revision introduced so a contractor
 * still sees a familiar weekly summary even though every row underneath
 * is now an individually-submitted, individually-reviewed day (see
 * weekGrouping.js for how `week` is computed, and backend migration 013
 * for why there is no stored weekly row anymore).
 *
 * Collapsed by default (`defaultOpen` lets the parent open the most
 * recent week per project automatically) to keep a contractor with a
 * long history from facing a wall of daily rows on load — the week
 * header alone already answers "how many hours, and how much of that is
 * approved" without expanding anything.
 */
export default function WeeklyGroup({ week, onEdit, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { totals } = week;

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-muted"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <ChevronIcon isOpen={isOpen} />
          <span className="font-medium text-text">
            Week of {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <span>
            Total: <span className="font-medium text-text">{formatHours(totals.total)}h</span>
          </span>
          <span className="text-success">Approved: {formatHours(totals.approved)}h</span>
          <span className="text-warning">Pending: {formatHours(totals.pending)}h</span>
          <span className="text-error">Rejected: {formatHours(totals.rejected)}h</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3">
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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
