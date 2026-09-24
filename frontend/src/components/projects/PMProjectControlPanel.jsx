import { Link } from "react-router-dom";

const destinations = {
  TIMESHEETS_AWAITING_REVIEW: { to: "/pm/timesheets", label: "Review timesheets" },
  CANDIDATE_REVIEWS_PENDING: { to: "/pm/staffing-pipeline", label: "Review candidates" },
  INVOICES_AWAITING_REVIEW: { to: "/pm/invoices", label: "Review invoices" },
  ASSIGNMENT_ENDING_SOON: { to: "/pm/milestones", label: "Review assignments" },
  ACTIVE_ASSIGNMENT_PAST_END_DATE: { to: "/pm/milestones", label: "Review assignments" },
};

function displayEvidence(item) { return `${item.value === null ? "—" : String(item.value)}${item.unit ? ` ${item.unit}` : ""}`; }
function hasEvidenceValue(item) { return item.value !== null && item.value !== undefined && String(item.value).trim() !== ""; }

export default function PMProjectControlPanel({ control, isLoading, error, onRefresh, onOpenRequirements, onClose, aiEnabled = false, explanations = {}, onExplain, embedded = false, hideHeader = false }) {
  const shellClassName = embedded ? "" : "rounded-lg bg-surface p-5 shadow-panel ring-1 ring-border";
  const sectionLabel = hideHeader ? { "aria-label": "Project Control status" } : { "aria-labelledby": "project-control-title" };
  if (isLoading) return <section {...sectionLabel} className={shellClassName}>{!hideHeader && <h2 id="project-control-title" className="text-lg font-semibold text-text">Project Control</h2>}<p className={hideHeader ? "text-sm text-muted" : "mt-3 text-sm text-muted"} role="status">Loading project attention…</p></section>;
  if (error) return <section {...sectionLabel} className={shellClassName}>{!hideHeader && <h2 id="project-control-title" className="text-lg font-semibold text-text">Project Control</h2>}<p className={hideHeader ? "text-sm text-danger" : "mt-3 text-sm text-danger"} role="alert">Project Control could not be loaded. Try again.</p><button type="button" onClick={onRefresh} className="mt-3 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted">Retry Project Control</button></section>;
  if (!control) return null;
  const counts = control.summary.by_severity;
  return <section aria-labelledby="project-control-title" className={embedded ? "" : "rounded-lg bg-surface p-5 shadow-panel ring-1 ring-border sm:p-6"}>
    {!hideHeader && <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="project-control-title" className="text-lg font-semibold text-text">Project Control</h2><p className="mt-1 text-sm text-muted">{control.project.name} · {control.project.status}</p></div><button type="button" onClick={onRefresh} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted">Refresh attention</button></div>}
    <h3 id={hideHeader ? "project-control-title" : undefined} className={`project-control-section-title${hideHeader ? "" : " project-control-section-title-spaced"}`}>Attention Summary</h3>
    <div className="project-control-summary-grid"><Count label="Needs attention" value={control.summary.attention_count} tone="neutral" /><Count label="High" value={counts.HIGH} tone="high" /><Count label="Medium" value={counts.MEDIUM} tone="medium" /><Count label="Info" value={counts.INFO} tone="info" /></div>
    {control.findings.length === 0 ? <p className="project-control-empty">No current attention items for this project.</p> : <div className="project-control-findings"><h3 className="project-control-section-title">Items Requiring Review</h3>{control.findings.map((finding) => <Finding key={`${finding.code}-${finding.title}`} finding={finding} onOpenRequirements={onOpenRequirements} onClose={onClose} aiEnabled={aiEnabled} explanation={explanations[`${control.project.id}:${finding.code}`]} onExplain={onExplain} />)}</div>}
  </section>;
}
function Count({ label, value, tone }) { return <div className={`project-control-summary-card project-control-summary-${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function Finding({ finding, onOpenRequirements, onClose, aiEnabled, explanation, onExplain }) {
  const destination = destinations[finding.code];
  const requirementsAction = finding.code === "OPEN_REQUIREMENTS_REMAIN" && onOpenRequirements;
  const evidence = finding.evidence.filter(hasEvidenceValue);
  const tone = finding.severity.toLowerCase();
  return <article className={`project-control-finding project-control-finding-${tone}`}>
    <div className={`project-control-severity-icon project-control-severity-${tone}`}><SeverityIcon severity={finding.severity} /></div>
    <div className="project-control-finding-content">
      <div className="project-control-finding-heading">
        <div className="project-control-finding-copy">
          <p className={`project-control-severity-pill project-control-severity-${tone}`}>Severity: {finding.severity}</p>
          <h4>{finding.title}</h4>
          <p className="project-control-finding-summary">{finding.summary}</p>
        </div>
        <div className="project-control-finding-actions">
          {requirementsAction && <button type="button" onClick={onOpenRequirements} className="project-control-action">View requirements</button>}
          {destination && <Link to={destination.to} onClick={() => onClose?.()} className="project-control-action">{destination.label}</Link>}
        </div>
      </div>
      {evidence.length > 0 && <dl className="project-control-detail-grid">{evidence.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{displayEvidence(item)}</dd></div>)}</dl>}
      <div className="project-control-recommendation"><span>Recommended action:</span> {finding.recommended_action}</div>
      {aiEnabled && <button type="button" disabled={explanation?.loading} onClick={() => onExplain?.(finding)} className="project-control-action project-control-explain">{explanation?.loading ? "Generating explanation…" : "Explain with AI"}</button>}
      {explanation?.error && <p className="project-control-explanation-error" role="alert">Explanation could not be loaded. You can try again; the verified finding remains available.</p>}
      {explanation?.data && <div className="project-control-explanation" role="status"><h5>{explanation.data.source === "AI" ? "AI explanation" : "System fallback explanation"}</h5><p>{explanation.data.explanation}</p><small>Generated from the verified system finding. The underlying finding and action remain system-determined.</small></div>}
    </div>
  </article>;
}

function SeverityIcon({ severity }) {
  if (severity === "MEDIUM") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.6 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  if (severity === "INFO") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>;
  if (severity === "LOW") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12h7" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16.5h.01" /></svg>;
}
