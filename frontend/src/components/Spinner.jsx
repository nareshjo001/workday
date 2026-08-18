export default function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 text-muted">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"
        role="status"
        aria-label={label}
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
