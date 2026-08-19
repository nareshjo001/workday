import EmptyState from "./EmptyState";

/**
 * Small SVG line/sparkline chart — used for the Contractor dashboard's
 * "Hours Trend" (approved hours per week over time). Built as plain
 * inline SVG rather than pulling in a charting library: this project has
 * no chart library installed anywhere (checked before writing this —
 * see the dashboard redesign's final report for that note), and a
 * handful of points on one line is well within what a ~30-line component
 * can render correctly, so adding a new dependency for it would not be
 * "absolutely necessary" per the spec's own instruction.
 *
 * `stroke="currentColor"` + a `text-primary` class (rather than a
 * hard-coded hex) means the line always matches the app's current
 * --color-primary token, the same pattern every other themed element in
 * this app already uses via Tailwind utility classes.
 */
export default function LineChart({ data, valueKey = "hours", labelKey = "period", emptyMessage = "No data available." }) {
  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} compact />;
  }

  const width = 480;
  const height = 140;
  const paddingX = 24;
  const paddingY = 16;
  const values = data.map((d) => d[valueKey]);
  const maxValue = Math.max(...values, 0) || 1;

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (d[valueKey] / maxValue) * (height - paddingY * 2);
    return { x, y, label: d[labelKey], value: d[valueKey] };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-primary" role="img" aria-label="Approved hours over time">
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="stroke-border"
          strokeWidth="1"
        />
        {points.length > 1 && <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" />}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="currentColor">
            <title>
              {p.label}: {p.value}h
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{points[0]?.label}</span>
        {points.length > 1 && <span>{points[points.length - 1]?.label}</span>}
      </div>
    </div>
  );
}
