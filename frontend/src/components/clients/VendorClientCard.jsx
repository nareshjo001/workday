import { useState } from "react";
import { getInitials } from "../contractors/format";
import { resolveProjectStatusTheme } from "../../utils/projectStatusTheme";

const RECENT_PROJECT_PREVIEW_LIMIT = 2;

export default function VendorClientCard({ client, onViewDetail }) {
  const [showAllProjects, setShowAllProjects] = useState(false);
  const initials = getInitials(client.name);
  const recentProjects = client.recent_projects || [];
  const previewProjects = recentProjects.slice(0, RECENT_PROJECT_PREVIEW_LIMIT);
  const additionalProjects = recentProjects.slice(RECENT_PROJECT_PREVIEW_LIMIT);
  const clientStatus = client.status || "Active";

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm sm:p-6" data-testid={`client-card-${client.id}`}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100/80 bg-blue-50 sm:h-11 sm:w-11" data-testid="client-avatar">
            <span className="text-xs font-semibold text-blue-700 sm:text-sm">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">{client.name}</h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-xs" data-testid="client-pm-contacts">PM contacts: {client.pm_contacts || "—"}</p>
          </div>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:gap-1.5 sm:px-2.5 sm:text-xs" data-testid="client-status-badge">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {clientStatus}
        </span>
      </div>

      <div className="my-4 grid grid-cols-3 gap-2 pt-1" data-testid="client-metrics-grid">
        <Metric icon={<BriefcaseIcon />} value={client.active_projects ?? 0} label="Active projects" />
        <Metric icon={<ClipboardIcon />} value={client.open_requirements ?? 0} label="Open requirements" />
        <Metric icon={<UsersIcon />} value={client.deployed_contractors ?? 0} label="Deployed contractors" />
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <FolderIcon className="h-3.5 w-3.5 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-700">Recent projects</h3>
        </div>
        <div className={showAllProjects ? "" : "min-h-[90px]"} data-testid="recent-project-viewport">
          {recentProjects.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">No recent projects.</p>
          ) : (
            <div className="flex flex-col gap-1.5" data-testid="recent-project-preview">
              {previewProjects.map((project) => <RecentProjectRow key={project.id || project.name} project={project} />)}
            </div>
          )}
          {additionalProjects.length > 0 && (
            <div id={`recent-projects-extra-${client.id}`} className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-[250ms] ease-in-out ${showAllProjects ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!showAllProjects} data-testid="recent-project-extra">
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-col gap-1.5 pt-1.5">
                  {additionalProjects.map((project) => <RecentProjectRow key={project.id || project.name} project={project} />)}
                </div>
              </div>
            </div>
          )}
        </div>
        {additionalProjects.length > 0 && (
          <div className="h-10" data-testid="recent-project-control-slot">
            <button type="button" onClick={() => setShowAllProjects((current) => !current)} aria-expanded={showAllProjects} aria-controls={`recent-projects-extra-${client.id}`} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" data-testid="toggle-recent-projects">
              <span>{showAllProjects ? "Show less" : "Show all projects"}</span>
              <ChevronIcon expanded={showAllProjects} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <button type="button" onClick={() => onViewDetail(client)} className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" data-testid="view-client-detail-button">
          <span>View client detail</span>
          <ArrowRightIcon />
        </button>
      </div>
    </article>
  );
}

function Metric({ icon, value, label }) {
  return <div className="min-w-0"><div className="flex items-center gap-1.5 text-blue-500">{icon}<span className="text-sm font-bold leading-none text-slate-800 sm:text-base">{value}</span></div><span className="mt-1 block text-[11px] leading-tight text-slate-500 sm:text-xs">{label}</span></div>;
}

function RecentProjectRow({ project }) {
  const statusTheme = resolveProjectStatus(project);
  const displayName = project.name?.replace(/^Demo\s+/i, "") || project.name;
  const isPending = statusTheme.label.toLowerCase().includes("pending");
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100/90 bg-slate-50/70 px-3 py-2 text-xs" data-testid={`recent-project-${project.id || project.name}`}><span className="truncate font-medium text-slate-800" title={project.name}>{displayName}</span><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTheme.badgeClass}`} data-testid="project-status-badge">{isPending ? <WarningTriangleIcon /> : <span className={`h-1.5 w-1.5 rounded-full ${statusTheme.dotClass}`} aria-hidden="true" />}{statusTheme.label}</span></div>;
}

function resolveProjectStatus(project) {
  if (project.status_label) {
    const pending = project.status_label.toLowerCase().includes("pending");
    return { ...resolveProjectStatusTheme(pending ? "PENDING" : "IN_PROGRESS"), label: project.status_label };
  }
  if (project.staffing_status === "PENDING" || project.status === "PENDING") return resolveProjectStatusTheme("PENDING");
  if (project.open_requirements > 0 && (project.name?.toLowerCase().includes("modernization") || project.name?.toLowerCase().includes("pending"))) return resolveProjectStatusTheme("PENDING");
  if (project.status === "ACTIVE" || project.status === "IN_PROGRESS") return { ...resolveProjectStatusTheme("IN_PROGRESS"), label: "In Progress" };
  return resolveProjectStatusTheme(project.status || "ACTIVE");
}

function ChevronIcon({ expanded }) { return <svg className={`h-3.5 w-3.5 transition-transform duration-[250ms] ${expanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>; }
function BriefcaseIcon() { return <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>; }
function ClipboardIcon() { return <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>; }
function UsersIcon() { return <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function FolderIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>; }
function WarningTriangleIcon() { return <svg className="h-3 w-3 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>; }
function ArrowRightIcon() { return <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>; }
