import AlertBanner from "../AlertBanner";
import PrimaryButton from "../PrimaryButton";

function displayEvidence(item) { return `${item.value === null ? "—" : String(item.value)}${item.unit ? ` ${item.unit}` : ""}`; }

export default function ContractorTimesheetIntelligencePanel({ proposal, analysis, stale, isLoading, error, onAnalyze }) {
  const complete = Boolean(proposal.projectId && proposal.workDate && proposal.hoursLogged !== "" && Number(proposal.hoursLogged) > 0);
  return <section className="rounded-lg border border-border bg-surface-muted p-4" aria-labelledby="timesheet-intelligence-title">
    <h3 id="timesheet-intelligence-title" className="font-semibold text-text">Timesheet Intelligence</h3>
    <p className="mt-1 text-xs text-muted">Advisory only. Normal submission validation still applies.</p>
    {!complete && <p className="mt-2 text-sm text-muted">Select a project, work date, and hours to check this timesheet.</p>}
    <div className="mt-3"><PrimaryButton type="button" fullWidth={false} onClick={onAnalyze} disabled={!complete || isLoading} isLoading={isLoading} loadingText="Checking timesheet…">{analysis || stale ? "Check again" : "Check before submitting"}</PrimaryButton></div>
    {isLoading && <p className="mt-3 text-sm text-muted" role="status">Checking timesheet…</p>}
    {error && <div className="mt-3"><AlertBanner message="Timesheet check could not be loaded. You can retry, or continue with the normal submission flow." /></div>}
    {stale && <p className="mt-3 text-sm text-muted">Timesheet details changed. Check again before relying on the previous result.</p>}
    {analysis && !stale && <div className="mt-4">
      {analysis.findings.length === 0 ? <p className="rounded-md bg-surface p-3 text-sm text-text-secondary">No current timesheet intelligence findings. Normal submission validation still applies.</p> : <div className="space-y-3" aria-label="Timesheet intelligence findings">{analysis.findings.map((finding) => <article key={`${finding.code}-${finding.title}`} className="rounded-md border border-border bg-surface p-3"><p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Severity: {finding.severity}</p><h4 className="mt-1 font-semibold text-text">{finding.title}</h4><p className="mt-1 text-sm text-text-secondary">{finding.summary}</p><dl className="mt-3 grid gap-2 sm:grid-cols-2">{finding.evidence.map((item) => <div key={item.key} className="min-w-0"><dt className="text-xs text-muted">{item.label}</dt><dd className="break-words text-sm text-text">{displayEvidence(item)}</dd></div>)}</dl><p className="mt-3 text-sm text-text-secondary"><span className="font-medium text-text">Recommended action: </span>{finding.recommended_action}</p></article>)}</div>}
    </div>}
  </section>;
}
