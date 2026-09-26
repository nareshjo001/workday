import { useCallback, useEffect, useRef, useState } from "react";
import AlertBanner from "../components/AlertBanner";
import ListControls from "../components/ListControls";
import EditTaxModal from "../components/invoices/EditTaxModal";
import PaymentRecordModal from "../components/invoices/PaymentRecordModal";
import { formatCurrency, formatDateTime } from "../components/invoices/format";
import Spinner from "../components/Spinner";
import DashboardLayout from "../layouts/DashboardLayout";
import vendorInvoiceService from "../services/vendorInvoiceService";
import { getSkillTheme } from "../utils/skillTheme";

function formatGeneratedTimestamp(value) {
  if (!value) return { date: "—", time: null };
  const str = String(value).trim();
  const parts = str.split(/[T ]/);
  const datePart = parts[0];
  const timePart = parts[1];

  let dateText = datePart;
  if (datePart && datePart.includes("-")) {
    const [year, month, day] = datePart.split("-");
    if (year && month && day) {
      const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (!Number.isNaN(d.getTime())) {
        const monthName = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        dateText = `${monthName} ${Number(day)} ${Number(year)}`;
      }
    }
  }

  let timeText = null;
  if (timePart) {
    const [hStr, mStr] = timePart.split(":");
    const hour = Number(hStr);
    if (Number.isFinite(hour) && mStr !== undefined) {
      const period = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      timeText = `${hour12}:${mStr} ${period}`;
    }
  }

  return { date: dateText, time: timeText };
}

function Icon({ children, className = "h-5 w-5" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function BillingIcon({ className = "h-5 w-5" }) {
  return (
    <Icon className={className}>
      <path d="M4 7h16M7 3v4M17 3v4M6 11h4M6 15h7M6 19h5" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </Icon>
  );
}

function InvoiceIcon({ className = "h-5 w-5" }) {
  return (
    <Icon className={className}>
      <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6" />
    </Icon>
  );
}

function HistoryIcon({ className = "h-5 w-5" }) {
  return (
    <Icon className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </Icon>
  );
}

function ApprovedIcon({ className = "h-5 w-5" }) {
  return (
    <Icon className={className}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

function PendingIcon({ className = "h-5 w-5" }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  );
}

function RejectedIcon({ className = "h-5 w-5" }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </Icon>
  );
}

function PrintIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
    </Icon>
  );
}

function EditIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10zM14 7l3 3" />
    </Icon>
  );
}

function SendIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />
    </Icon>
  );
}

function DownloadIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </Icon>
  );
}

function PaymentIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </Icon>
  );
}

const statusTheme = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-blue-200 bg-blue-50 text-blue-700",
  PENDING_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  AUTO_APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
};

function StatusBadge({ status }) {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  const theme = statusTheme[normalized] || statusTheme.DRAFT;
  const label = normalized.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex h-6 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none ${theme}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function OperationalSummary({ queue, invoices }) {
  const queueAmount = queue.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const queueHours = queue.reduce((sum, item) => sum + (Number(item.approved_hours) || 0), 0);

  const approvedInvoices = invoices.filter(
    (i) => i.status === "APPROVED" || i.status === "AUTO_APPROVED"
  );
  const approvedTotal = approvedInvoices.reduce(
    (sum, i) => sum + (Number(i.total_amount ?? i.amount) || 0),
    0
  );

  const pendingInvoices = invoices.filter(
    (i) => i.status === "SUBMITTED" || i.status === "PENDING_REVIEW"
  );
  const pendingTotal = pendingInvoices.reduce(
    (sum, i) => sum + (Number(i.total_amount ?? i.amount) || 0),
    0
  );

  const rejectedInvoices = invoices.filter((i) => i.status === "REJECTED");

  return (
    <section
      aria-label="Operational Summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3.5"
    >
      <div className="flex min-h-[78px] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:gap-3.5 sm:p-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
          aria-hidden="true"
        >
          <BillingIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-600">Eligible billing</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{queue.length}</p>
          <p className="truncate text-xs font-medium text-slate-500">
            {queue.length > 0 ? `${formatCurrency(queueAmount)} · ${queueHours}h` : "No pending work"}
          </p>
        </div>
      </div>

      <div className="flex min-h-[78px] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:gap-3.5 sm:p-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
          aria-hidden="true"
        >
          <ApprovedIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-600">Approved</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{approvedInvoices.length}</p>
          <p className="truncate text-xs font-medium text-slate-500">
            {approvedInvoices.length > 0 ? `${formatCurrency(approvedTotal)} total` : "No approved invoices"}
          </p>
        </div>
      </div>

      <div className="flex min-h-[78px] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:gap-3.5 sm:p-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"
          aria-hidden="true"
        >
          <PendingIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-600">Pending review</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{pendingInvoices.length}</p>
          <p className="truncate text-xs font-medium text-slate-500">
            {pendingInvoices.length > 0 ? `${formatCurrency(pendingTotal)} awaiting PM` : "None in review"}
          </p>
        </div>
      </div>

      <div className="flex min-h-[78px] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:gap-3.5 sm:p-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600"
          aria-hidden="true"
        >
          <RejectedIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-600">Rejected</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{rejectedInvoices.length}</p>
          <p className="truncate text-xs font-medium text-slate-500">
            {rejectedInvoices.length > 0 ? "Requires attention" : "Zero rejected"}
          </p>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ icon, title, description, id }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p>
      </div>
    </div>
  );
}

