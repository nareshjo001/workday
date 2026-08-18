import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import ProjectStaffingCard from "../components/projects/ProjectStaffingCard";
import ProjectTeamModal from "../components/projects/ProjectTeamModal";
import AssignContractorModal from "../components/projects/AssignContractorModal";
import vendorProjectService from "../services/vendorProjectService";
import vendorAssignmentService from "../services/vendorAssignmentService";

/**
 * Vendor's project-staffing screen: browse projects open for staffing,
 * drill into one to see its per-skill requirements, and atomically assign
 * one or more compatible, unassigned-elsewhere contractors to an open
 * requirement (vendor-centric workflow revision).
 *
 * There is still no vendor_projects ownership relationship (MVP
 * decision, see report) — every Vendor sees the same staffing-available
 * project list — but which CONTRACTORS they may assign is scoped to
 * their own, both here in the UI (the eligible-contractors endpoint is
 * vendor-scoped) and enforced again server-side.
 */
export default function VendorAssignmentsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [selectedProject, setSelectedProject] = useState(null);
  const [assigningRequirement, setAssigningRequirement] = useState(null);
  const [pickerContractors, setPickerContractors] = useState([]);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerLoadError, setPickerLoadError] = useState(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorProjectService.listAvailableProjects();
      setProjects(data);
      return data;
    } catch (err) {
      setLoadError(err.message);
      return [];
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

  const handleViewTeam = async (project) => {
    // Re-fetch the single project's detail rather than reusing the list
    // row — this is the freshest possible staffing snapshot right before
    // the Vendor drills into requirements/assignment.
    try {
      const detail = await vendorProjectService.getProjectDetail(project.id);
      setSelectedProject(detail);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleAssignRequirement = async (requirement) => {
    setAssigningRequirement(requirement);
    setIsPickerLoading(true);
    setPickerLoadError(null);
    try {
      const data = await vendorProjectService.getEligibleContractors(
        selectedProject.id,
        requirement.id
      );
      setPickerContractors(data.eligible_contractors);
    } catch (err) {
      setPickerLoadError(err.message);
    } finally {
      setIsPickerLoading(false);
    }
  };

  const handleAssign = async (contractorIds) => {
    await vendorAssignmentService.assignContractors(
      selectedProject.id,
      assigningRequirement.id,
      contractorIds
    );

    // Re-fetch so every card/requirement reflects the true server-side
    // count — a local optimistic increment could drift if, say, another
    // vendor filled a slot in between.
    const [refreshedList, refreshedDetail] = await Promise.all([
      loadProjects(),
      vendorProjectService.getProjectDetail(selectedProject.id),
    ]);
    void refreshedList;
    setSelectedProject(refreshedDetail);
    setAssigningRequirement(null);
    setSuccessMessage(
      `${contractorIds.length} contractor${contractorIds.length === 1 ? "" : "s"} assigned successfully.`
    );
  };

  return (
    <DashboardLayout title="Assign Contractors to Projects">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Projects Open for Staffing</h1>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading projects…" />
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No projects are currently open for staffing.</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Check back once a Project Manager creates a new project, or once one reopens.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map((project) => (
              <ProjectStaffingCard key={project.id} project={project} onViewTeam={handleViewTeam} />
            ))}
          </div>
        )}
      </div>

      {selectedProject && (
        <ProjectTeamModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onAssignRequirement={handleAssignRequirement}
        />
      )}

      {assigningRequirement && selectedProject && (
        <AssignContractorModal
          project={selectedProject}
          requirement={assigningRequirement}
          contractors={pickerContractors}
          isLoading={isPickerLoading}
          loadError={pickerLoadError}
          onClose={() => setAssigningRequirement(null)}
          onAssign={handleAssign}
        />
      )}
    </DashboardLayout>
  );
}
