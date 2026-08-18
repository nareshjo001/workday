import { formatDate, formatHours, formatCurrency, MilestoneStatusBadge } from "./format";

/**
 * Desktop presentation of a project's milestones — hidden below md, where
 * MilestoneCardList takes over. Same split pattern as
 * components/projects/ProjectTable + ProjectCardList. Milestones list
 * across every contractor staffed on the project (see
 * pmMilestoneService.listMilestones), so contractor_name is always shown
 * — milestones are project+contractor-specific, never a project-wide
 * total (see migration 014's comment).
 */
export default function MilestoneTable({ milestones }) {
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <th className="py-3 pr-4 font-medium">Milestone</th>
          <th className="py-3 pr-4 font-medium">Contractor</th>
          <th className="py-3 pr-4 font-medium">Threshold</th>
          <th className="py-3 pr-4 font-medium">Met On</th>
          <th className="py-3 pr-4 font-medium">Billing</th>
          <th className="py-3 pr-0 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {milestones.map((m) => (
          <tr key={m.id} className="border-b border-border last:border-0">
            <td className="py-3 pr-4 font-medium text-text">{m.name}</td>
            <td className="py-3 pr-4 text-text-secondary">{m.contractor_name}</td>
            <td className="py-3 pr-4 text-text-secondary">{formatHours(m.threshold_hours)} hrs</td>
            <td className="py-3 pr-4 text-text-secondary">{m.status === "MET" ? formatDate(m.met_at?.slice(0, 10)) : "—"}</td>
            <td className="py-3 pr-4 text-text-secondary">
              {m.billing_amount !== null ? formatCurrency(m.billing_amount) : "—"}
            </td>
            <td className="py-3 pr-0">
              <MilestoneStatusBadge status={m.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
