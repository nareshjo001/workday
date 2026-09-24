import { formatDateTime, formatCurrency, InvoiceStatusBadge } from "./format";

function DateTimeValue({ value, stacked = false }) {
  const formatted = formatDateTime(value);
  if (!stacked || formatted === "—") return <span>{formatted}</span>;
  const separator = formatted.lastIndexOf(", ");
  if (separator < 0) return <span>{formatted}</span>;
  return <span className="flex flex-col leading-tight"><span>{formatted.slice(0, separator)}</span><span className="mt-1 text-[11px] text-slate-500">{formatted.slice(separator + 2)}</span></span>;
}

export default function InvoiceTable({ invoices, selectedId, onSelect, stackDateTime = false }) {
  return <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 md:block" aria-label="Invoice history table">
    <table className="w-full min-w-[820px] text-left text-xs">
      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600"><tr>{["Invoice", "Project", "Amount", "Generated", "Status", "Reviewed"].map((heading) => <th key={heading} className="px-3.5 py-2.5">{heading}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-200">{invoices.map((invoice) => {
        const isSelected = selectedId === invoice.id;
        return <tr key={invoice.id} tabIndex={0} onClick={() => onSelect?.(invoice)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(invoice); } }} className={`cursor-pointer border-l-2 transition ${isSelected ? "border-l-blue-500 bg-blue-50/60 font-medium" : "border-l-transparent hover:bg-slate-50/60"}`}>
          <td className="px-3.5 py-3"><button type="button" aria-current={isSelected ? "true" : undefined} onClick={(event) => { event.stopPropagation(); onSelect?.(invoice); }} className="block w-full text-left text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">{invoice.invoice_number || `Draft #${invoice.id}`}</button></td>
          <td className="max-w-[220px] truncate px-3.5 py-3 text-slate-700" title={invoice.project_name}>{invoice.project_name || "—"}</td>
          <td className="px-3.5 py-3 font-medium tabular-nums text-slate-900">{formatCurrency(invoice.total_amount ?? invoice.amount)}</td>
          <td className="px-3.5 py-3 whitespace-nowrap text-slate-600"><DateTimeValue value={invoice.generated_at} stacked={stackDateTime} /></td>
          <td className="px-3.5 py-3"><InvoiceStatusBadge status={invoice.status} /></td>
          <td className="max-w-[220px] px-3.5 py-3 text-slate-600"><DateTimeValue value={invoice.reviewed_at} stacked={stackDateTime} />{invoice.rejection_reason && <p className="mt-0.5 truncate text-[11px] text-red-600" title={invoice.rejection_reason}>{invoice.rejection_reason}</p>}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
