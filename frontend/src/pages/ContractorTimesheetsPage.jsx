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

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [timesheetData, projectData] = await Promise.all([
        contractorTimesheetService.listMyTimesheets(),
        contractorProjectService.listAssignedProjects(),
      ]);
      setTimesheets(timesheetData);
      setAssignedProjects(projectData);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        (p) => p.status === "ACTIVE" && (p.assignment_status === undefined || p.assignment_status === "ACTIVE")
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
    const updated = await contractorTimesheetService.updateTimesheet(editingLog.id, payload);
    setTimesheets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingLog(null);
    setSuccessMessage(`Resubmitted ${updated.hours_logged} hours for "${updated.project_name}".`);
  };

  return (
    <DashboardLayout title="Timesheets">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Timesheets</h1>
          <PrimaryButton type="button" fullWidth={false} onClick={() => setIsLogOpen(true)}>
            + Log Hours
          </PrimaryButton>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading your timesheets…" />
        ) : groupedProjects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No timesheets logged yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Log your hours against a project you're assigned to, and your PM will review them.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            {groupedProjects.map((project) => (
              <ProjectTimesheetGroup
                key={project.project_id}
                project={project}
                allocation={allocationByProjectId.get(project.project_id)}
                onEdit={setEditingLog}
              />
            ))}
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
