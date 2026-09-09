/**
 * The boxed-card wrapper every dashboard section (charts, tables,
 * activity feed) sits in — the exact "rounded-lg bg-surface p-4
 * shadow-panel ring-1 ring-border sm:p-6" pattern already used inline in
 * PmMilestonesPage/VendorAssignmentsPage etc., pulled into one component
 * so all three new dashboards render visually identical section boxes.
 */
export default function SectionCard({ title, description, action, children, className = "" }) {
  return (
    <div className={`min-w-0 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
