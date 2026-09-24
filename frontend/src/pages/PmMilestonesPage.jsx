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

function FlagIcon({ className = "h-6 w-6" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 5c4-3 8 3 14 0v9c-6 3-10-3-14 0" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function HeroArtwork() {
  return (
    <svg aria-hidden="true" className="h-[72px] w-[250px]" viewBox="0 0 250 72" fill="none">
      <path d="M4 60c42 0 53-34 94-32 40 2 50 31 96 26 20-2 33-12 52-28" stroke="#93C5FD" strokeWidth="2" strokeDasharray="5 5" />
      <circle cx="99" cy="28" r="5" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="2" />
      <circle cx="195" cy="54" r="6" fill="#BFDBFE" />
      <rect x="124" y="7" width="46" height="54" rx="8" fill="white" stroke="#BFDBFE" strokeWidth="2" />
      <path d="M134 20h25M134 29h20M134 38h25" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
      <circle cx="171" cy="47" r="17" fill="#2563EB" />
      <path d="M165 55V39c5-3 8 3 14 0v9c-6 3-9-3-14 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const [releasingContractorId, setReleasingContractorId] = useState(null);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setLoadError(null);
    try {
      const data = await pmProjectService.listProjects({ page: 1, pageSize: 100, sort: "created_at", order: "desc" });
      setProjects(data.items);
      if (data.items.length > 0) {
        setSelectedProjectId(String(data.items[0].id));
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

  const handleRelease = async (contractorId, name) => {
    const reason = window.prompt(`Why is ${name} being released?`);
    if (!reason?.trim()) return;
    const actualEndDate = window.prompt("Actual final work date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!actualEndDate) return;
    setAllocationError(null);
    setReleasingContractorId(contractorId);
    try {
      const updated = await pmProjectService.releaseContractor(Number(selectedProjectId), contractorId, { actualEndDate, reason: reason.trim() });
      setContractors((prev) => prev.map((c) => (c.contractor_id === contractorId ? { ...c, ...updated } : c)));
      setSuccessMessage(`${name} has been released from this project.`);
    } catch (err) {
      setAllocationError(err.message);
    } finally {
      setReleasingContractorId(null);
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
      <div className="flex w-full min-w-0 flex-col gap-4">
        <section aria-labelledby="milestones-page-title" className="relative flex min-h-[104px] flex-col items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blue-50/80 to-transparent" />
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 sm:h-14 sm:w-14">
              <FlagIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <h1 id="milestones-page-title" className="text-xl font-bold tracking-tight text-slate-900">Milestones & Billing</h1>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">Track project milestones, billing thresholds, and payment status.</p>
            </div>
          </div>
          <div className="pointer-events-none relative z-10 hidden shrink-0 xl:block"><HeroArtwork /></div>
          <PrimaryButton
            type="button"
            fullWidth={false}
            disabled={!selectedProjectId}
            onClick={() => setIsCreateOpen(true)}
            className="relative z-10 mt-3 shrink-0 !w-full !rounded-lg !px-3.5 !py-2 !text-sm sm:ml-4 sm:mt-0 sm:!w-auto"
          >
            <PlusIcon />
            Create Milestone
          </PrimaryButton>
        </section>

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
            <div className="flex flex-col gap-1.5 px-1">
              <label htmlFor="project" className="text-xs font-semibold text-slate-700">
                Project
              </label>
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={`${inputClassName(false)} !h-10 !rounded-lg !py-0 !text-sm`}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {contractors.length > 0 && (
              <section aria-labelledby="project-team-title" className="grid overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm lg:grid-cols-2">
                <div className="p-4 sm:p-[18px]">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"><TeamIcon /></span>
                    <div className="min-w-0 flex-1">
                      <h2 id="project-team-title" className="text-xs font-semibold text-slate-900">Team on this project</h2>
                      {selectedProject && (
                        <div className="mt-2 flex flex-col gap-2 text-xs [&_[role=progressbar]]:bg-blue-100 [&_[role=progressbar]>div]:!bg-blue-600 [&>div>span>span:last-child]:font-semibold [&>div>span>span:last-child]:text-blue-600">
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
                    </div>
                  </div>
                  {allocationError && <div className="mt-2"><AlertBanner message={allocationError} /></div>}
                </div>

                {/* MVP fix 1: allocation remains a PM control, with the
                    existing save/release handlers and API calls unchanged. */}
                <div className="relative flex flex-col justify-center px-4 py-2 text-sm before:absolute before:inset-y-4 before:left-0 before:hidden before:w-px before:bg-slate-200 sm:px-[18px] lg:before:block">
                  {contractors.map((c) => (
                    <div
                      key={c.contractor_id}
                      className="flex flex-wrap items-center justify-between gap-3.5 border-b border-slate-200 py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-semibold text-slate-900">{c.name}</span>
                          {c.assignment_status === "RELEASED" && (
                            <span className="text-[11px] text-slate-400">(released)</span>
                          )}
                        </div>
                        {c.allocated_hours !== null && c.allocated_hours !== undefined ? (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Allocated {c.allocated_hours}h · Approved {c.approved_hours ?? 0}h · Remaining{" "}
                            {c.remaining_hours ?? "—"}h
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-warning">Not yet allocated</p>
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
                            className="h-8 w-20 rounded-md border border-slate-300 px-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAllocation(c.contractor_id)}
                            disabled={savingAllocationId === c.contractor_id}
                            className="h-8 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingAllocationId === c.contractor_id ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRelease(c.contractor_id, c.contractor_name)}
                            disabled={releasingContractorId === c.contractor_id}
                            className="h-8 rounded-md border border-danger px-3 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {releasingContractorId === c.contractor_id ? "Releasing…" : "Release"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <AlertBanner message={milestoneError} />

            <section aria-labelledby="milestones-list-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ListIcon /></span>
                <div>
                  <h2 id="milestones-list-title" className="text-sm font-semibold text-slate-900">Milestones</h2>
                  <p className="text-xs text-slate-500">Track project milestones, billing thresholds, and payment status.</p>
                </div>
              </div>
              {isLoadingMilestones ? (
                <Spinner label="Loading milestones…" />
              ) : milestones.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 px-6 py-8 text-center">
                  <p className="text-text-secondary">No milestones yet for this project.</p>
                  <p className="max-w-sm text-sm text-muted">
                    Create one for the project — it's automatically marked Met and billed to every
                    contributing contractor once the project's approved hours reach the threshold.
                  </p>
                </div>
              ) : (
                <>
                  <MilestoneTable milestones={milestones} />
                  <MilestoneCardList milestones={milestones} />
                </>
              )}
            </section>
          </>
        )}
      </div>

      {isCreateOpen && (
        <CreateMilestoneModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} />
      )}
    </DashboardLayout>
  );
}
