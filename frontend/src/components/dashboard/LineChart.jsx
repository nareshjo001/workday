import { useEffect, useRef, useState } from "react";
import EmptyState from "./EmptyState";

// Render weekly approved-hour trends using dependency-free SVG.
export default function LineChart({
  data,
  valueKey = "hours",
  labelKey = "period",
  emptyMessage = "No data available.",
  formatLabel = (label) => label,
  seriesLabel = "Approved hours",
  yAxisLabel = "Hours",
}) {
  const chartHostRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(900);
  const dataLength = data?.length ?? 0;

  useEffect(() => {
    if (!chartHostRef.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(300, Math.round(entry.contentRect.width)));
    });
    observer.observe(chartHostRef.current);
    return () => observer.disconnect();
  }, [dataLength]);

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} compact />;
  }

  const width = chartWidth;
  const height = width < 480 ? 220 : width < 800 ? 240 : 270;
  const plot = { left: 58, right: 20, top: 28, bottom: 46 };
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const rawMax = Math.max(...values, 0);
  const tickStep = Math.max(1, Math.ceil(rawMax / 4));
  const maxValue = tickStep * 4;
  const baseline = height - plot.bottom;

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? width / 2
        : plot.left + (i / (data.length - 1)) * (width - plot.left - plot.right);
    const y = baseline - ((Number(d[valueKey]) || 0) / maxValue) * (baseline - plot.top);
    return { x, y, label: d[labelKey], value: Number(d[valueKey]) || 0 };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = points.length > 1
    ? `${pathD} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`
    : "";
  const yTicks = Array.from({ length: 5 }, (_, index) => index * tickStep);
  const targetLabels = width < 480 ? 3 : width < 800 ? 4 : 6;
  const labelInterval = Math.max(1, Math.ceil(points.length / targetLabels));
  const visibleLabelIndexes = new Set(
    points.map((_, index) => index).filter((index) => index % labelInterval === 0 || index === points.length - 1)
  );

  return (
    <div className="contractor-hours-chart" data-testid="contractor-hours-chart">
      <div className="contractor-hours-legend" aria-label={`${seriesLabel} legend`}>
        <span aria-hidden="true" />
        {seriesLabel}
      </div>
      <div ref={chartHostRef} className="contractor-hours-chart-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ height }} role="img" aria-label={`${seriesLabel} per week`}>
          <title>{seriesLabel} per week</title>
          <desc>Weekly approved hours, beginning at zero hours.</desc>
          <defs>
            <linearGradient id="contractor-hours-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f75e8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2f75e8" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = baseline - (tick / maxValue) * (baseline - plot.top);
            return (
              <g key={tick}>
                <line x1={plot.left} y1={y} x2={width - plot.right} y2={y} className="contractor-hours-gridline" />
                <text x={plot.left - 13} y={y + 4} textAnchor="end" className="contractor-hours-axis-text">{tick}</text>
              </g>
            );
          })}
          <text x="16" y={(plot.top + baseline) / 2} textAnchor="middle" className="contractor-hours-axis-title" transform={`rotate(-90 16 ${(plot.top + baseline) / 2})`}>
            {yAxisLabel}
          </text>
          {areaD && <path d={areaD} fill="url(#contractor-hours-area)" />}
          {points.length > 1 && <path d={pathD} className="contractor-hours-line" />}
          {points.map((p, index) => visibleLabelIndexes.has(index) && (
            <text key={`label-${p.label}`} x={p.x} y={height - 16} textAnchor="middle" className="contractor-hours-axis-text">
              {formatLabel(p.label, true)}
            </text>
          ))}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" className="contractor-hours-marker">
            <title>
              {formatLabel(p.label, false)}: {p.value}h approved
            </title>
          </circle>
        ))}
        </svg>
      </div>
    </div>
  );
}
