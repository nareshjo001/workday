import { useMemo, useState } from "react";

const EMPTY_FILTERS = { clientId: "", projectId: "", status: "", startDate: "", endDate: "" };
const PROJECT_STATUSES = [
  ["ACTIVE", "Active"],
  ["ON_HOLD", "On hold"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];

function compactFilters(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
}

export default function VendorDashboardFilters({ clients = [], projects = [], optionsLoading = false, onApply }) {
  const [values, setValues] = useState(EMPTY_FILTERS);
  const visibleProjects = useMemo(
    () => projects.filter((project) => !values.clientId || String(project.clientId) === values.clientId),
    [projects, values.clientId]
  );

  function update(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "clientId" && current.projectId) {
        const selectedProject = projects.find((project) => String(project.id) === current.projectId);
        if (value && String(selectedProject?.clientId) !== value) next.projectId = "";
      }
      return next;
    });
  }

  function apply(event) {
    event.preventDefault();
    onApply(compactFilters(values));
  }

  function clear() {
    setValues(EMPTY_FILTERS);
    onApply({});
  }

  const controlClass = "mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text shadow-sm";
  return (
    <form onSubmit={apply} className="vendor-filter-toolbar" aria-busy={optionsLoading}>
      <label className="vendor-filter-field">
        <span>Client</span>
        <select aria-label="Client" value={values.clientId} disabled={optionsLoading} onChange={(event) => update("clientId", event.target.value)} className={controlClass}>
          <option value="">All clients</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </label>
      <label className="vendor-filter-field">
        <span>Project</span>
        <select aria-label="Project" value={values.projectId} disabled={optionsLoading} onChange={(event) => update("projectId", event.target.value)} className={controlClass}>
          <option value="">All projects</option>
          {visibleProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label className="vendor-filter-field vendor-filter-status">
        <span>Status</span>
        <select aria-label="Project status" value={values.status} onChange={(event) => update("status", event.target.value)} className={controlClass}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="vendor-filter-field vendor-filter-date">
        <span>Start date</span>
        <input aria-label="Start date" type="date" value={values.startDate} onChange={(event) => update("startDate", event.target.value)} className={controlClass} />
      </label>
      <label className="vendor-filter-field vendor-filter-date">
        <span>End date</span>
        <input aria-label="End date" type="date" value={values.endDate} onChange={(event) => update("endDate", event.target.value)} className={controlClass} />
      </label>
      <div className="vendor-filter-actions">
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-panel transition hover:bg-primary-hover">Apply filters</button>
        <button type="button" onClick={clear} className="rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted">Clear filters</button>
      </div>
    </form>
  );
}
