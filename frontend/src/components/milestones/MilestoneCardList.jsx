import { formatDate, formatHours, formatCurrency, MilestoneStatusBadge } from "./format";

/**
 * Mobile presentation of a project's milestones — visible below md, where
 * MilestoneTable takes over. Same split pattern as
 * components/projects/ProjectCardList, and the same project-level
 * `contributions` breakdown MilestoneTable renders (see its comment).
 */
export default function MilestoneCardList({ milestones }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {milestones.map((m) => {
        const totalBilled = m.contributions.reduce((sum, c) => sum + c.billing_amount, 0);
        return (
          <div key={m.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-text">{m.name}</p>
              <MilestoneStatusBadge status={m.status} />
            </div>
            <p className="mt-3 text-sm text-text-secondary">Threshold: {formatHours(m.threshold_hours)} hrs</p>
            {m.status === "MET" && (
              <>
                <p className="mt-1 text-xs text-muted">Met {formatDate(m.met_at?.slice(0, 10))}</p>
                {m.contributions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                    {m.contributions.map((c) => (
                      <p key={c.contractor_id} className="text-xs text-text-secondary">
                        {c.contractor_name}: {formatHours(c.approved_hours)}h ·{" "}
                        {formatCurrency(c.billing_amount)}
                      </p>
                    ))}
                    <p className="mt-1 text-sm font-medium text-success">
                      Total: {formatCurrency(totalBilled)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
