// Render the server-computed progress percentage without recalculating it.
export default function ProgressBar({ percent, size = "md" }) {
  const safePercent = percent === null || percent === undefined || Number.isNaN(percent) ? null : Math.max(0, Math.min(100, percent));
  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div
      role="progressbar"
      aria-valuenow={safePercent ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-surface-muted ${heightClass}`}
    >
      {safePercent !== null && (
        <div
          className={`${heightClass} rounded-full transition-[width] duration-300 ${
            safePercent >= 100 ? "bg-success" : "bg-primary"
          }`}
          style={{ width: `${safePercent}%` }}
        />
      )}
    </div>
  );
}
