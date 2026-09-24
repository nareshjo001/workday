import { formatDateTime, formatCurrency, InvoiceStatusBadge } from "./format";

export default function InvoiceCardList({ invoices, selectedId, onSelect }) {
  return <div className="mt-4 flex flex-col gap-2 md:hidden">{invoices.map((invoice) => {
    const isSelected = selectedId === invoice.id;
    return <button key={invoice.id} type="button" aria-current={isSelected ? "true" : undefined} onClick={() => onSelect?.(invoice)} className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isSelected ? "border-blue-300 bg-blue-50/70 shadow-xs" : "border-slate-200 bg-white hover:bg-slate-50/60"}`}>
      <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-blue-700">{invoice.invoice_number || `Draft #${invoice.id}`}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{invoice.project_name || "Project unavailable"}</span></span><InvoiceStatusBadge status={invoice.status} /></span>
      <span className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-xs"><span className="font-semibold tabular-nums text-slate-900">{formatCurrency(invoice.total_amount ?? invoice.amount)}</span><span className="text-right text-slate-500">{formatDateTime(invoice.generated_at)}</span></span>
      {invoice.rejection_reason && <span className="mt-2 block truncate text-xs text-red-600">{invoice.rejection_reason}</span>}
    </button>;
  })}</div>;
}
