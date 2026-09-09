export default function ListControls({ page, totalPages, total, search, onSearchChange, onPrevious, onNext }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      {onSearchChange && <><label className="sr-only" htmlFor="list-search">Search this list</label><input id="list-search" type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm sm:max-w-xs" /></>}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted">
        <span>{total} result{total === 1 ? "" : "s"}</span>
        <button type="button" disabled={page <= 1} onClick={onPrevious} className="rounded border border-border px-3 py-1 disabled:opacity-50">Previous</button>
        <span>Page {page} of {Math.max(totalPages, 1)}</span>
        <button type="button" disabled={page >= totalPages} onClick={onNext} className="rounded border border-border px-3 py-1 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
