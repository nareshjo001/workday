import { formatRate, StatusBadge } from "./format";

/**
 * Desktop presentation — hidden below md, where ContractorCardList takes
 * over. Both are dumb list renderers; VendorContractorsPage owns the data
 * and the edit-modal state.
 */
export default function ContractorTable({ contractors, onEdit }) {
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <th className="py-3 pr-4 font-medium">Name</th>
          <th className="py-3 pr-4 font-medium">Email</th>
          <th className="py-3 pr-4 font-medium">Rate</th>
          <th className="py-3 pr-4 font-medium">Status</th>
          <th className="py-3 pr-0 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {contractors.map((contractor) => (
          <tr key={contractor.id} className="border-b border-border last:border-0">
            <td className="py-3 pr-4 font-medium text-text">{contractor.name}</td>
            <td className="py-3 pr-4 text-text-secondary">{contractor.email}</td>
            <td className="py-3 pr-4 text-text-secondary">
              {formatRate(contractor.hourly_rate)}
            </td>
            <td className="py-3 pr-4">
              <StatusBadge status={contractor.status} />
            </td>
            <td className="py-3 pr-0 text-right">
              <button
                type="button"
                onClick={() => onEdit(contractor)}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
