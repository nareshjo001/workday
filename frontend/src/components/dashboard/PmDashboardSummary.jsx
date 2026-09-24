import ProgressBar from "./ProgressBar";

export function PmDashboardIcon({ name }) {
  const paths = {
    projects: <><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 10h18" /></>,
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    contractors: <><circle cx="9" cy="7" r="3" /><circle cx="17" cy="8" r="2" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 14a4 4 0 0 1 5 4v3" /></>,
    completed: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    staffing: <><path d="m10.3 4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v5M12 17h.01" /></>,
    progress: <><path d="m3 17 6-6 4 4 8-10M15 5h6v6" /></>,
    analytics: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    budget: <><path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><path d="M16 13h4M16 13a2 2 0 1 0 0 4h4" /><path d="M2 10h20" /></>,
    payment: <><circle cx="8" cy="12" r="4" /><circle cx="16" cy="12" r="4" /><path d="M8 10v4M6.5 12h3M16 10v4" /></>,
    outstanding: <><path d="M7 3h10M7 21h10M8 3c0 4 3 5 4 5s4 1 4 5-3 5-4 5-4 1-4 5" /><path d="M16 3c0 4-3 5-4 5s-4 1-4 5 3 5 4 5 4 1 4 5" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
    review: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h3" /><circle cx="16.5" cy="15.5" r="2.5" /><path d="m18.4 17.4 2 2" /></>,
    timesheets: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    milestones: <><path d="M5 21V3c5-3 9 3 15 0v11c-6 3-10-3-15 0" /></>,
    invoices: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function PmDashboardSummary({ summary, isLoading }) {
  const cards = [
    ["projects", "Active Projects", summary?.active_projects, "Currently active"],
    ["contractors", "Active Contractors", summary?.active_contractors, "On active projects"],
    ["completed", "Completed Projects", summary?.completed_projects, "Marked completed"],
    ["staffing", "Pending Staffing", summary?.pending_staffing_projects, "Awaiting staffing"],
    ["progress", "Project Progress", summary?.overall_progress_percent == null ? "—" : `${summary.overall_progress_percent}%`, "Across active projects"],
  ];
  return (
    <section className="pm-dashboard-kpis" aria-label="Project summary" aria-busy={isLoading}>
      {cards.map(([theme, label, value, description]) => (
        <article className={`pm-dashboard-kpi pm-dashboard-kpi--${theme}`} key={theme} aria-label={label}>
          <span className="pm-dashboard-kpi-icon"><PmDashboardIcon name={theme} /></span>
          <div className="pm-dashboard-kpi-content">
            <h2>{label}</h2>
            {isLoading ? <div className="pm-dashboard-kpi-loading" aria-label="Loading" /> : <>
              <p className="pm-dashboard-kpi-value">{value}</p>
              {theme === "progress" && summary?.overall_progress_percent != null && <ProgressBar percent={summary.overall_progress_percent} size="sm" />}
              <p className="pm-dashboard-kpi-context">{description}</p>
            </>}
          </div>
        </article>
      ))}
    </section>
  );
}
