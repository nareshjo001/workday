import EmptyState from "./EmptyState";

/**
 * Generic horizontal bar chart used across all three dashboards
 * (earnings by company/contractor, revenue by project, invoice/milestone
 * status distribution) — a labeled row + proportional bar per item,
 * rather than a pie/donut (simpler to read at a glance, and avoids SVG
 * arc-geometry edge cases for a small MVP chart set). Callers pass
 * already-formatted display strings (`displayValue`) so this component
 * never needs to know whether `value` is a currency amount, an hours
 * total, or a plain count — no formatting logic is duplicated here.
 *
 * Bars use `bg-primary`/`bg-surface-muted`, the same design tokens as
 * every other UI element in this app (see index.css) — no chart-specific
 * color palette was introduced, so this automatically matches the rest
 * of the app's look with zero extra theming work.
 */
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
            <div className="flex items-center justify-between gap-3 text-sm">
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
