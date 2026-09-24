import { useEffect, useRef, useState } from "react";
import ProgressBar from "./ProgressBar";
import { formatDate, formatHours } from "./format";
import { resolveProjectStatusTheme } from "../../utils/projectStatusTheme";
import "./PmProjectPreview.css";

const actions = [
  ["Settings", "settings"],
  ["Requirements", "requirements"],
  ["Project Control", "control"],
  ["Activity", "activity"],
];

export default function PmProjectPreview({ projects = [], onSettings, onRequirements, onControl, onActivity }) {
  const [openProjectId, setOpenProjectId] = useState(null);
  return (
    <div className="pm-project-preview-grid" data-testid="pm-project-preview-grid">
      {projects.map((project) => <ProjectCard key={project.id} project={project} isMenuOpen={openProjectId === project.id} onMenuChange={(open) => setOpenProjectId(open ? project.id : null)} onSettings={onSettings} onRequirements={onRequirements} onControl={onControl} onActivity={onActivity} />)}
    </div>
  );
}

function ProjectCard({ project, isMenuOpen, onMenuChange, onSettings, onRequirements, onControl, onActivity }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const status = resolveProjectStatusTheme(project.status);
  const hasHours = project.expected_hours !== null && project.expected_hours !== undefined;
  const hasStaffingCounts = project.total_assigned !== undefined && project.total_required !== undefined;

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        onMenuChange(false);
        triggerRef.current?.focus();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onMenuChange(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen, onMenuChange]);

  const selectAction = (action) => {
    onMenuChange(false);
    const handler = { settings: onSettings, requirements: onRequirements, control: onControl, activity: onActivity }[action];
    handler?.(project, triggerRef.current);
  };

  return (
    <article className="pm-project-preview-card" aria-label={project.name} data-testid="pm-project-card">
      <header className="pm-project-preview-card-header">
        <span className="pm-project-preview-icon" aria-hidden="true"><ProjectBuildingIcon /></span>
        <div className="pm-project-preview-heading">
          <h3 title={project.name}>{project.name}</h3>
          {project.company_name && <p title={project.company_name}>{project.company_name}</p>}
        </div>
        <span className={`pm-project-status-pill ${status.badgeClass}`}><i className={status.dotClass} aria-hidden="true" />{status.label}</span>
        <div className="pm-project-menu-wrap">
          <button
            ref={triggerRef}
            type="button"
            className="pm-project-menu-trigger"
            aria-label={`Project actions for ${project.name}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => onMenuChange(!isMenuOpen)}
          ><EllipsisIcon /></button>
          {isMenuOpen && (
            <div ref={menuRef} className="pm-project-menu" role="menu" aria-label={`${project.name} actions`}>
              {actions.map(([label, action]) => {
                const handler = { settings: onSettings, requirements: onRequirements, control: onControl, activity: onActivity }[action];
                return <button key={action} type="button" role="menuitem" disabled={!handler} onClick={() => selectAction(action)}>{label}</button>;
              })}
            </div>
          )}
        </div>
      </header>

      <div className="pm-project-preview-progress">
        <div className="pm-project-preview-progress-row">
          {project.work_progress_percent === null ? <span className="text-text-secondary">—</span> : <ProgressBar percent={project.work_progress_percent} size="sm" />}
          <strong>{project.work_progress_percent === null ? "—" : `${project.work_progress_percent}%`}</strong>
        </div>
        <span>Project progress</span>
      </div>

      <dl className="pm-project-preview-details">
        <div className="pm-project-preview-detail-group">
          <Detail icon={<CalendarIcon />} label="Start Date" value={formatDate(project.start_date)} />
          <Detail icon={<ClockIcon />} label="End Date" value={formatDate(project.end_date)} />
        </div>
        <div className="pm-project-preview-detail-group">
          <Detail icon={<HourglassIcon />} label="Total Hours" value={hasHours ? `${formatHours(project.approved_hours)} / ${formatHours(project.expected_hours)}` : "—"} />
          <Detail icon={<TeamIcon />} label="Team" value={project.total_assigned ?? "—"} />
        </div>
        <div className="pm-project-preview-detail-group">
          <Detail icon={<StaffingIcon />} label="Staffing" value={hasStaffingCounts ? `${project.total_assigned} / ${project.total_required}` : resolveProjectStatusTheme(project.staffing_status).label} />
          <Detail icon={<ProjectStatusIcon />} label="Status" value={<span className={`pm-project-detail-status ${status.badgeClass}`}>{status.label}</span>} />
        </div>
      </dl>
    </article>
  );
}

function Detail({ icon, label, value }) {
  return <div><dt>{icon}<span>{label}</span></dt><dd>{value}</dd></div>;
}

export function ProjectBuildingIcon() {
  return <svg data-testid="pm-project-building-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V5.5L12 3v18M12 9h8v12M7.5 7.5h1M7.5 11.5h1M7.5 15.5h1M15.5 12h1M15.5 16h1M3 21h18" /></svg>;
}
function EllipsisIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v.01M12 12v.01M12 19v.01" /></svg>; }
function CalendarIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>; }
function HourglassIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12M6 21h12M7 3c0 5 4 5 5 9 1-4 5-4 5-9M7 21c0-5 4-5 5-9 1 4 5 4 5 9" /></svg>; }
function TeamIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1M16 5a3 3 0 0 1 0 6M19 20v-1a5.5 5.5 0 0 0-3-4.9" /></svg>; }
function StaffingIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4 20v-1a6 6 0 0 1 12 0v1M18 11v6M15 14h6" /></svg>; }
function ProjectStatusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3h8l3 3v15H7z" /><path d="M15 3v4h4M10 12h5M10 16h5" /></svg>; }
