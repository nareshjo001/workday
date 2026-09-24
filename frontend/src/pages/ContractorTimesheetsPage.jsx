import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import ProjectTimesheetGroup from "../components/timesheets/ProjectTimesheetGroup";
import LogHoursModal from "../components/timesheets/LogHoursModal";
import EditLogModal from "../components/timesheets/EditLogModal";
import { groupTimesheetsByProjectAndWeek } from "../components/timesheets/weekGrouping";
import contractorTimesheetService from "../services/contractorTimesheetService";
import contractorProjectService from "../services/contractorProjectService";

/**
 * Contractor's own timesheet history + daily "Log Hours" submission.
 * All data comes from contractorTimesheetService/contractorProjectService,
 * both scoped to the authenticated contractor server-side — this
 * component never sends or reads a contractor id itself.
 *
 * The API returns a flat list of daily rows; this page groups them into
 * project -> week -> day purely for display (see weekGrouping.js) and
 * re-groups from scratch on every timesheets update — there is no
 * separate "weekly" state to keep in sync.
 */
export default function ContractorTimesheetsPage() {
  const [timesheets, setTimesheets] = useState([]);
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total_weeks: 0, page_size: 5 });

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [timesheetData, projectData] = await Promise.all([
        contractorTimesheetService.listMyTimesheets({ page, pageSize: 5, sort: "work_date", order: "desc" }),
        contractorProjectService.listAssignedProjects(),
      ]);
      setTimesheets(timesheetData.items);
      setPageInfo(timesheetData);
      setAssignedProjects(projectData);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Only ACTIVE assignments can accept new timesheets (the backend
  // rejects COMPLETED/ON_HOLD projects too — see
  // contractorTimesheetService.submitTimesheet) — filtered here so the
  // Log Hours dropdown never offers a project that would just bounce.
  //
  // PROJECT HOURS/ALLOCATION REDESIGN: also requires assignment_status
  // === "ACTIVE" — a project can stay lifecycle-ACTIVE while THIS
  // contractor has already been RELEASED from it (e.g. after project
  // completion auto-released everyone, or an individual release), and a
  // released contractor should never be offered that project to log
  // against even though the project itself is still open. Legacy rows
  // with assignment_status undefined (pre-redesign data) are treated as
  // eligible, same "undefined means not yet migrated, don't block on it"
  // convention used elsewhere in this redesign.
  const activeProjects = useMemo(
    () =>
      assignedProjects.filter(
        (p) => p.project_status === "ACTIVE" && (p.assignment_status === undefined || p.assignment_status === "ACTIVE")
      ),
    [assignedProjects]
  );

  const groupedProjects = useMemo(
    () => groupTimesheetsByProjectAndWeek(timesheets),
    [timesheets]
  );

  // Project hours/allocation redesign: looked up per project group so
  // ProjectTimesheetGroup can show an Allocated/Approved/Pending/
  // Remaining banner — assignedProjects (not the flat timesheets list)
  // is the source of truth for allocation, since a week with no logs yet
  // still has an allocation worth showing.
  const allocationByProjectId = useMemo(() => {
    const map = new Map();
    for (const p of assignedProjects) map.set(p.id, p);
    return map;
  }, [assignedProjects]);

  const editingProject = useMemo(
    () => (editingLog ? assignedProjects.find((p) => p.id === editingLog.project_id) || null : null),
    [editingLog, assignedProjects]
  );

  const handleSubmit = async (payload) => {
    const created = await contractorTimesheetService.submitTimesheet(payload);
    setTimesheets((prev) => [created, ...prev]);
    setIsLogOpen(false);
    setSuccessMessage(`Logged ${created.hours_logged} hours for "${created.project_name}".`);
  };

  const handleEditSubmit = async (payload) => {
    const wasRejected = editingLog?.status === "REJECTED";
    const updated = await contractorTimesheetService.updateTimesheet(editingLog.id, payload);
    setTimesheets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingLog(null);
    setSuccessMessage(
      wasRejected
        ? `Resubmitted ${updated.hours_logged} hours for "${updated.project_name}".`
        : `Updated draft (${updated.hours_logged}h) for "${updated.project_name}".`
    );
  };

  const handleSubmitDrafts = async () => {
    const ids = timesheets.filter((row) => row.status === "DRAFT" || row.status === "REJECTED").map((row) => row.id);
    if (!ids.length) return;
    await contractorTimesheetService.submitTimesheets(ids);
    await loadAll();
    setSuccessMessage(`${ids.length} daily entr${ids.length === 1 ? "y" : "ies"} submitted for review.`);
  };

  const handleSubmitWeek = async (ids) => {
    await contractorTimesheetService.submitTimesheets(ids);
    await loadAll();
    setSuccessMessage(`${ids.length} daily entr${ids.length === 1 ? "y" : "ies"} submitted for review.`);
  };

  const totalWeeks = Number(pageInfo.total_weeks || 0);
  const pageSize = Number(pageInfo.page_size || 5);
  const startWeek = totalWeeks === 0 ? 0 : (page - 1) * pageSize + 1;
  const endWeek = Math.min(page * pageSize, totalWeeks);
  const paginationSummary =
    totalWeeks === 1
      ? "Showing 1 of 1 week"
      : startWeek === endWeek
      ? `Showing ${startWeek} of ${totalWeeks} weeks`
      : `Showing ${startWeek}–${endWeek} of ${totalWeeks} weeks`;

  return (
    <DashboardLayout title="Timesheets">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Timesheets</h1>
            <p className="mt-1 text-sm text-slate-500">Track and manage your daily project hours and approvals.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitDrafts}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition cursor-pointer"
            >
              Submit visible drafts
            </button>
            <PrimaryButton
              type="button"
              fullWidth={false}
              onClick={() => setIsLogOpen(true)}
              className="h-10 px-4 text-sm font-semibold rounded-lg"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Log Hours</span>
            </PrimaryButton>
          </div>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading your timesheets…" />
        ) : groupedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-2xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">No timesheets logged yet</p>
            <p className="max-w-sm text-sm text-slate-500">
              Log your hours against a project you're assigned to, and your PM will review them.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedProjects.map((project) => (
              <ProjectTimesheetGroup
                key={project.project_id}
                project={project}
                allocation={allocationByProjectId.get(project.project_id)}
                onEdit={setEditingLog}
                onSubmitWeek={handleSubmitWeek}
              />
            ))}

            {totalWeeks > 0 && (
              <nav
                aria-label="Timesheets pagination"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-500">
                  {paginationSummary}
                </span>
                {pageInfo.total_pages > 1 && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="text-xs sm:text-sm font-medium text-slate-500">
                      Page {page} of {pageInfo.total_pages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pageInfo.total_pages, p + 1))}
                      disabled={page >= pageInfo.total_pages}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </nav>
            )}
          </div>
        )}
      </div>

      {isLogOpen && (
        <LogHoursModal
          projects={activeProjects}
          onClose={() => setIsLogOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {editingLog && (
        <EditLogModal
          log={editingLog}
          project={editingProject}
          onClose={() => setEditingLog(null)}
          onSubmit={handleEditSubmit}
        />
      )}
    </DashboardLayout>
  );
}
