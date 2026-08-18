import { formatDate, formatHours, formatCurrency, MilestoneStatusBadge } from "./format";

/**
 * Desktop presentation of a project's milestones — hidden below md, where
 * MilestoneCardList takes over. Same split pattern as
 * components/projects/ProjectTable + ProjectCardList.
 *
 * PROJECT-LEVEL REDESIGN: a milestone is now project-wide, not tied to
 * one contractor — each row can have zero (still PENDING), one, or many
 * contributing contractors once MET. Rather than one row per
 * (milestone, contractor) pair, this renders one row per milestone with
 * its `contributions` array (see milestoneRepository.listByProject)
 * expanded as a small nested breakdown, so the milestone's own threshold/
 * status/met-date/total-billed stay a single line while still showing
 * exactly who contributed how much.
 */
export default function MilestoneTable({ milestones }) {
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <th className="py-3 pr-4 font-medium">Milestone</th>
          <th className="py-3 pr-4 font-medium">Threshold</th>
          <th className="py-3 pr-4 font-medium">Met On</th>
          <th className="py-3 pr-4 font-medium">Contributions</th>
          <th className="py-3 pr-4 font-medium">Total Billed</th>
          <th className="py-3 pr-0 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {milestones.map((m) => {
          const totalBilled = m.contributions.reduce((sum, c) => sum + c.billing_amount, 0);
          return (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="py-3 pr-4 font-medium text-text">{m.name}</td>
              <td className="py-3 pr-4 text-text-secondary">{formatHours(m.threshold_hours)} hrs</td>
              <td className="py-3 pr-4 text-text-secondary">
                {m.status === "MET" ? formatDate(m.met_at?.slice(0, 10)) : "—"}
              </td>
              <td className="py-3 pr-4 text-text-secondary">
                {m.contributions.length === 0 ? (
                  "—"
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {m.contributions.map((c) => (
                      <li key={c.contractor_id} className="text-xs">
                        {c.contractor_name}: {formatHours(c.approved_hours)}h ·{" "}
                        {formatCurrency(c.billing_amount)}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="py-3 pr-4 text-text-secondary">
                {m.contributions.length > 0 ? formatCurrency(totalBilled) : "—"}
              </td>
              <td className="py-3 pr-0">
                <MilestoneStatusBadge status={m.status} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
