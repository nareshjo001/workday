import EmptyState from "./EmptyState";

// Render proportional bars with caller-formatted labels for currency, hours, or counts.
export default function BarList({ data, emptyMessage = "No data available.", barColorClass = "bg-primary" }) {
  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} compact />;
  }

  const max = Math.max(...data.map((d) => d.value), 0) || 1;

  return (
    <ul className="flex flex-col gap-3">
      {data.map((item, idx) => {
        const widthPercent = Math.max(2, Math.round((item.value / max) * 100));
        return (
          <li key={item.label ?? idx} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="truncate text-text-secondary" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-medium text-text">{item.displayValue}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted" title={`${item.label}: ${item.displayValue}`}>
              <div
                className={`h-2 rounded-full ${barColorClass} transition-[width] duration-300`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
