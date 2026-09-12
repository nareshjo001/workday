import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import ProjectTable from "../components/projects/ProjectTable";
import ProjectCardList from "../components/projects/ProjectCardList";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import pmProjectService from "../services/pmProjectService";
import ListControls from "../components/ListControls";
import useDebouncedValue from "../hooks/useDebouncedValue";
import ProjectSettingsModal from "../components/projects/ProjectSettingsModal";
import RequirementManagerModal from "../components/projects/RequirementManagerModal";
import PMProjectControlPanel from "../components/projects/PMProjectControlPanel";
import intelligenceService from "../services/intelligenceService";
import pmProjectControlService from "../services/pmProjectControlService";
import auditActivityService from "../services/auditActivityService";
import ActivityList from "../components/activity/ActivityList";

/**
 * PM's project-management screen: list + create. All data comes from
 * pmProjectService, which is scoped to the authenticated PM server-side —
 * this component never sends or reads a pm id itself.
 */
export default function PMProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [settingsProject, setSettingsProject] = useState(null);
  const [requirementsProject, setRequirementsProject] = useState(null);
  const [controlProject, setControlProject] = useState(null);
  const [control, setControl] = useState(null);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState(null);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [activityProject, setActivityProject] = useState(null);
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState(null);
  const [activityPage, setActivityPage] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const debouncedSearch = useDebouncedValue(search);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmProjectService.listProjects({ page, pageSize: 25, sort: "created_at", order: "desc", ...(debouncedSearch ? { search: debouncedSearch } : {}) });
      setProjects(data.items);
      setPageInfo(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let active = true;
    intelligenceService.getCapabilities().then((response) => {
      if (active) setControlEnabled(response.capabilities.pm_project_control === true);
    }).catch(() => { if (active) setControlEnabled(false); });
    return () => { active = false; };
  }, []);

  const loadControl = useCallback(async (project) => {
    if (!controlEnabled || !project) return;
    setControlProject(project);
    setControl(null);
    setControlError(null);
    setControlLoading(true);
    try { setControl(await pmProjectControlService.getProjectControl(project.id)); }
    catch { setControlError(true); }
    finally { setControlLoading(false); }
  }, [controlEnabled]);

  const loadActivity = useCallback(async (project, requestedPage = 1) => {
    if (!project) return;
    setActivityProject(project); setActivity(null); setActivityError(null); setActivityLoading(true); setActivityPage(requestedPage);
    try { setActivity(await auditActivityService.project(project.id, requestedPage)); }
    catch { setActivityError(true); }
    finally { setActivityLoading(false); }
  }, []);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleCreate = async (payload) => {
    const created = await pmProjectService.createProject(payload);
    setProjects((prev) => [created, ...prev]);
    setIsCreateOpen(false);
    setSuccessMessage(
      `Project "${created.name}" created — it's now visible to Vendors for staffing.`
    );
  };

  // Project hours/allocation redesign: marks a project COMPLETED and
  // auto-releases every active assignment on it (see
  // pmProjectService.completeProject on the backend) — a released
  // contractor becomes reassignable elsewhere immediately. Re-fetches the
  // whole list afterward rather than patching one row in place, since
  // completion also changes every released assignment's staffing/hours
  // figures that this list may be showing.
  const handleComplete = async (project) => {
    setActionError(null);
    setCompletingId(project.id);
    try {
      const readiness = await pmProjectService.getCloseReadiness(project.id);
      if (!readiness.can_complete) { setActionError(readiness.blockers.map((item) => item.message).join(" ")); return; }
      if (readiness.warnings.length && !window.confirm(`Close warnings:\n${readiness.warnings.map((item) => `• ${item.message}`).join("\n")}\n\nComplete this project?`)) return;
      const { released_assignment_count } = await pmProjectService.completeProject(project.id);
      await loadProjects();
      setSuccessMessage(
        `Project "${project.name}" marked complete — ${released_assignment_count} contractor` +
          `${released_assignment_count === 1 ? "" : "s"} released and now reassignable.`
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCompletingId(null);
    }
  };
  const handleSettings = async (id, payload) => { await pmProjectService.updateProject(id,payload); await loadProjects(); setSuccessMessage("Project settings updated."); };
  const handleRequirement = async (projectId, requirementId, payload) => { const updated = await pmProjectService.updateRequirement(projectId, requirementId, payload); await loadProjects(); setSuccessMessage("Staffing requirement updated."); return updated; };

  return (
    <DashboardLayout title="Projects">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Projects</h1>
          <div className="flex flex-wrap gap-2"><Link to="/pm/staffing-pipeline" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted">Staffing Pipeline</Link><Link to="/pm/vendor-access" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted">Manage Vendor Access</Link><PrimaryButton type="button" fullWidth={false} onClick={() => setIsCreateOpen(true)}>+ Create Project</PrimaryButton></div>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        {isLoading ? (
          <Spinner label="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState onAdd={() => setIsCreateOpen(true)} />
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <ProjectTable projects={projects} onComplete={handleComplete} completingId={completingId} onSettings={setSettingsProject} onRequirements={setRequirementsProject} onControl={controlEnabled ? loadControl : undefined} onActivity={loadActivity} />
            <ProjectCardList projects={projects} onComplete={handleComplete} completingId={completingId} onSettings={setSettingsProject} onRequirements={setRequirementsProject} onControl={controlEnabled ? loadControl : undefined} onActivity={loadActivity} />
            <ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} search={search} onSearchChange={(value) => { setPage(1); setSearch(value); }} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
          </div>
        )}
        {controlEnabled && controlProject && <PMProjectControlPanel control={control} isLoading={controlLoading} error={controlError} onRefresh={() => loadControl(controlProject)} onOpenRequirements={() => setRequirementsProject(controlProject)} />}
        {activityProject && <ActivityList activity={activity} isLoading={activityLoading} error={activityError} onRetry={() => loadActivity(activityProject, activityPage)} onPrevious={() => loadActivity(activityProject, activityPage - 1)} onNext={() => loadActivity(activityProject, activityPage + 1)} />}
      </div>

      {isCreateOpen && (
        <CreateProjectModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} />
      )}
      {settingsProject && (
        <ProjectSettingsModal project={settingsProject} onClose={() => setSettingsProject(null)} onSave={handleSettings} />
      )}
      {requirementsProject && (
        <RequirementManagerModal project={requirementsProject} onClose={() => setRequirementsProject(null)} onSave={handleRequirement} />
      )}
    </DashboardLayout>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-text-secondary">No projects yet.</p>
      <p className="max-w-sm text-sm text-muted">
        Create your first project with staffing requirements, and connected Vendors will be able to
        submit candidates for review.
      </p>
      <PrimaryButton type="button" fullWidth={false} onClick={onAdd} className="mt-2">
        + Create Project
      </PrimaryButton>
    </div>
  );
}
