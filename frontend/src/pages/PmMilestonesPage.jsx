import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import MilestoneTable from "../components/milestones/MilestoneTable";
import MilestoneCardList from "../components/milestones/MilestoneCardList";
import CreateMilestoneModal from "../components/milestones/CreateMilestoneModal";
import { inputClassName } from "../components/FormField";
import { WorkProgress, HoursStaffingProgress } from "../components/projects/format";
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

  // MVP fix 1 ("work-hour allocation must belong to the PM, not the
  // Vendor"): per-contractor allocation-input state, keyed by
  // contractor_id, plus a per-row saving flag and error so one row's save
  // in flight/failure never affects the others.
  const [allocationInputs, setAllocationInputs] = useState({});
  const [savingAllocationId, setSavingAllocationId] = useState(null);
  const [allocationError, setAllocationError] = useState(null);

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
      // Seed each row's input with its current allocation so the field
      // starts populated rather than blank — a PM editing one contractor
      // shouldn't have to first look up what's already allocated.
      const seeded = {};
      for (const c of contractorData) {
        seeded[c.contractor_id] = c.allocated_hours === null || c.allocated_hours === undefined ? "" : String(c.allocated_hours);
      }
      setAllocationInputs(seeded);
    } catch (err) {
      setMilestoneError(err.message);
    } finally {
      setIsLoadingMilestones(false);
    }
  }, []);

  const handleAllocationInputChange = (contractorId, value) => {
    setAllocationError(null);
    setAllocationInputs((prev) => ({ ...prev, [contractorId]: value }));
  };

  // MVP fix 1: the actual mutating call — validated server-side regardless
  // of anything checked here (positive number, contractor still actively
  // assigned, total <= project.expected_hours, can't drop below hours
  // already approved for this contractor). This is just a friendly
  // client-side guard against an obviously-empty submission.
  const handleSaveAllocation = async (contractorId) => {
    setAllocationError(null);
    const raw = allocationInputs[contractorId];
    const hours = Number(raw);
    if (!raw || !Number.isFinite(hours) || hours <= 0) {
      setAllocationError("Enter a positive number of hours to allocate.");
      return;
    }
    setSavingAllocationId(contractorId);
    try {
      const updated = await pmProjectService.updateContractorAllocation(
        Number(selectedProjectId),
        contractorId,
        hours
      );
      setContractors((prev) =>
        prev.map((c) => (c.contractor_id === contractorId ? { ...c, ...updated } : c))
      );
      setSuccessMessage(`Allocation updated for ${updated.name || "contractor"}.`);
    } catch (err) {
      setAllocationError(err.message);
    } finally {
      setSavingAllocationId(null);
    }
  };

  useEffect(() => {
    if (selectedProjectId) loadMilestones(selectedProjectId);
  }, [selectedProjectId, loadMilestones]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const selectedProject = projects.find((p) => String(p.id) === selectedProjectId);

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
              Create a project first — milestones are set up per project, and every contractor staffed
              on it contributes hours toward them.
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

            {contractors.length > 0 && (
              <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
                <p className="mb-2 text-sm font-medium text-text-secondary">Team on this project</p>
                {selectedProject && (
                  <div className="mb-3 flex flex-col gap-1 border-b border-border pb-3 text-sm">
                    <WorkProgress
                      approvedHours={selectedProject.approved_hours}
                      expectedHours={selectedProject.expected_hours}
                      progressPercent={selectedProject.work_progress_percent}
                    />
                    <HoursStaffingProgress
                      allocatedHours={selectedProject.allocated_hours}
                      expectedHours={selectedProject.expected_hours}
                    />
                  </div>
                )}

                {/* MVP fix 1: allocation is a PM control, not a Vendor one
                    — this is the only place in the app a work-hour
                    allocation value can be set/changed. */}
                <AlertBanner message={allocationError} />

                <div className="flex flex-col gap-1.5 text-sm">
                  {contractors.map((c) => (
                    <div
                      key={c.contractor_id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div>
                        <span className="text-text">
                          {c.name}
                          {c.assignment_status === "RELEASED" && (
                            <span className="ml-2 text-xs text-muted">(released)</span>
                          )}
                        </span>
                        {c.allocated_hours !== null && c.allocated_hours !== undefined ? (
                          <p className="text-xs text-muted">
                            Allocated {c.allocated_hours}h · Approved {c.approved_hours ?? 0}h · Remaining{" "}
                            {c.remaining_hours ?? "—"}h
                          </p>
                        ) : (
                          <p className="text-xs text-warning">Not yet allocated</p>
                        )}
                      </div>
                      {c.assignment_status !== "RELEASED" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Hours"
                            value={allocationInputs[c.contractor_id] ?? ""}
                            onChange={(e) => handleAllocationInputChange(c.contractor_id, e.target.value)}
                            className="w-24 rounded border border-border px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAllocation(c.contractor_id)}
                            disabled={savingAllocationId === c.contractor_id}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingAllocationId === c.contractor_id ? "Saving…" : "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AlertBanner message={milestoneError} />

            {isLoadingMilestones ? (
              <Spinner label="Loading milestones…" />
            ) : milestones.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
                <p className="text-text-secondary">No milestones yet for this project.</p>
                <p className="max-w-sm text-sm text-muted">
                  Create one for the project — it's automatically marked Met and billed to every
                  contributing contractor once the project's approved hours reach the threshold.
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
        <CreateMilestoneModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} />
      )}
    </DashboardLayout>
  );
}
