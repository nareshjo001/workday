import { formatDate, formatHours, formatCurrency, MilestoneStatusBadge } from "./format";

// Render each project milestone once with its nested contractor contributions.
export default function MilestoneTable({ milestones }) {
  return (
    <div role="region" aria-label="Milestone Table" tabIndex={0} className="hidden max-w-full overflow-x-auto rounded-lg border border-slate-200 md:block">
      <table className="w-full min-w-[920px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[15%]" />
          <col className="w-[18%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[19%]" />
          <col className="w-[14%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.06em] text-slate-500">
            <th className="px-3 py-2.5 font-semibold">Milestone</th>
            <th className="px-3 py-2.5 font-semibold">Plan</th>
            <th className="px-3 py-2.5 font-semibold">Threshold</th>
            <th className="px-3 py-2.5 font-semibold">Met On</th>
            <th className="px-3 py-2.5 font-semibold">Contributions</th>
            <th className="px-3 py-2.5 font-semibold">Total Billed</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => {
            const totalBilled = m.contributions.reduce((sum, c) => sum + c.billing_amount, 0);
            return (
              <tr key={m.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50/50">
                <td className="px-3 py-2.5 font-semibold leading-5 text-slate-900">{m.name}</td>
                <td className="px-3 py-2.5 text-xs leading-4 text-slate-500">
                  <span className="font-medium text-slate-700">#{m.sequence_order || "—"}</span><br />
                  {m.due_date ? `Due ${formatDate(m.due_date.slice(0, 10))}` : "No due date"}<br />
                  <span className="text-slate-400">{m.description || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-700">{formatHours(m.threshold_hours)} hrs</td>
                <td className="px-3 py-2.5 text-slate-700">
                  {m.status === "MET" ? formatDate(m.met_at?.slice(0, 10)) : "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {m.contributions.length === 0 ? (
                    "—"
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {m.contributions.map((c) => (
                        <li key={c.contractor_id} className="text-xs leading-4">
                          <span className="font-medium text-slate-700">{c.contractor_name}</span><br />
                          {formatHours(c.approved_hours)}h · {formatCurrency(c.billing_amount)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-900">
                  {m.contributions.length > 0 ? formatCurrency(totalBilled) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <MilestoneStatusBadge status={m.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
