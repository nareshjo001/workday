import AlertBanner from "../AlertBanner";
import PrimaryButton from "../PrimaryButton";

const MINIMUM_SAMPLE = 3;

function formatMoney(value, currency) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function Value({ label, value, currency, suffix = "" }) {
  if (value === null || value === undefined) return null;
  return <div className="min-w-0 rounded bg-surface-muted px-3 py-2"><dt className="text-xs text-muted">{label}</dt><dd className="truncate text-sm font-medium text-text">{currency ? formatMoney(value, currency) : `${value}${suffix}`}</dd></div>;
}

function Findings({ findings, currency }) {
  if (!findings.length) return null;
  return <div className="flex flex-col gap-2" aria-label="Rate intelligence findings">{findings.map((finding) => (
    <article key={finding.code} className={`rounded-md border p-3 text-sm ${finding.code === "PROPOSED_RATE_BELOW_COST" ? "border-error-border bg-error-bg" : "border-border bg-surface"}`}>
      <p className="font-semibold text-text">{finding.severity} — {finding.title}</p>
      <p className="mt-1 text-text-secondary">{finding.summary}</p>
      {finding.evidence.length > 0 && <dl className="mt-2 grid gap-1 sm:grid-cols-2">{finding.evidence.map((item) => <div key={item.key} className="text-xs text-muted"><dt className="inline">{item.label}: </dt><dd className="inline text-text-secondary">{typeof item.value === "number" && item.unit?.endsWith("/hour") ? formatMoney(item.value, currency) : String(item.value)}{item.unit === "%" ? "%" : item.unit && !item.unit.endsWith("/hour") ? ` ${item.unit}` : ""}</dd></div>)}</dl>}
      <p className="mt-2 text-xs text-text-secondary"><span className="font-medium">Recommended action:</span> {finding.recommended_action}</p>
    </article>
  ))}</div>;
}

export default function VendorRateIntelligencePanel({ selectedContractorId, projectId, requirementId, proposedRate, onProposedRateChange, analysis, isLoading, error, onAnalyze }) {
  const hasCompleteContext = Boolean(selectedContractorId && projectId && requirementId && proposedRate !== "" && Number(proposedRate) >= 0);
  const result = analysis?.result;
  const currency = result?.context?.currency;
  const isStale = analysis?.stale;

  return <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="rate-intelligence-title">
    <h3 id="rate-intelligence-title" className="font-semibold text-text">Rate Intelligence</h3>
    <p className="mt-1 text-xs text-muted">Internal commercial benchmark only. This advisory analysis does not save a rate or submit a candidate.</p>
    <label className="mt-3 block text-sm text-text-secondary">Proposed bill rate
      <input aria-label="Proposed bill rate" type="number" min="0" step="0.01" value={proposedRate} onChange={(event) => onProposedRateChange(event.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-text" placeholder="Enter a bill rate" />
    </label>
    {!hasCompleteContext && <p className="mt-2 text-xs text-muted">Select one contractor and enter a proposed bill rate to analyze it.</p>}
    <div className="mt-3"><PrimaryButton type="button" fullWidth={false} onClick={onAnalyze} disabled={!hasCompleteContext || isLoading} isLoading={isLoading} loadingText="Analyzing rate…">{result || isStale ? "Re-analyze rate" : "Analyze rate"}</PrimaryButton></div>
    {error && <div className="mt-3"><AlertBanner message="Rate intelligence is currently unavailable. You can continue with the normal rate workflow." /></div>}
    {isLoading && <p className="mt-3 text-sm text-muted" role="status">Analyzing the selected contractor’s internal commercial context…</p>}
    {isStale && <p className="mt-3 text-sm text-muted">{analysis.message || "Commercial context changed. Re-analyze to refresh Rate Intelligence."}</p>}
    {result && !isStale && <div className="mt-4 flex flex-col gap-4">
      <div><p className="text-sm font-medium text-text">Commercial context</p><dl className="mt-2 grid gap-2 sm:grid-cols-2"><Value label="Contractor cost" value={result.cost.rate} currency={currency} />{result.constraints.applicable_rate_card && <><Value label="Rate-card bill rate" value={result.constraints.applicable_rate_card.bill_rate} currency={currency} /><Value label="Rate-card cost rate" value={result.constraints.applicable_rate_card.cost_rate} currency={currency} /></>}</dl></div>
      <div><p className="text-sm font-medium text-text">Internal comparable history</p><dl className="mt-2 grid gap-2 sm:grid-cols-2"><Value label="Comparable assignments" value={result.comparables.sample_size} />{result.recommendation.status === "AVAILABLE" && <><Value label="Historical comparable range" value={result.recommendation.lower} currency={currency} /><Value label="Historical median" value={result.comparables.median} currency={currency} /><Value label="Historical upper bound" value={result.recommendation.upper} currency={currency} /><Value label="Suggested rate" value={result.recommendation.suggested} currency={currency} /></>}</dl>{result.recommendation.status === "INSUFFICIENT_DATA" && <p className="mt-2 text-sm text-text-secondary">Not enough internal historical data to recommend a rate yet. Minimum required: {MINIMUM_SAMPLE}.</p>}</div>
      {result.proposed_rate && <div><p className="text-sm font-medium text-text">Your proposed rate</p><dl className="mt-2 grid gap-2 sm:grid-cols-2"><Value label="Proposed rate" value={result.proposed_rate.rate} currency={currency} /><Value label="Margin per hour" value={result.proposed_rate.margin_per_hour} currency={currency} /><Value label="Margin" value={result.proposed_rate.margin_percentage} suffix="%" /></dl></div>}
      {result.recommendation.status === "AVAILABLE" && <PrimaryButton type="button" fullWidth={false} onClick={() => onProposedRateChange(String(result.recommendation.suggested))}>Use suggested rate</PrimaryButton>}
      <Findings findings={result.findings} currency={currency} />
    </div>}
  </section>;
}
