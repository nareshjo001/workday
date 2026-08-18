import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import MilestoneTable from "../components/milestones/MilestoneTable";
import MilestoneCardList from "../components/milestones/MilestoneCardList";
import CreateMilestoneModal from "../components/milestones/CreateMilestoneModal";
import { inputClassName } from "../components/FormField";
import pmProjectService from "../services/pmProjectService";
import pmMilestoneService from "../services/pmMilestoneService";

/**
 * PM's Milestones screen (Module 5): select one of your own projects,
 * view its milestones (across every contractor staffed on it), and
 * create new ones. All data is scoped to the authenticated PM
 * server-side — this component never sends or reads a pm id itself, and
 * every request is already implicitly limited to projects this PM owns
 * (see pmMilestoneService / pmProjectService, both 404 on any other PM's
 * project rather than this page filtering anything client-side).
 */
export default function PmMilestonesPage() {
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [milestones, setMilestones] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoadingMilestones, setIsLoadingMilestones] = useState(false);
  const [milestoneError, setMilestoneError] = useState(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setLoadError(null);
    try {
      const data = await pmProjectService.listProjects();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(String(data[0].id));
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadMilestones = useCallback(async (projectId) => {
    if (!projectId) return;
    setIsLoadingMilestones(true);
    setMilestoneError(null);
    try {
      const [milestoneData, contractorData] = await Promise.all([
        pmMilestoneService.listMilestones(projectId),
        pmProjectService.listAssignedContractors(projectId),
      ]);
      setMilestones(milestoneData);
      setContractors(contractorData);
    } catch (err) {
      setMilestoneError(err.message);
    } finally {
      setIsLoadingMilestones(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadMilestones(selectedProjectId);
  }, [selectedProjectId, loadMilestones]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleCreate = async (payload) => {
    const created = await pmMilestoneService.createMilestone({
      projectId: Number(selectedProjectId),
      ...payload,
    });
    setMilestones((prev) => [created, ...prev]);
    setIsCreateOpen(false);
    setSuccessMessage(
      created.status === "MET"
        ? `Milestone "${created.name}" created — already met by existing approved hours.`
        : `Milestone "${created.name}" created.`
    );
  };

  return (
    <DashboardLayout title="Milestones & Billing">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Milestones & Billing</h1>
          <PrimaryButton
            type="button"
            fullWidth={false}
            disabled={!selectedProjectId}
            onClick={() => setIsCreateOpen(true)}
          >
            + Create Milestone
          </PrimaryButton>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {isLoadingProjects ? (
          <Spinner label="Loading projects…" />
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No projects yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Create a project first — milestones are set up per project, for the contractors staffed on it.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project" className="text-sm font-medium text-text-secondary">
                Project
              </label>
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={inputClassName(false)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <AlertBanner message={milestoneError} />

            {isLoadingMilestones ? (
              <Spinner label="Loading milestones…" />
            ) : milestones.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
                <p className="text-text-secondary">No milestones yet for this project.</p>
                <p className="max-w-sm text-sm text-muted">
                  Create one for a staffed contractor — it's automatically marked Met and billed once their
                  approved hours reach the threshold.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
                <MilestoneTable milestones={milestones} />
                <MilestoneCardList milestones={milestones} />
              </div>
            )}
          </>
        )}
      </div>

      {isCreateOpen && (
        <CreateMilestoneModal
          contractors={contractors}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </DashboardLayout>
  );
}