function BillingQueue({ items, onCreateDraft }) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="eligible-billing-heading"
    >
      <SectionHeading
        id="eligible-billing-heading"
        icon={<BillingIcon />}
        title="Eligible billing"
        description="Approved billable work that can be added to a draft invoice."
      />
      {items.length ? (
        <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/30">
          {items.map((item) => (
            <article
              key={item.milestone_billing_id}
              className="grid gap-3 bg-white p-3.5 sm:grid-cols-[minmax(0,1fr)_120px_160px_auto] sm:items-center sm:gap-4 transition hover:bg-slate-50/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {item.milestone_name || "Approved milestone contribution"}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {[item.contractor_name, item.skill_name].filter(Boolean).join(" · ") ||
                    "Eligible billing item"}
                </p>
              </div>
              <dl>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Eligible hours
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  {item.approved_hours}h
                </dd>
              </dl>
              <dl>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Billable amount
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {formatCurrency(item.amount)}{" "}
                  <span className="text-xs font-normal text-slate-500">{item.currency}</span>
                </dd>
              </dl>
              <button
                type="button"
                onClick={() => onCreateDraft(item.milestone_billing_id)}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Create draft
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
          No approved billable work is currently eligible for a draft.
        </p>
      )}
    </section>
  );
}

function SkillBadge({ skill }) {
  if (!skill) return <span className="text-slate-500">—</span>;
  const theme = getSkillTheme(skill);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        border: `1px solid ${theme.border}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: theme.dot }}
        aria-hidden="true"
      />
      {skill}
    </span>
  );
}

function SelectedInvoice({
  invoice,
  onEdit,
  onSubmit,
  onPrint,
  onDownload,
  onRecordPayment,
  cardRef,
  isEmphasized,
}) {
  const isDraft = invoice.status === "DRAFT";
  const isApproved = invoice.status === "APPROVED" || invoice.status === "AUTO_APPROVED";
  const isRejected = invoice.status === "REJECTED";
  const canRecordPayment = Boolean(
    onRecordPayment &&
    isApproved &&
    invoice.payment_state !== "PAID" &&
    Number(invoice.outstanding_amount ?? 0) > 0
  );

  return (
    <section
      ref={cardRef}
      data-testid="selected-invoice"
      className={`scroll-mt-24 sm:scroll-mt-28 rounded-2xl border transition-all duration-700 bg-white shadow-sm overflow-hidden ${
        isEmphasized
          ? "border-blue-400 ring-2 ring-blue-100 bg-blue-50/20"
          : "border-slate-200"
      }`}
      aria-labelledby="selected-invoice-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"
            aria-hidden="true"
          >
            <InvoiceIcon />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Selected invoice
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2
                id="selected-invoice-heading"
                className="text-base font-bold text-slate-900 tracking-tight sm:text-lg"
              >
                {invoice.invoice_number || `Draft #${invoice.id}`}
              </h2>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-600 sm:text-sm">
              <span className="font-medium text-slate-800">
                {invoice.project_name || "Project unavailable"}
              </span>
              <span className="text-slate-400"> · </span>
              <span className="text-slate-500">
                Generated {formatDateTime(invoice.generated_at)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <PrintIcon />
            Print
          </button>
          {invoice.pdf_storage_key && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <DownloadIcon />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {isRejected && invoice.rejection_reason && (
        <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-700 sm:mx-5">
          <RejectedIcon className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <span className="font-semibold">Rejection reason:</span> {invoice.rejection_reason}
          </div>
        </div>
      )}

      <div className="p-4 sm:px-5">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">Contributor</th>
                <th className="px-3.5 py-2.5">Skill</th>
                <th className="px-3.5 py-2.5">Hours</th>
                <th className="px-3.5 py-2.5">Rate</th>
                <th className="px-3.5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items?.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50/40">
                  <td className="px-3.5 py-2.5 font-medium text-slate-900">
                    {item.contractor_name_snapshot}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600">
                    <SkillBadge skill={item.skill_name_snapshot} />
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 tabular-nums">
                    {item.approved_hours}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 tabular-nums">
                    {formatCurrency(item.bill_rate)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-medium text-slate-900 tabular-nums">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invoice.items?.length && (
            <p className="border-t border-slate-200 p-4 text-center text-xs text-slate-500">
              No invoice line items.
            </p>
          )}
        </div>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-xs sm:text-sm">
          <div className="flex justify-between gap-4 text-slate-600">
            <dt>Subtotal</dt>
            <dd className="font-medium text-slate-900 tabular-nums">
              {formatCurrency(invoice.subtotal_amount ?? invoice.amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-slate-600">
            <dt>Tax ({invoice.tax_rate ?? 0}%)</dt>
            <dd className="font-medium text-slate-900 tabular-nums">
              {formatCurrency(invoice.tax_amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-slate-600">
            <dt>Adjustment</dt>
            <dd className="font-medium text-slate-900 tabular-nums">
              {formatCurrency(invoice.adjustment_amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-900">
            <dt>Total</dt>
            <dd className="tabular-nums">
              {formatCurrency(invoice.total_amount ?? invoice.amount)}
            </dd>
          </div>
        </dl>

        {isApproved && (
          <section
            aria-label="Settlement details"
            className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <PaymentIcon className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Settlement</h3>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      {invoice.payment_state || "UNPAID"}
                    </span>
                    {invoice.overdue && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Due {invoice.due_date || "—"}
                  </p>
                </div>
              </div>
              {canRecordPayment && (
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  onClick={onRecordPayment}
                >
                  <PaymentIcon className="h-3.5 w-3.5" />
                  Record payment
                </button>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-emerald-200/60 bg-white p-2.5">
                <dt className="text-slate-500 font-medium">Paid</dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
                  {formatCurrency(invoice.paid_amount)}
                </dd>
              </div>
              <div className="rounded-lg border border-emerald-200/60 bg-white p-2.5">
                <dt className="text-slate-500 font-medium">Outstanding</dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
                  {formatCurrency(invoice.outstanding_amount)}
                </dd>
              </div>
            </dl>

            {invoice.payments?.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-emerald-100 bg-white">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="border-b border-emerald-100 bg-emerald-50/50 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-3 py-2 text-slate-700">{payment.paid_at}</td>
                        <td className="px-3 py-2 text-slate-600">{payment.method || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{payment.reference || "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900 tabular-nums">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {isDraft && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/40 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <EditIcon />
            Edit tax and adjustment
          </button>
          <button
            data-testid={`submit-invoice-${invoice.id}`}
            type="button"
            onClick={onSubmit}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <SendIcon />
            Submit invoice
          </button>
        </div>
      )}
    </section>
  );
}

function EmptySelectedInvoice({ cardRef }) {
  return (
    <section
      ref={cardRef}
      data-testid="selected-invoice-empty"
      aria-labelledby="empty-invoice-heading"
      className="scroll-mt-24 sm:scroll-mt-28 flex min-h-[190px] sm:min-h-[220px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm"
    >
      <div
        className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100/70 shadow-xs mb-3"
        aria-hidden="true"
      >
        <svg
          className="h-5 w-5 sm:h-6 sm:w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      </div>
      <h2
        id="empty-invoice-heading"
        className="text-base sm:text-lg font-bold text-slate-900 tracking-tight"
      >
        Select an invoice
      </h2>
      <p className="mt-1 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
        Choose an invoice from the history below to view its details, totals,
        actions, and payment information.
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-500">
        <span>Select a row below</span>
        <svg
          className="h-3 w-3 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

function InvoiceHistory({
  invoices,
  selectedId,
  onSelect,
  page,
  pageInfo,
  onPrevious,
  onNext,
}) {
  return (
    <section
      data-testid="invoice-history"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="invoice-history-heading"
    >
      <SectionHeading
        id="invoice-history-heading"
        icon={<HistoryIcon />}
        title="Invoices"
        description="Track draft, submitted, approved, and rejected invoices."
      />

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              {["Invoice", "Project", "Amount", "Generated", "Status", "Reviewed"].map((heading) => (
                <th key={heading} className="px-3.5 py-2.5">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoices.map((invoice) => {
              const isSelected = selectedId === invoice.id;
              return (
                <tr
                  key={invoice.id}
                  onClick={() => onSelect(invoice)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(invoice);
                    }
                  }}
                  className={`cursor-pointer transition ${
                    isSelected
                      ? "bg-blue-50/60 border-l-2 border-l-blue-500 font-medium"
                      : "hover:bg-slate-50/60 border-l-2 border-l-transparent"
                  }`}
                >
                  <td className="px-3.5 py-3 text-left">
                    <button
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(invoice);
                      }}
                      className="block w-full text-left font-semibold text-blue-700 hover:text-blue-800 text-xs focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      {invoice.invoice_number || `Draft #${invoice.id}`}
                    </button>
                  </td>
                  <td
                    className="max-w-[220px] truncate px-3.5 py-3 text-slate-700"
                    title={invoice.project_name}
                  >
                    {invoice.project_name || "—"}
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-900 tabular-nums">
                    {formatCurrency(invoice.total_amount ?? invoice.amount)}
                  </td>
                  <td className="px-3.5 py-3 text-left">
                    {(() => {
                      const { date, time } = formatGeneratedTimestamp(invoice.generated_at);
                      return (
                        <div className="flex flex-col items-start leading-tight">
                          <span className="whitespace-nowrap font-medium text-slate-800 text-xs">
                            {date}
                          </span>
                          {time && (
                            <span className="whitespace-nowrap text-[11px] text-slate-500 mt-0.5">
                              {time}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3.5 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="max-w-[220px] px-3.5 py-3 text-slate-600">
                    <span>{invoice.reviewed_at ? formatDateTime(invoice.reviewed_at) : "—"}</span>
                    {invoice.rejection_reason && (
                      <p
                        className="mt-0.5 truncate text-[11px] text-red-600"
                        title={invoice.rejection_reason}
                      >
                        {invoice.rejection_reason}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 md:hidden">
        {invoices.map((invoice) => {
          const isSelected = selectedId === invoice.id;
          return (
            <button
              key={invoice.id}
              type="button"
              aria-current={isSelected ? "true" : undefined}
              onClick={() => onSelect(invoice)}
              className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                isSelected
                  ? "border-blue-300 bg-blue-50/70 shadow-xs"
                  : "border-slate-200 bg-white hover:bg-slate-50/60"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-blue-700">
                    {invoice.invoice_number || `Draft #${invoice.id}`}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {invoice.project_name || "Project unavailable"}
                  </span>
                </span>
                <StatusBadge status={invoice.status} />
              </span>
              <span className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-xs">
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(invoice.total_amount ?? invoice.amount)}
                </span>
                <span className="text-slate-500">
                  {formatDateTime(invoice.generated_at)}
                </span>
              </span>
              {invoice.rejection_reason && (
                <span className="mt-2 block truncate text-xs text-red-600">
                  {invoice.rejection_reason}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ListControls
        page={page}
        totalPages={pageInfo.total_pages}
        total={pageInfo.total}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  );
}

export default function VendorInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const [queue, setQueue] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [editTermsTarget, setEditTermsTarget] = useState(null);
  const selectedCardRef = useRef(null);
  const [highlightInvoiceId, setHighlightInvoiceId] = useState(null);
  const pendingScrollIdRef = useRef(null);

  const handleSelectInvoice = useCallback((invoice) => {
    if (!invoice) return;
    if (invoice.id !== selectedInvoice?.id) {
      pendingScrollIdRef.current = invoice.id;
      setSelectedInvoice(invoice);
    } else {
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      requestAnimationFrame(() => {
        if (selectedCardRef.current && typeof selectedCardRef.current.scrollIntoView === "function") {
          selectedCardRef.current.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
          });
        }
      });
    }
  }, [selectedInvoice?.id]);

  useEffect(() => {
    if (pendingScrollIdRef.current && selectedInvoice?.id === pendingScrollIdRef.current) {
      pendingScrollIdRef.current = null;
      setHighlightInvoiceId(selectedInvoice.id);
      const timer = setTimeout(() => {
        setHighlightInvoiceId(null);
      }, 700);

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      requestAnimationFrame(() => {
        if (selectedCardRef.current && typeof selectedCardRef.current.scrollIntoView === "function") {
          selectedCardRef.current.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
          });
        }
      });

      return () => clearTimeout(timer);
    }
  }, [selectedInvoice?.id]);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorInvoiceService.listInvoices({
        page,
        pageSize: 10,
        sort: "generated_at",
        order: "desc",
      });
      setInvoices(data.items);
      setSelectedInvoice((current) => {
        if (!current) return null;
        return data.items.find((invoice) => invoice.id === current.id) || current;
      });
      setPageInfo(data);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadInvoices();
    vendorInvoiceService.billingQueue().then(setQueue).catch(() => {});
  }, [loadInvoices]);

  const createDraft = async (billingId) => {
    try {
      const draft = await vendorInvoiceService.createDraft(billingId);
      pendingScrollIdRef.current = draft.id;
      setSelectedInvoice(draft);
      setSuccessMessage(`Draft #${draft.id} created.`);
      setQueue((items) => items.filter((item) => item.milestone_billing_id !== billingId));
      await loadInvoices();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const submitDraft = async () => {
    if (selectedInvoice?.status !== "DRAFT") return;
    try {
      const updated = await vendorInvoiceService.submitDraft(selectedInvoice.id);
      setSelectedInvoice(updated);
      setInvoices((items) =>
        items.map((invoice) => (invoice.id === updated.id ? updated : invoice))
      );
      setSuccessMessage("Invoice submitted for client review.");
    } catch (error) {
      setActionError(error.message);
    }
  };

  const download = async () => {
    if (!selectedInvoice?.pdf_storage_key) return;
    try {
      const url = await vendorInvoiceService.downloadPdf(selectedInvoice.id);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setActionError(error.message);
    }
  };

  const editDraftTerms = () => {
    if (selectedInvoice?.status !== "DRAFT") return;
    setEditTermsTarget(selectedInvoice);
  };

  const handleSaveTerms = async ({ taxRate, adjustments }) => {
    try {
      const updated = await vendorInvoiceService.updateDraft(selectedInvoice.id, {
        tax_rate: taxRate,
        adjustments,
      });
      setSelectedInvoice(updated);
      setInvoices((items) =>
        items.map((invoice) => (invoice.id === updated.id ? updated : invoice))
      );
      setEditTermsTarget(null);
      setSuccessMessage("Draft totals updated.");
    } catch (error) {
      setActionError(error.message);
      throw error;
    }
  };

  const recordPayment = async (payload) => {
    const result = await vendorInvoiceService.recordPayment(paymentTarget.id, payload);
    const updated = {
      ...paymentTarget,
      paid_amount: result.paid_amount,
      outstanding_amount: result.outstanding_amount,
      payment_state: result.payment_state,
      overdue: result.overdue,
      payments: result.payments,
    };
    setSelectedInvoice(updated);
    setInvoices((items) =>
      items.map((invoice) => (invoice.id === updated.id ? updated : invoice))
    );
    setPaymentTarget(null);
    setSuccessMessage("Payment recorded.");
  };

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  return (
    <DashboardLayout title="Invoices">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Build drafts from eligible milestone billings, submit them, then track client review.
          </p>
        </header>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        <OperationalSummary queue={queue} invoices={invoices} />

        <BillingQueue items={queue} onCreateDraft={createDraft} />

        {!isLoading && invoices.length > 0 && (
          selectedInvoice ? (
            <SelectedInvoice
              cardRef={selectedCardRef}
              isEmphasized={highlightInvoiceId === selectedInvoice.id}
              invoice={selectedInvoice}
              onEdit={editDraftTerms}
              onSubmit={submitDraft}
              onPrint={() => window.print()}
              onDownload={download}
              onRecordPayment={
                (selectedInvoice.status === "APPROVED" || selectedInvoice.status === "AUTO_APPROVED") &&
                selectedInvoice.payment_state !== "PAID" &&
                Number(selectedInvoice.outstanding_amount ?? 0) > 0
                  ? () => setPaymentTarget(selectedInvoice)
                  : undefined
              }
            />
          ) : (
            <EmptySelectedInvoice cardRef={selectedCardRef} />
          )
        )}

        {isLoading ? (
          <Spinner label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <h2 className="text-base font-semibold text-slate-900">Invoices</h2>
            <p className="mt-1 text-sm text-slate-500">
              No invoices yet. Select eligible billing above to create a draft.
            </p>
          </section>
        ) : (
          <InvoiceHistory
            invoices={invoices}
            selectedId={selectedInvoice?.id}
            onSelect={handleSelectInvoice}
            page={page}
            pageInfo={pageInfo}
            onPrevious={() => setPage((value) => value - 1)}
            onNext={() => setPage((value) => value + 1)}
          />
        )}
      </main>
      {editTermsTarget && (
        <EditTaxModal
          invoice={editTermsTarget}
          onClose={() => setEditTermsTarget(null)}
          onSave={handleSaveTerms}
        />
      )}
      {paymentTarget && (
        <PaymentRecordModal
          invoice={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSave={recordPayment}
        />
      )}
    </DashboardLayout>
  );
}
