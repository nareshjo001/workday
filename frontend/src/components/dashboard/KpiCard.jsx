// Show current KPI values without fabricating historical trends.
export default function KpiCard({ title, value, description, icon, isLoading = false }) {
  return (
    <div className="ui-stat min-w-0 flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        {icon && (
          <span className="text-lg leading-none text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="mt-1 h-8 w-20 animate-pulse rounded bg-surface-muted" />
      ) : (
        <p className="ui-stat-value text-2xl font-semibold tracking-tight text-text">{value}</p>
      )}
      {description && !isLoading && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}
