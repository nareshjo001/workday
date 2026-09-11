import { Link } from "react-router-dom";

const destinations = {
  TIMESHEETS_AWAITING_REVIEW: { to: "/pm/timesheets", label: "Review timesheets" },
  CANDIDATE_REVIEWS_PENDING: { to: "/pm/staffing-pipeline", label: "Review candidates" },
  INVOICES_AWAITING_REVIEW: { to: "/pm/invoices", label: "Review invoices" },
  ASSIGNMENT_ENDING_SOON: { to: "/pm/milestones", label: "Review assignments" },
  ACTIVE_ASSIGNMENT_PAST_END_DATE: { to: "/pm/milestones", label: "Review assignments" },
};

function displayEvidence(item) { return `${item.value === null ? "—" : String(item.value)}${item.unit ? ` ${item.unit}` : ""}`; }

export default function PMProjectControlPanel({ control, isLoading, error, onRefresh, onOpenRequirements }) {
  if (isLoading) return <section aria-labelledby="project-control-title" className="rounded-lg bg-surface p-5 shadow-panel ring-1 ring-border"><h2 id="project-control-title" className="text-lg font-semibold text-text">Project Control</h2><p className="mt-3 text-sm text-muted" role="status">Loading project attention…</p></section>;
  if (error) return <section aria-labelledby="project-control-title" className="rounded-lg bg-surface p-5 shadow-panel ring-1 ring-border"><h2 id="project-control-title" className="text-lg font-semibold text-text">Project Control</h2><p className="mt-3 text-sm text-danger" role="alert">Project Control could not be loaded. Try again.</p><button type="button" onClick={onRefresh} className="mt-3 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted">Retry Project Control</button></section>;
  if (!control) return null;
  const counts = control.summary.by_severity;
  return <section aria-labelledby="project-control-title" className="rounded-lg bg-surface p-5 shadow-panel ring-1 ring-border sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="project-control-title" className="text-lg font-semibold text-text">Project Control</h2><p className="mt-1 text-sm text-muted">{control.project.name} · {control.project.status}</p></div><button type="button" onClick={onRefresh} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted">Refresh attention</button></div>
    <h3 className="mt-5 text-sm font-semibold text-text">Attention Summary</h3>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><Count label="Needs attention" value={control.summary.attention_count} /><Count label="High" value={counts.HIGH} /><Count label="Medium" value={counts.MEDIUM} /><Count label="Info" value={counts.INFO} /></div>
    {control.findings.length === 0 ? <p className="mt-5 rounded-md bg-surface-muted p-4 text-sm text-text-secondary">No current attention items for this project.</p> : <div className="mt-5 space-y-3"><h3 className="text-sm font-semibold text-text">Items Requiring Review</h3>{control.findings.map((finding) => <Finding key={`${finding.code}-${finding.title}`} finding={finding} onOpenRequirements={onOpenRequirements} />)}</div>}
  </section>;
}
function Count({ label, value }) { return <div className="rounded-md border border-border bg-surface-muted p-3"><span className="block text-xs text-muted">{label}</span><span className="mt-1 block text-lg font-semibold text-text">{value}</span></div>; }
function Finding({ finding, onOpenRequirements }) { const destination = destinations[finding.code]; const requirementsAction = finding.code === "OPEN_REQUIREMENTS_REMAIN" && onOpenRequirements; return <article className="rounded-md border border-border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Severity: {finding.severity}</p><h4 className="mt-1 font-semibold text-text">{finding.title}</h4><p className="mt-1 text-sm text-text-secondary">{finding.summary}</p><dl className="mt-3 grid gap-2 sm:grid-cols-2">{finding.evidence.map((item) => <div key={item.key} className="min-w-0"><dt className="text-xs text-muted">{item.label}</dt><dd className="break-words text-sm text-text">{displayEvidence(item)}</dd></div>)}</dl><p className="mt-3 text-sm text-text-secondary"><span className="font-medium text-text">Recommended action: </span>{finding.recommended_action}</p>{requirementsAction && <button type="button" onClick={onOpenRequirements} className="mt-3 inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted">View requirements</button>}{destination && <Link to={destination.to} className="mt-3 inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted">{destination.label}</Link>}</article>; }
