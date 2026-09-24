import AlertBanner from "../AlertBanner";

function displayEvidence(item) {
  return `${item.value === null ? "—" : String(item.value)}${item.unit ? ` ${item.unit}` : ""}`;
}

export default function ContractorTimesheetIntelligencePanel({
  proposal,
  analysis,
  stale,
  isLoading,
  error,
  onAnalyze,
}) {
  const complete = Boolean(
    proposal.projectId &&
    proposal.workDate &&
    proposal.hoursLogged !== "" &&
    Number(proposal.hoursLogged) > 0
  );

  return (
    <section
      className="rounded-lg border border-blue-200/80 bg-[#f0f7ff] p-2.5 sm:p-3 transition-all"
      aria-labelledby="timesheet-intelligence-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="shrink-0 text-blue-500 mt-0.5">
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3
              id="timesheet-intelligence-title"
              className="text-[13px] sm:text-sm font-bold text-slate-900 leading-tight"
            >
              Timesheet Intelligence
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Advisory only. Normal submission validation still applies.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!complete || isLoading}
          className="shrink-0 rounded-md border border-blue-200/90 bg-[#e7f0fa] hover:bg-blue-100 active:bg-blue-200/80 text-blue-700 font-medium text-xs sm:text-[13px] px-3 py-1 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? "Checking timesheet…" : analysis || stale ? "Check again" : "Check before submitting"}
        </button>
      </div>

      {!complete && (
        <p className="mt-1.5 text-xs text-slate-500 pl-6">
          Select a project, work date, and hours to check this timesheet.
        </p>
      )}

      {isLoading && (
        <p className="mt-1.5 text-xs text-slate-500 pl-6" role="status">
          Checking timesheet…
        </p>
      )}

      {error && (
        <div className="mt-1.5 pl-6">
          <AlertBanner message="Timesheet check could not be loaded. You can retry, or continue with the normal submission flow." />
        </div>
      )}

      {stale && (
        <p className="mt-1.5 text-xs text-amber-700 pl-6">
          Timesheet details changed. Check again before relying on the previous result.
        </p>
      )}

      {analysis && !stale && (
        <div className="mt-2 pl-6">
          {analysis.findings.length === 0 ? (
            <p className="rounded-lg bg-white/90 border border-blue-100 p-2 text-xs sm:text-[13px] text-slate-600 shadow-2xs">
              No current timesheet intelligence findings. Normal submission validation still applies.
            </p>
          ) : (
            <div className="space-y-2" aria-label="Timesheet intelligence findings">
              {analysis.findings.map((finding) => (
                <article
                  key={`${finding.code}-${finding.title}`}
                  className="rounded-lg border border-blue-100 bg-white p-3 shadow-2xs text-xs sm:text-[13px]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Severity: {finding.severity}
                  </p>
                  <h4 className="mt-0.5 font-semibold text-slate-900">{finding.title}</h4>
                  <p className="mt-0.5 text-slate-600">{finding.summary}</p>
                  <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {finding.evidence.map((item) => (
                      <div key={item.key} className="min-w-0">
                        <dt className="text-[11px] text-slate-500">{item.label}</dt>
                        <dd className="break-words font-medium text-slate-800">{displayEvidence(item)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-slate-600">
                    <span className="font-semibold text-slate-800">Recommended action: </span>
                    {finding.recommended_action}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
