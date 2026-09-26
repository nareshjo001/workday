import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import PmProjectPreview from "../components/dashboard/PmProjectPreview";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import pmProjectService from "../services/pmProjectService";
import ListControls, { ListSearch } from "../components/ListControls";
import useDebouncedValue from "../hooks/useDebouncedValue";
import ProjectSettingsModal from "../components/projects/ProjectSettingsModal";
import RequirementManagerModal from "../components/projects/RequirementManagerModal";
import PMProjectControlModal from "../components/projects/PMProjectControlModal";
import intelligenceService from "../services/intelligenceService";
import pmProjectControlService from "../services/pmProjectControlService";
import auditActivityService from "../services/auditActivityService";
import PMProjectActivityModal from "../components/projects/PMProjectActivityModal";
import Modal from "../components/Modal";

// Manage projects scoped to the authenticated PM by the server.
export default function PMProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  // Allow only one project dialog to be active at a time.
  const [activeProjectDialog, setActiveProjectDialog] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [completionWarnings, setCompletionWarnings] = useState([]);
  const modalTriggerRef = useRef(null);

  const [control, setControl] = useState(null);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState(null);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [aiExplanationsEnabled, setAiExplanationsEnabled] = useState(false);
  const [explanations, setExplanations] = useState({});
  const explanationContextVersion = useRef(0);
  const explanationRequestSequence = useRef(0);
  const activeExplanationRequests = useRef(new Map());

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
      const data = await pmProjectService.listProjects({ page, pageSize: 12, sort: "created_at", order: "desc", ...(debouncedSearch ? { search: debouncedSearch } : {}) });
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
      if (active) {
        setControlEnabled(response.capabilities.pm_project_control === true);
        setAiExplanationsEnabled(response.capabilities.ai_explanations === true);
      }
    }).catch(() => { if (active) { setControlEnabled(false); setAiExplanationsEnabled(false); } });
    return () => { active = false; };
  }, []);

  const invalidateExplanations = useCallback(() => {
    explanationContextVersion.current += 1;
    activeExplanationRequests.current.clear();
    setExplanations({});
  }, []);

  const restoreTriggerFocus = useCallback(() => {
    const trigger = modalTriggerRef.current;
    modalTriggerRef.current = null;
    const restore = () => trigger?.focus();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
    else restore();
  }, []);

  const closeActiveDialog = useCallback(() => {
    setActiveProjectDialog(null);
    setSelectedProject(null);
    setCompletionWarnings([]);
    setControl(null);
    setControlError(null);
    setControlLoading(false);
    setActivity(null);
    setActivityError(null);
    setActivityLoading(false);
    invalidateExplanations();
    restoreTriggerFocus();
  }, [invalidateExplanations, restoreTriggerFocus]);

  const openCreate = useCallback(() => {
    modalTriggerRef.current = null;
    setSelectedProject(null);
    setActiveProjectDialog("create");
  }, []);

  const openSettings = useCallback((project, triggerElement) => {
    modalTriggerRef.current = triggerElement || (project?.name ? document.querySelector(`button[aria-label="Project actions for ${project.name}"]`) : null);
    setSelectedProject(project);
    setActiveProjectDialog("settings");
  }, []);

  const openRequirements = useCallback((project, triggerElement) => {
    modalTriggerRef.current = triggerElement || (project?.name ? document.querySelector(`button[aria-label="Project actions for ${project.name}"]`) : null);
    const fullProject = projects.find((p) => p.id === project?.id) || project;
    setSelectedProject(fullProject);
    setActiveProjectDialog("requirements");
  }, [projects]);

  const loadControl = useCallback(async (project, triggerElement) => {
    if (!controlEnabled || !project) return;
    modalTriggerRef.current = triggerElement || (project?.name ? document.querySelector(`button[aria-label="Project actions for ${project.name}"]`) : null);
    setSelectedProject(project);
    setActiveProjectDialog("control");
    setControl(null);
    invalidateExplanations();
    setControlError(null);
    setControlLoading(true);
    try {
      setControl(await pmProjectControlService.getProjectControl(project.id));
    } catch {
      setControlError(true);
    } finally {
      setControlLoading(false);
    }
  }, [controlEnabled, invalidateExplanations]);

  const openRequirementsFromControl = useCallback((projectFromControl) => {
    const targetId = projectFromControl?.id || selectedProject?.id;
    const targetProject = projects.find((p) => p.id === targetId) || projectFromControl || selectedProject;
    if (!targetProject) return;

    // Preserve the original trigger for focus restoration when replacing Project Control with Requirements.
    setControl(null);
    setControlError(null);
    setControlLoading(false);
    invalidateExplanations();

    // Replace the control dialog with requirements for the same project.
    setSelectedProject(targetProject);
    setActiveProjectDialog("requirements");
  }, [projects, selectedProject, invalidateExplanations]);

  const explainFinding = useCallback(async (finding) => {
    if (!aiExplanationsEnabled || !selectedProject || !control) return;
    const projectId = selectedProject.id;
    const contextVersion = explanationContextVersion.current;
    const requestKey = `${projectId}:${finding.code}`;
    const requestId = ++explanationRequestSequence.current;
    activeExplanationRequests.current.set(requestKey, requestId);
    setExplanations((current) => ({ ...current, [requestKey]: { loading: true } }));
    try {
      const data = await pmProjectControlService.explainFinding(projectId, finding.code);
      if (contextVersion !== explanationContextVersion.current || activeExplanationRequests.current.get(requestKey) !== requestId) return;
      activeExplanationRequests.current.delete(requestKey);
      setExplanations((current) => ({ ...current, [requestKey]: { data } }));
    } catch {
      if (contextVersion !== explanationContextVersion.current || activeExplanationRequests.current.get(requestKey) !== requestId) return;
      activeExplanationRequests.current.delete(requestKey);
      setExplanations((current) => ({ ...current, [requestKey]: { error: true } }));
    }
  }, [aiExplanationsEnabled, control, selectedProject]);

  const loadActivity = useCallback(async (project, triggerOrPage = 1, pageIfTrigger = 1) => {
    if (!project) return;

    let requestedPage = 1;
    let triggerElement = null;

    if (typeof triggerOrPage === "number") {
      requestedPage = triggerOrPage;
    } else {
      triggerElement = triggerOrPage;
      if (typeof pageIfTrigger === "number") {
        requestedPage = pageIfTrigger;
      }
    }

    if (triggerElement && typeof triggerElement.focus === "function") {
      modalTriggerRef.current = triggerElement;
    } else if (!modalTriggerRef.current) {
      modalTriggerRef.current = document.activeElement || (project.name ? document.querySelector(`button[aria-label="Project actions for ${project.name}"]`) : null);
    }

    setSelectedProject(project);
    setActiveProjectDialog("activity");
    setActivity(null);
    setActivityError(null);
    setActivityLoading(true);
    setActivityPage(requestedPage);
    try {
      setActivity(await auditActivityService.project(project.id, requestedPage));
    } catch {
      setActivityError(true);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleCreate = async (payload) => {
    const created = await pmProjectService.createProject(payload);
    setProjects((prev) => [created, ...prev]);
    closeActiveDialog();
    setSuccessMessage(
      `Project "${created.name}" created — it's now visible to Vendors for staffing.`
    );
  };

  const handleSettings = async (id, payload) => {
    await pmProjectService.updateProject(id, payload);
    await loadProjects();
    closeActiveDialog();
    setSuccessMessage("Project settings updated.");
  };

  const handleRequirement = async (projectId, requirementId, payload) => {
    const updated = await pmProjectService.updateRequirement(projectId, requirementId, payload);
    await loadProjects();
    setSuccessMessage("Staffing requirement updated.");
    setSelectedProject((prev) => {
      if (!prev || prev.id !== projectId) return prev;
      return {
        ...prev,
        requirements: (prev.requirements || []).map((r) => (r.id === requirementId ? { ...r, ...updated } : r)),
      };
    });
    return updated;
  };

  const completeProject = async (project) => {
    setCompletingId(project.id);
    try {
      const { released_assignment_count } = await pmProjectService.completeProject(project.id);
      await loadProjects();
      closeActiveDialog();
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

  const startCompletion = async (project) => {
    setActionError(null);
    setCompletingId(project.id);
    try {
      const readiness = await pmProjectService.getCloseReadiness(project.id);
      if (!readiness.can_complete) {
        setActionError(readiness.blockers.map((item) => item.message).join(" "));
        return;
      }
      if (readiness.warnings.length) {
        setSelectedProject(project);
        setCompletionWarnings(readiness.warnings);
        setActiveProjectDialog("completion");
        return;
      }
      await completeProject(project);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <DashboardLayout title="Projects">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Projects</h1>
          <div className="flex flex-wrap gap-2">
            <Link to="/pm/staffing-pipeline" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted">Staffing Pipeline</Link>
            <Link to="/pm/vendor-access" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted">Manage Vendor Access</Link>
            <PrimaryButton type="button" fullWidth={false} onClick={openCreate}>+ Create Project</PrimaryButton>
          </div>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError} />
        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState onAdd={openCreate} />
        ) : (
          <>
            <div className="flex justify-end">
              <ListSearch id="project-search" search={search} onSearchChange={(value) => { setPage(1); setSearch(value); }} />
            </div>
            <PmProjectPreview
              projects={projects}
              onSettings={openSettings}
              onRequirements={openRequirements}
              onControl={controlEnabled ? loadControl : undefined}
              onActivity={loadActivity}
            />
            <div className="[&>div]:sm:justify-end">
              <ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
            </div>
          </>
        )}
      </div>

      {activeProjectDialog === "create" && (
        <CreateProjectModal onClose={closeActiveDialog} onCreate={handleCreate} />
      )}
      {activeProjectDialog === "settings" && selectedProject && (
        <ProjectSettingsModal
          project={selectedProject}
          onClose={closeActiveDialog}
          onSave={handleSettings}
          onComplete={selectedProject.status === "ACTIVE" ? startCompletion : undefined}
          isCompleting={completingId === selectedProject.id}
        />
      )}
      {activeProjectDialog === "requirements" && selectedProject && (
        <RequirementManagerModal
          project={selectedProject}
          onClose={closeActiveDialog}
          onSave={handleRequirement}
        />
      )}
      {activeProjectDialog === "control" && controlEnabled && selectedProject && (
        <PMProjectControlModal
          project={selectedProject}
          control={control}
          isLoading={controlLoading}
          error={controlError}
          onClose={closeActiveDialog}
          onRefresh={() => loadControl(selectedProject)}
          onOpenRequirements={openRequirementsFromControl}
          aiEnabled={aiExplanationsEnabled}
          explanations={explanations}
          onExplain={explainFinding}
        />
      )}
      {activeProjectDialog === "activity" && selectedProject && (
        <PMProjectActivityModal
          project={selectedProject}
          activity={activity}
          isLoading={activityLoading}
          error={activityError}
          onClose={closeActiveDialog}
          onRetry={() => loadActivity(selectedProject, activityPage)}
          onPrevious={() => loadActivity(selectedProject, activityPage - 1)}
          onNext={() => loadActivity(selectedProject, activityPage + 1)}
        />
      )}
      {activeProjectDialog === "completion" && selectedProject && (
        <CompletionConfirmationModal
          project={selectedProject}
          warnings={completionWarnings}
          isCompleting={completingId === selectedProject.id}
          onCancel={closeActiveDialog}
          onConfirm={() => completeProject(selectedProject)}
        />
      )}
    </DashboardLayout>
  );
}

function CompletionConfirmationModal({ project, warnings, isCompleting, onCancel, onConfirm }) {
  return (
    <Modal title={`Complete project: ${project.name}`} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">Review these close-out warnings before completing this project.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          {warnings.map((warning) => <li key={warning.code || warning.message}>{warning.message}</li>)}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={isCompleting} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <PrimaryButton type="button" fullWidth={false} onClick={onConfirm} isLoading={isCompleting} loadingText="Completing…">Complete project</PrimaryButton>
        </div>
      </div>
    </Modal>
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
