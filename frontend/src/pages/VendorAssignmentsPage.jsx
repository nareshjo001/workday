import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import ProjectStaffingCard from "../components/projects/ProjectStaffingCard";
import ProjectTeamModal from "../components/projects/ProjectTeamModal";
import AssignContractorModal from "../components/projects/AssignContractorModal";
import vendorProjectService from "../services/vendorProjectService";
import vendorAssignmentService from "../services/vendorAssignmentService";
import ListControls from "../components/ListControls";

/**
 * Vendor's project-staffing screen: browse projects open for staffing,
 * drill into one to see its per-skill requirements, and submit one or
 * more eligible contractors for PM review. Both project visibility and
 * contractor eligibility are scoped and rechecked server-side.
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
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorProjectService.listAvailableProjects({ page, pageSize: 25, sort: "created_at", order: "desc" });
      setProjects(data.items);
      setPageInfo(data);
      return data;
    } catch (err) {
      setLoadError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [page]);

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

  const handleAssign = async (contractorIds, dates) => {
    await vendorAssignmentService.submitCandidates(
      selectedProject.id,
      assigningRequirement.id,
      contractorIds,
      dates
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
      `${contractorIds.length} candidate submission${contractorIds.length === 1 ? "" : "s"} sent to the Project Manager.`
    );
  };

  return (
    <DashboardLayout title="Source Candidates for Projects">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold text-text">Projects Open for Staffing</h1><Link to="/vendor/staffing-pipeline" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-muted">Staffing Pipeline</Link></div>

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
            <ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
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
