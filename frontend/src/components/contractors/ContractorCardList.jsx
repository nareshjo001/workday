import { formatRate, StatusBadge } from "./format";

/**
 * Mobile presentation — visible below md, where ContractorTable takes
 * over. Avoids forcing a wide table onto small screens.
 */
export default function ContractorCardList({ contractors, onEdit }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {contractors.map((contractor) => (
        <div key={contractor.id} className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-text">{contractor.name}</p>
              <p className="text-sm text-muted">{contractor.email}</p>
            </div>
            <StatusBadge status={contractor.status} />
          </div>
          <p className="mt-3 text-sm text-text-secondary">
            Rate:{" "}
            <span className="font-medium text-text">
              {formatRate(contractor.hourly_rate)} / hour
            </span>
          </p>
          <button
            type="button"
            onClick={() => onEdit(contractor)}
            className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Edit
          </button>
        </div>
      ))}
    </div>
  );
}
