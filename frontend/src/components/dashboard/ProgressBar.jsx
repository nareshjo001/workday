/**
 * The single visual progress-bar primitive for the whole app (UI +
 * analytics redesign, spec section 5: "Progress should be shown
 * consistently... prefer a backend-calculated progress value or a
 * shared service"). Never computes a percentage itself — `percent` is
 * always a value the backend already derived (project.work_progress_percent
 * etc.), so this component only ever renders a number it's given, never
 * invents one.
 */
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
