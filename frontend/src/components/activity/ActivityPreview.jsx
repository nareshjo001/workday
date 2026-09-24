import { Link } from "react-router-dom";
import EmptyState from "../dashboard/EmptyState";
import { formatDateTime } from "../dashboard/format";
import { getActivityTheme } from "../../utils/activityTheme";

const PREVIEW_LIMIT = 5;

export default function ActivityPreview({ activity = [], to, testId = "activity-preview" }) {
  const visibleActivity = activity.slice(0, PREVIEW_LIMIT);

  return (
    <>
      {visibleActivity.length === 0 ? (
        <EmptyState message="No recent activity yet." />
      ) : (
        <ul className="vendor-activity-list" data-testid={testId}>
          {visibleActivity.map((event, index) => {
            const theme = getActivityTheme(event);
            const Icon = theme.Icon;
            const title = event.title || event.message || "Activity recorded";
            const summary = event.summary || (event.title && event.message !== event.title ? event.message : null);

            return (
              <li key={`${event.id || event.event || event.type}-${event.occurred_at}-${index}`}>
                <span
                  className="vendor-activity-icon"
                  style={{ backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 text-sm leading-snug">{title}</p>
                  {summary && <p className="text-xs text-slate-600 mt-0.5 leading-normal">{summary}</p>}
                  <time dateTime={event.occurred_at} className="text-[11px] text-slate-400 block mt-1">{formatDateTime(event.occurred_at)}</time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Link to={to} className="vendor-section-footer-control vendor-activity-link">
        View all activity
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>
      </Link>
    </>
  );
}
