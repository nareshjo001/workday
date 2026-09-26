import { formatDate, formatHours, formatCurrency, MilestoneStatusBadge } from "./format";

export default function MilestoneCardList({ milestones }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {milestones.map((m) => {
        const totalBilled = m.contributions.reduce((sum, c) => sum + c.billing_amount, 0);
        return (
          <article key={m.id} className="rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Plan #{m.sequence_order || "—"} · {m.due_date ? `Due ${formatDate(m.due_date.slice(0, 10))}` : "No due date"}
                </p>
              </div>
              <MilestoneStatusBadge status={m.status} />
            </div>
            {m.description && <p className="mt-2 text-xs text-slate-500">{m.description}</p>}
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs">
              <div>
                <dt className="text-slate-500">Threshold</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{formatHours(m.threshold_hours)} hrs</dd>
              </div>
              <div>
                <dt className="text-slate-500">Met on</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{m.status === "MET" ? formatDate(m.met_at?.slice(0, 10)) : "—"}</dd>
              </div>
            </dl>
            {m.status === "MET" && (
              <>
                {m.contributions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1 border-t border-slate-200 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contributions</p>
                    {m.contributions.map((c) => (
                      <p key={c.contractor_id} className="text-xs text-slate-600">
                        {c.contractor_name}: {formatHours(c.approved_hours)}h ·{" "}
                        {formatCurrency(c.billing_amount)}
                      </p>
                    ))}
                    <p className="mt-1 text-xs font-semibold text-slate-900">
                      Total billed: {formatCurrency(totalBilled)}
                    </p>
                  </div>
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
