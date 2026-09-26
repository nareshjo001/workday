import EmptyState from "./EmptyState";
import { formatDateTime } from "./format";

// Render backend-supplied activity without inventing event types.
const TYPE_META = {
  ASSIGNED: { icon: "👤", label: "Assignment" },
  TIMESHEET_SUBMITTED: { icon: "📝", label: "Timesheet" },
  TIMESHEET_APPROVED: { icon: "✅", label: "Timesheet" },
  TIMESHEET_REJECTED: { icon: "❌", label: "Timesheet" },
  MILESTONE_MET: { icon: "🏁", label: "Milestone" },
  INVOICE_GENERATED: { icon: "🧾", label: "Invoice" },
  INVOICE_APPROVED: { icon: "💰", label: "Invoice" },
  INVOICE_REJECTED: { icon: "🚫", label: "Invoice" },
};

export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) {
    return <EmptyState message="No recent activity yet." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {activity.map((event, idx) => {
        const meta = TYPE_META[event.type] || { icon: "•", label: "Activity" };
        return (
          <li key={idx} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="mt-0.5 text-base leading-none" aria-hidden="true">
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text">{event.message}</p>
              <p className="text-xs text-muted">{formatDateTime(event.occurred_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
