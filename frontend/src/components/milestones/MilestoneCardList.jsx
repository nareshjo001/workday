import { formatDate, formatHours, formatCurrency, MilestoneStatusBadge } from "./format";

/**
 * Mobile presentation of a project's milestones — visible below md, where
 * MilestoneTable takes over. Same split pattern as
 * components/projects/ProjectCardList.
 */
export default function MilestoneCardList({ milestones }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {milestones.map((m) => (
        <div key={m.id} className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-text">{m.name}</p>
              <p className="text-xs text-muted">{m.contractor_name}</p>
            </div>
            <MilestoneStatusBadge status={m.status} />
          </div>
          <p className="mt-3 text-sm text-text-secondary">Threshold: {formatHours(m.threshold_hours)} hrs</p>
          {m.status === "MET" && (
            <>
              <p className="mt-1 text-xs text-muted">Met {formatDate(m.met_at?.slice(0, 10))}</p>
              <p className="mt-1 text-sm font-medium text-success">
                {m.billing_amount !== null ? formatCurrency(m.billing_amount) : "—"}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
