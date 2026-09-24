import { useState } from "react";

const FIELDS = [["clientId", "Client ID"], ["projectId", "Project ID"], ["skillId", "Skill ID"], ["status", "Project status"]];
export default function DashboardFilters({ onApply }) {
  const [values, setValues] = useState({ clientId: "", projectId: "", skillId: "", status: "", startDate: "", endDate: "" });
  function apply(event) { event.preventDefault(); onApply(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""))); }
  const controlClass = "mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text shadow-sm";

  return (
    <form onSubmit={apply} className="pm-filter-toolbar">
      {FIELDS.map(([key, label]) => (
        <label key={key} className="dashboard-filter-field">
          <span>{label}</span>
          <input value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} className={controlClass} />
        </label>
      ))}
      <label className="dashboard-filter-field">
        <span>Start date</span>
        <input type="date" value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} className={controlClass} />
      </label>
      <label className="dashboard-filter-field">
        <span>End date</span>
        <input type="date" value={values.endDate} onChange={(event) => setValues({ ...values, endDate: event.target.value })} className={controlClass} />
      </label>
      <div className="pm-filter-actions">
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-panel transition hover:bg-primary-hover">
          Apply filters
        </button>
      </div>
    </form>
  );
}
