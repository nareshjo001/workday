import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import ProjectTable from "../components/projects/ProjectTable";
import ProjectCardList from "../components/projects/ProjectCardList";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import pmProjectService from "../services/pmProjectService";

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

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmProjectService.listProjects();
      setProjects(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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

  return (
    <DashboardLayout title="Projects">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Projects</h1>
          <PrimaryButton type="button" fullWidth={false} onClick={() => setIsCreateOpen(true)}>
            + Create Project
          </PrimaryButton>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        {isLoading ? (
          <Spinner label="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState onAdd={() => setIsCreateOpen(true)} />
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <ProjectTable projects={projects} onComplete={handleComplete} completingId={completingId} />
            <ProjectCardList projects={projects} onComplete={handleComplete} completingId={completingId} />
          </div>
        )}
      </div>

      {isCreateOpen && (
        <CreateProjectModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} />
      )}
    </DashboardLayout>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-text-secondary">No projects yet.</p>
      <p className="max-w-sm text-sm text-muted">
        Create your first project with staffing requirements, and Vendors will be able to browse it and
        assign contractors.
      </p>
      <PrimaryButton type="button" fullWidth={false} onClick={onAdd} className="mt-2">
        + Create Project
      </PrimaryButton>
    </div>
  );
}
