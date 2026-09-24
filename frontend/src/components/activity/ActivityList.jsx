import React from "react";
import {
  filterMeaningfulDetails,
  formatActivityTimestamp,
  getActivityTheme,
  getStatusSemanticClass,
} from "../../utils/activityTheme";

function formatEntityType(type) {
  if (!type) return "Item";
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderDetailValue(value) {
  const str = String(value ?? "");
  if (str.includes(" → ")) {
    const [from, to] = str.split(" → ");
    return (
      <span className="inline-flex items-center gap-1 font-medium">
        <span className="text-slate-600">{from}</span>
        <span className="text-slate-600" aria-hidden="true">→</span>
        <span className={getStatusSemanticClass(to)}>{to}</span>
      </span>
    );
  }
  return <span className={getStatusSemanticClass(str)}>{str}</span>;
}

export default function ActivityList({
  activity,
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRetry,
  onPrevious,
  onNext,
  description = "Track all important events across your projects, assignments, invoices and payments.",
  hideHeader = false,
}) {
  if (isLoading) {
    return (
      <section
        aria-label={hideHeader ? "Activity loading" : undefined}
        aria-labelledby={hideHeader ? undefined : "activity-title"}
        className="flex flex-col gap-5"
      >
        {!hideHeader && (
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 id="activity-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Activity
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                {description}
              </p>
            </div>
          </header>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-2xs">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary animate-pulse mb-3" aria-hidden="true">
            <svg className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p role="status" className="text-sm font-semibold text-slate-700">Loading activity…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label={hideHeader ? "Activity error" : undefined}
        aria-labelledby={hideHeader ? undefined : "activity-title"}
        className="flex flex-col gap-5"
      >
        {!hideHeader && (
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 id="activity-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Activity
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                {description}
              </p>
            </div>
          </header>
        )}
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center shadow-2xs">
          <p role="alert" className="text-sm font-semibold text-red-700">
            Activity could not be loaded. Try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3.5 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-red-700 shadow-2xs hover:bg-red-50 transition"
          >
            Retry activity
          </button>
        </div>
      </section>
    );
  }

  if (!activity) return null;

  return (
    <section
      aria-label={hideHeader ? "Activity feed" : undefined}
      aria-labelledby={hideHeader ? undefined : "activity-title"}
      className="flex flex-col gap-5"
    >
      {/* Header */}
      {!hideHeader && (
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 id="activity-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Activity
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {description}
            </p>
            {activity.project && (
              <p className="mt-1.5 text-xs font-semibold text-slate-900">
                {activity.project.name} · {activity.project.status}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Refreshing activity" : "Refresh activity"}
            className="inline-flex h-10 items-center gap-2 self-start sm:self-center rounded-lg border border-blue-200 bg-white px-3.5 text-xs sm:text-sm font-medium text-blue-600 shadow-2xs hover:bg-blue-50/50 hover:border-blue-300 active:bg-blue-100/50 disabled:opacity-60 transition cursor-pointer whitespace-nowrap shrink-0 min-w-max"
          >
            <svg
              className={`h-4 w-4 text-blue-600 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? "Refreshing…" : "Refresh activity"}</span>
          </button>
        </header>
      )}

      {/* Feed list or empty state */}
      {activity.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900">No activity recorded for this scope yet.</p>
          <p className="mt-1 text-xs text-slate-500">New events will appear here as work progresses.</p>
        </div>
      ) : (
        <ol className="space-y-3" data-testid="activity-feed">
          {activity.items.map((item) => {
            const theme = getActivityTheme(item);
            const ts = formatActivityTimestamp(item.occurred_at);
            const meaningfulDetails = filterMeaningfulDetails(item.details);
            const { Icon } = theme;

            return (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 sm:gap-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                  {/* Category Icon Badge */}
                  <div
                    className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border shadow-2xs"
                    style={{
                      backgroundColor: theme.bg,
                      color: theme.text,
                      borderColor: theme.border,
                    }}
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content Block */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Title */}
                    <h2 className="text-sm sm:text-[14.5px] font-bold text-slate-900 tracking-tight truncate">
                      {item.title}
                    </h2>

                    {/* Line 2: Actor / Action Description */}
                    <p className="mt-0.5 text-xs sm:text-[13px] text-slate-600">
                      {item.summary || `${item.actor?.display_name || "System"} recorded activity.`}
                    </p>

                    {/* Line 3: Related Entity Line */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
                      {item.entity?.type && (
                        <span className="inline-flex items-center font-medium text-slate-700">
                          {formatEntityType(item.entity.type)} #{item.entity.id}
                        </span>
                      )}
                      {activity.project?.name && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="truncate">{activity.project.name}</span>
                        </>
                      )}
                    </div>

                    {/* Line 4: Meaningful Change Metadata Details */}
                    {meaningfulDetails.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        {meaningfulDetails.map((detail) => (
                          <span key={detail.label} className="inline-flex items-center gap-1.5 text-slate-600">
                            <span className="text-slate-600 font-medium">{detail.label}:</span>
                            {renderDetailValue(detail.value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right / Timestamp section (2-line on desktop) */}
                <div className="shrink-0 text-left sm:text-right pl-13 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100/80">
                  <time dateTime={item.occurred_at} className="block text-xs font-bold text-slate-900 whitespace-nowrap">
                    {ts.date}
                  </time>
                  <span className="block text-[11px] font-medium text-slate-500 whitespace-nowrap">
                    {ts.time}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Pagination */}
      {activity.pagination?.total_pages > 1 && (
        <nav aria-label="Activity pagination" className="mt-3 flex items-center justify-between gap-3 pt-2">
          <span className="text-xs sm:text-sm font-medium text-slate-500">
            {activity.items?.length ?? 0} {(activity.items?.length ?? 0) === 1 ? "result" : "results"}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onPrevious}
              disabled={activity.pagination.page === 1}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="text-xs sm:text-sm font-medium text-slate-500 whitespace-nowrap">
              Page {activity.pagination.page} of {activity.pagination.total_pages}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={activity.pagination.page >= activity.pagination.total_pages}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
