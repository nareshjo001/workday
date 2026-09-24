import AlertBanner from "../AlertBanner";
import PrimaryButton from "../PrimaryButton";

const MINIMUM_SAMPLE = 3;

function formatMoney(value, currency) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function Value({ label, value, currency, suffix = "" }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="truncate text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
        {currency ? formatMoney(value, currency) : `${value}${suffix}`}
      </dd>
    </div>
  );
}

function Findings({ findings, currency }) {
  if (!findings.length) return null;
  return (
    <div className="flex flex-col gap-2" aria-label="Rate intelligence findings">
      {findings.map((finding) => (
        <article
          key={finding.code}
          className={`rounded-lg border p-3 text-xs sm:text-[13px] ${
            finding.code === "PROPOSED_RATE_BELOW_COST"
              ? "border-red-200 bg-red-50/50 text-red-900"
              : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          <p className="font-bold text-slate-900">{finding.severity} — {finding.title}</p>
          <p className="mt-1 text-slate-600">{finding.summary}</p>
          {finding.evidence.length > 0 && (
            <dl className="mt-2 grid gap-1 sm:grid-cols-2 text-xs">
              {finding.evidence.map((item) => (
                <div key={item.key} className="text-slate-500">
                  <dt className="inline font-medium">{item.label}: </dt>
                  <dd className="inline text-slate-800">
                    {typeof item.value === "number" && item.unit?.endsWith("/hour")
                      ? formatMoney(item.value, currency)
                      : String(item.value)}
                    {item.unit === "%" ? "%" : item.unit && !item.unit.endsWith("/hour") ? ` ${item.unit}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Recommended action:</span> {finding.recommended_action}
          </p>
        </article>
      ))}
    </div>
  );
}

export default function VendorRateIntelligencePanel({
  selectedContractorId,
  projectId,
  requirementId,
  proposedRate,
  onProposedRateChange,
  analysis,
  isLoading,
  error,
  onAnalyze,
}) {
  const hasCompleteContext = Boolean(
    selectedContractorId && projectId && requirementId && proposedRate !== "" && Number(proposedRate) >= 0
  );
  const result = analysis?.result;
  const currency = result?.context?.currency;
  const isStale = analysis?.stale;

  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs"
      aria-labelledby="rate-intelligence-title"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100/80 shadow-xs mt-0.5">
          <TrendingUpIcon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="rate-intelligence-title" className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug">
            Rate Intelligence
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 leading-tight">
            Internal commercial benchmark only. This advisory analysis does not save a rate or submit a candidate.
          </p>
        </div>
      </div>

      <label className="mt-3 block text-xs sm:text-[12.5px] font-medium text-slate-700">
        Proposed bill rate
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-semibold text-slate-400">
            ₹
          </span>
          <input
            aria-label="Proposed bill rate"
            type="number"
            min="0"
            step="0.01"
            value={proposedRate}
            onChange={(event) => onProposedRateChange(event.target.value)}
            className="h-10 sm:h-[42px] block w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="Enter a bill rate"
          />
        </div>
      </label>

      {!hasCompleteContext && (
        <p className="mt-1.5 text-xs text-slate-500">
          Select one contractor and enter a proposed bill rate to analyze it.
        </p>
      )}

      <div className="mt-3">
        <PrimaryButton
          type="button"
          fullWidth={false}
          onClick={onAnalyze}
          disabled={!hasCompleteContext || isLoading}
          isLoading={isLoading}
          loadingText="Analyzing rate…"
          className="h-9 sm:h-10 px-4 text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-2"
        >
          <TrendingUpIcon className="w-4 h-4 shrink-0" />
          <span>{result || isStale ? "Re-analyze rate" : "Analyze rate"}</span>
        </PrimaryButton>
      </div>

      {error && (
        <div className="mt-3">
          <AlertBanner message="Rate intelligence is currently unavailable. You can continue with the normal rate workflow." />
        </div>
      )}

      {isLoading && (
        <p className="mt-3 text-xs sm:text-sm text-slate-500" role="status">
          Analyzing the selected contractor’s internal commercial context…
        </p>
      )}

      {isStale && (
        <p className="mt-3 text-xs sm:text-sm text-amber-600 font-medium">
          {analysis.message || "Commercial context changed. Re-analyze to refresh Rate Intelligence."}
        </p>
      )}

      {result && !isStale && (
        <div className="mt-3.5 flex flex-col gap-3.5 border-t border-slate-100 pt-3.5">
          <div>
            <p className="text-xs sm:text-[13px] font-bold text-slate-900">Commercial context</p>
            <dl className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <Value label="Contractor cost" value={result.cost.rate} currency={currency} />
              {result.constraints.applicable_rate_card && (
                <>
                  <Value label="Rate-card bill rate" value={result.constraints.applicable_rate_card.bill_rate} currency={currency} />
                  <Value label="Rate-card cost rate" value={result.constraints.applicable_rate_card.cost_rate} currency={currency} />
                </>
              )}
            </dl>
          </div>

          <div>
            <p className="text-xs sm:text-[13px] font-bold text-slate-900">Internal comparable history</p>
            <dl className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <Value label="Comparable assignments" value={result.comparables.sample_size} />
              {result.recommendation.status === "AVAILABLE" && (
                <>
                  <Value label="Historical comparable range" value={result.recommendation.lower} currency={currency} />
                  <Value label="Historical median" value={result.comparables.median} currency={currency} />
                  <Value label="Historical upper bound" value={result.recommendation.upper} currency={currency} />
                  <Value label="Suggested rate" value={result.recommendation.suggested} currency={currency} />
                </>
              )}
            </dl>
            {result.recommendation.status === "INSUFFICIENT_DATA" && (
              <p className="mt-1.5 text-xs text-slate-500">
                Not enough internal historical data to recommend a rate yet. Minimum required: {MINIMUM_SAMPLE}.
              </p>
            )}
          </div>

          {result.proposed_rate && (
            <div>
              <p className="text-xs sm:text-[13px] font-bold text-slate-900">Your proposed rate</p>
              <dl className="mt-1.5 grid gap-2 sm:grid-cols-2">
                <Value label="Proposed rate" value={result.proposed_rate.rate} currency={currency} />
                <Value label="Margin per hour" value={result.proposed_rate.margin_per_hour} currency={currency} />
                <Value label="Margin" value={result.proposed_rate.margin_percentage} suffix="%" />
              </dl>
            </div>
          )}

          {result.recommendation.status === "AVAILABLE" && (
            <div>
              <button
                type="button"
                onClick={() => onProposedRateChange(String(result.recommendation.suggested))}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 transition-colors"
              >
                Use suggested rate
              </button>
            </div>
          )}

          <Findings findings={result.findings} currency={currency} />
        </div>
      )}
    </section>
  );
}

function TrendingUpIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
