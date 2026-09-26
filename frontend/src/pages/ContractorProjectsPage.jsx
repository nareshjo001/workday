import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import { formatSkill } from "../constants/skills";
import { formatDate, ProjectStatusBadge } from "../components/projects/format";
import { getSkillTheme } from "../utils/skillTheme";
import { resolveProjectStatusTheme } from "../utils/projectStatusTheme";
import contractorProjectService from "../services/contractorProjectService";
import "./ContractorProjectsPage.css";

// Present assigned projects scoped to the authenticated contractor by the server.
export default function ContractorProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await contractorProjectService.listAssignedProjects();
        setProjects(data);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const visibleProjects = useMemo(
    () => assignmentStatusFilter === "ALL"
      ? projects
      : projects.filter((project) => project.assignment_status === assignmentStatusFilter),
    [assignmentStatusFilter, projects]
  );

  return (
    <DashboardLayout title="My Projects">
      <div className="contractor-projects-page">
        <div className="contractor-projects-heading">
          <div>
            <h1>My Projects</h1>
            <p>Projects you’re assigned to, with key dates and your current status.</p>
          </div>
          <div className="contractor-projects-controls">
            <label className="contractor-projects-filter" htmlFor="contractor-project-status-filter">
              <span className="sr-only">Filter by assignment status</span>
              <select
                id="contractor-project-status-filter"
                value={assignmentStatusFilter}
                onChange={(event) => setAssignmentStatusFilter(event.target.value)}
                aria-label="Filter by assignment status"
              >
                <option value="ALL">All assignments</option>
                <option value="ACTIVE">Active</option>
                <option value="RELEASED">Released</option>
              </select>
            </label>
            <a href="/contractor/availability" className="contractor-projects-availability">
              Manage availability
            </a>
          </div>
        </div>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading your projects…" />
        ) : projects.length === 0 ? (
          <div className="contractor-projects-empty">
            <EmptyProjectIcon />
            <p>No projects assigned yet.</p>
            <span>Your Vendor will assign you to a project — check back once you’ve been assigned.</span>
          </div>
        ) : (
          <section className="contractor-projects-panel" aria-label="Assigned projects">
            <div className="contractor-projects-table" role="table" aria-label="My projects">
              <div className="contractor-projects-table-head" role="row">
                <span role="columnheader">Project</span>
                <span role="columnheader">Company</span>
                <span role="columnheader">Dates</span>
                <span role="columnheader">Assigned</span>
                <span role="columnheader">Skill</span>
                <span role="columnheader">Status</span>
              </div>
              <div role="rowgroup">
                {visibleProjects.map((project) => <ProjectRow key={project.id} project={project} />)}
                {visibleProjects.length === 0 && <FilteredEmptyState status={assignmentStatusFilter} />}
              </div>
            </div>

            <div className="contractor-projects-cards" aria-label="My projects">
              {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
              {visibleProjects.length === 0 && <FilteredEmptyState status={assignmentStatusFilter} />}
            </div>

            <footer className="contractor-projects-footer">
              <span>Showing {visibleProjects.length} of {projects.length} {projects.length === 1 ? "project" : "projects"}</span>
              <span>Assignment dates shown by the project determine when you are available for future work.</span>
            </footer>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProjectRow({ project }) {
  return (
    <div className="contractor-projects-table-row" role="row">
      <div className="contractor-projects-project" role="cell">
        <strong>{project.name}</strong>
        {project.description && <span>{project.description}</span>}
      </div>
      <div className="contractor-projects-company" role="cell">
        <span>{project.company_name || "—"}</span>
        {project.pm_name && <small>PM: {project.pm_name}</small>}
      </div>
      <div className="contractor-projects-dates" role="cell">
        <DateDetail label="Start" value={project.project_start_date} />
        <DateDetail label="End" value={project.project_end_date} />
      </div>
      <div role="cell"><AssignmentDetail project={project} /></div>
      <div role="cell"><SkillBadge skill={project.assigned_skill} /></div>
      <div className="contractor-projects-status" role="cell">
        <ProjectStatusBadge status={project.assignment_status} />
        <ProjectLifecycle status={project.project_status} />
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <article className="contractor-project-card">
      <div className="contractor-project-card-title">
        <div>
          <h2>{project.name}</h2>
          {project.description && <p>{project.description}</p>}
        </div>
        <div className="contractor-projects-status">
          <ProjectStatusBadge status={project.assignment_status} />
          <ProjectLifecycle status={project.project_status} />
        </div>
      </div>
      <dl className="contractor-project-card-details">
        <div><dt>Company</dt><dd>{project.company_name || "—"}</dd>{project.pm_name && <small>PM: {project.pm_name}</small>}</div>
        <div>
          <dt>Assigned</dt>
          <dd>{formatDate(project.assignment_start_date)}</dd>
          {project.assignment_status === "RELEASED" && project.assignment_released_at && (
            <small>Released {formatTimestampDate(project.assignment_released_at)}</small>
          )}
        </div>
        <div><dt>Start</dt><dd>{formatDate(project.project_start_date)}</dd></div>
        <div><dt>End</dt><dd>{formatDate(project.project_end_date)}</dd></div>
      </dl>
      <div className="contractor-project-card-skill"><span>Skill</span><SkillBadge skill={project.assigned_skill} /></div>
    </article>
  );
}

function DateDetail({ label, value }) {
  return <span className="contractor-projects-date"><small>{label}</small><span>{formatDate(value)}</span></span>;
}

function AssignmentDetail({ project }) {
  return (
    <span className="contractor-projects-date">
      <small>Assigned</small>
      <span>{formatDate(project.assignment_start_date)}</span>
      {project.assignment_status === "RELEASED" && project.assignment_released_at && (
        <small className="contractor-projects-released-date">Released {formatTimestampDate(project.assignment_released_at)}</small>
      )}
    </span>
  );
}

function ProjectLifecycle({ status }) {
  const label = resolveProjectStatusTheme(status).label;
  return <small>Project: {label}</small>;
}

function formatTimestampDate(value) {
  return formatDate(String(value).slice(0, 10));
}

function FilteredEmptyState({ status }) {
  const message = status === "ACTIVE"
    ? "No active assignments."
    : status === "RELEASED"
      ? "No released assignments."
      : "No matching assignments.";
  return <div className="contractor-projects-filter-empty" role="status">{message}</div>;
}

function SkillBadge({ skill }) {
  const theme = getSkillTheme(skill);
  return (
    <span
      className="contractor-projects-skill"
      style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
    >
      {formatSkill(skill)}
    </span>
  );
}

function EmptyProjectIcon() {
  return (
    <span className="contractor-projects-empty-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7.5h6l2 2H21v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" />
        <path d="M3 7.5V5a2 2 0 0 1 2-2h4l2 2h6" />
      </svg>
    </span>
  );
}
