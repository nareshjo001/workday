/** Keeps every column available without allowing a table to widen its page. */
export default function DataTableScroll({ children, label = "Data table", className = "" }) {
  return <div className={`min-w-0 ${className}`}><p className="mb-2 text-xs text-muted">Scroll horizontally to view all columns when needed.</p><div role="region" aria-label={label} tabIndex={0} className="data-table-scroll">{children}</div></div>;
}
