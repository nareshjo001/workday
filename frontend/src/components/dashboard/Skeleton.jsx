/**
 * Loading-state placeholders for the dashboards. No skeleton primitive
 * existed anywhere in this app before this feature (Spinner.jsx is a
 * full-region spinner, not a shaped placeholder) — these are small and
 * scoped to exactly what the dashboards need: a row of KPI-card-shaped
 * blocks and a block-shaped section placeholder, both plain `animate-pulse`
 * divs using the existing `bg-surface-muted` token, no new dependency.
 */
export function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-5">
      <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
      <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
    </div>
  );
}

export function KpiRowSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SectionSkeleton({ lines = 4 }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-surface-muted" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
