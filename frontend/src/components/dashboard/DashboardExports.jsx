import { useState } from "react";
import apiClient from "../../services/apiClient";

const DATASETS = [
  ["assignments", "Assignments"], ["approved-timesheets", "Approved timesheets"],
  ["invoices", "Invoices"], ["invoice-items", "Invoice items"],
  ["payments", "Payments"], ["project-financials", "Project financials"],
];

export default function DashboardExports({ role, filters = {} }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  async function download(dataset) {
    if (loading) return;
    setLoading(dataset); setError(null);
    try {
      const response = await apiClient.get(`/${role}/dashboard/exports/${dataset}`, { params: filters, responseType: "blob" });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `workday-${dataset}.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message || "The export could not be created."); }
    finally { setLoading(null); }
  }
  return <div className="flex flex-col gap-2"><div className="flex flex-wrap gap-2">{DATASETS.map(([id, label]) => <button type="button" key={id} disabled={Boolean(loading)} onClick={() => download(id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-muted disabled:opacity-60">{loading === id ? "Preparing…" : `Export ${label}`}</button>)}</div>{error && <p className="text-xs text-error">{error}</p>}</div>;
}
