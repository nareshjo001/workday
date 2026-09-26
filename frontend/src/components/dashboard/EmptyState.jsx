// Use compact spacing when the empty state sits inside an existing card.
export default function EmptyState({ message, hint, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface-muted text-center ${
        compact ? "px-4 py-6" : "px-6 py-12"
      }`}
    >
      <p className="text-sm text-text-secondary">{message}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}
