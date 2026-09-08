import { useState } from "react";

const FIELDS = [["clientId", "Client ID"], ["projectId", "Project ID"], ["skillId", "Skill ID"], ["status", "Project status"]];
export default function DashboardFilters({ onApply }) {
  const [values, setValues] = useState({ clientId: "", projectId: "", skillId: "", status: "", startDate: "", endDate: "" });
  function apply(event) { event.preventDefault(); onApply(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""))); }
  return <form onSubmit={apply} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{FIELDS.map(([key, label]) => <label key={key} className="text-xs text-muted">{label}<input value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-text" /></label>)}<label className="text-xs text-muted">Start date<input type="date" value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-text" /></label><label className="text-xs text-muted">End date<input type="date" value={values.endDate} onChange={(event) => setValues({ ...values, endDate: event.target.value })} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-text" /></label><button className="self-end rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Apply filters</button></form>;
}
