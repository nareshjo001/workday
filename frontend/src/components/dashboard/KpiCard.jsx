/**
 * The one KPI/stat card component every role dashboard uses (Vendor/PM/
 * Contractor — UI + analytics redesign). Deliberately has NO trend/
 * change-indicator prop: this app has no historical snapshot of past
 * KPI values anywhere in the schema, and the spec is explicit that a
 * fake "+2 from last month" must never be shown when that data doesn't
 * really exist — so rather than build a prop that's always unused, this
 * component only ever renders the current, real value.
 */
export default function KpiCard({ title, value, description, icon, isLoading = false }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-5">
      <div className="flex items-center justify-between gap-2">
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
        <p className="text-2xl font-semibold tracking-tight text-text">{value}</p>
      )}
      {description && !isLoading && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}
