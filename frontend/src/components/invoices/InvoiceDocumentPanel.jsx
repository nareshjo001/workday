import { getSkillTheme } from "../../utils/skillTheme";
import { formatCurrency, formatDateTime, InvoiceStatusBadge } from "./format";

function Icon({ children, className = "h-4 w-4" }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function InvoiceIcon() { return <Icon className="h-5 w-5"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6" /></Icon>; }
function PrintIcon() { return <Icon><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></Icon>; }
function DownloadIcon() { return <Icon><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></Icon>; }
function RejectedIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></Icon>; }
function PaymentIcon() { return <Icon><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Icon>; }

function SkillBadge({ skill }) {
  if (!skill) return <span className="text-slate-500">—</span>;
  const theme = getSkillTheme(skill);
  return <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.dot }} aria-hidden="true" />{skill}</span>;
}

export default function InvoiceDocumentPanel({ invoice, onDownload, onPrint, onRecordPayment, onApprove, onReject }) {
  if (!invoice) return null;
  const isApproved = invoice.status === "APPROVED" || invoice.status === "AUTO_APPROVED";
  const isRejected = invoice.status === "REJECTED";
  const canReview = invoice.status === "SUBMITTED" && onApprove && onReject;

  return <section data-testid="selected-invoice" aria-labelledby="selected-invoice-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600" aria-hidden="true"><InvoiceIcon /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Selected invoice</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2 id="selected-invoice-heading" className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{invoice.invoice_number || `Draft #${invoice.id}`}</h2>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm"><span className="font-medium text-slate-800">{invoice.project_name || "Project unavailable"}</span><span className="text-slate-400"> · </span><span className="text-slate-500">Generated {formatDateTime(invoice.generated_at)}</span>{invoice.reviewed_at && <><span className="text-slate-400"> · </span><span className="text-slate-500">Reviewed {formatDateTime(invoice.reviewed_at)}</span></>}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" onClick={onPrint}><PrintIcon />Print</button>
        {invoice.pdf_storage_key && <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" onClick={onDownload}><DownloadIcon />Download PDF</button>}
      </div>
    </div>

    {isRejected && invoice.rejection_reason && <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-700 sm:mx-5"><RejectedIcon /><p><span className="font-semibold">Rejection reason:</span> {invoice.rejection_reason}</p></div>}

    <div className="p-4 sm:px-5">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600"><tr><th className="px-3.5 py-2.5">Contributor</th><th className="px-3.5 py-2.5">Skill</th><th className="px-3.5 py-2.5">Hours</th><th className="px-3.5 py-2.5">Rate</th><th className="px-3.5 py-2.5 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-200">{invoice.items?.map((item) => <tr key={item.id} className="transition hover:bg-slate-50/40"><td className="px-3.5 py-2.5 font-medium text-slate-900">{item.contractor_name_snapshot}</td><td className="px-3.5 py-2.5 text-slate-600"><SkillBadge skill={item.skill_name_snapshot} /></td><td className="px-3.5 py-2.5 tabular-nums text-slate-600">{item.approved_hours}</td><td className="px-3.5 py-2.5 tabular-nums text-slate-600">{formatCurrency(item.bill_rate)}</td><td className="px-3.5 py-2.5 text-right font-medium tabular-nums text-slate-900">{formatCurrency(item.amount)}</td></tr>)}</tbody>
        </table>
        {!invoice.items?.length && <p className="border-t border-slate-200 p-4 text-center text-xs text-slate-500">No invoice line items.</p>}
      </div>

      <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-xs sm:text-sm">
        <div className="flex justify-between gap-4 text-slate-600"><dt>Subtotal</dt><dd className="font-medium tabular-nums text-slate-900">{formatCurrency(invoice.subtotal_amount ?? invoice.amount)}</dd></div>
        <div className="flex justify-between gap-4 text-slate-600"><dt>Tax ({invoice.tax_rate ?? 0}%)</dt><dd className="font-medium tabular-nums text-slate-900">{formatCurrency(invoice.tax_amount)}</dd></div>
        <div className="flex justify-between gap-4 text-slate-600"><dt>Adjustment</dt><dd className="font-medium tabular-nums text-slate-900">{formatCurrency(invoice.adjustment_amount)}</dd></div>
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 sm:text-base"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(invoice.total_amount ?? invoice.amount)}</dd></div>
      </dl>

      {isApproved && <section aria-label="Settlement details" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><PaymentIcon /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">Settlement</h3><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{invoice.payment_state || "UNPAID"}</span>{invoice.overdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Overdue</span>}</div><p className="mt-0.5 text-xs text-slate-600">Due {invoice.due_date || "—"}</p></div></div>{onRecordPayment && invoice.payment_state !== "PAID" && Number(invoice.outstanding_amount ?? 0) > 0 && <button type="button" className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white" onClick={onRecordPayment}>Record payment</button>}</div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg border border-emerald-200/60 bg-white p-2.5"><dt className="font-medium text-slate-500">Paid</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatCurrency(invoice.paid_amount)}</dd></div><div className="rounded-lg border border-emerald-200/60 bg-white p-2.5"><dt className="font-medium text-slate-500">Outstanding</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatCurrency(invoice.outstanding_amount)}</dd></div></dl></section>}
    </div>

    {canReview && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/40 px-4 py-3 sm:px-5"><button type="button" className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200" onClick={(event) => onReject(invoice.id, event.currentTarget)}>Reject</button><button type="button" className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200" onClick={() => onApprove(invoice.id)}>Approve</button></div>}
  </section>;
}
