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

// Submit staffing candidates within server-enforced project visibility and contractor eligibility.
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
      const data = await vendorProjectService.listAvailableProjects({ page, pageSize: 12, sort: "created_at", order: "desc" });
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
    // Refresh project detail before opening the staffing requirements.
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

    // Re-fetch staffing counts after submission to account for concurrent changes.
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
      <div className="vendor-projects-container mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4 sm:pb-5">
          <h1 className="text-xl sm:text-2xl font-medium text-slate-900 tracking-tight">
            Projects Open for Staffing
          </h1>
          <Link
            to="/vendor/staffing-pipeline"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground shadow-panel transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active"
          >
            Staffing Pipeline
          </Link>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading projects…" />
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center shadow-sm">
            <p className="font-medium text-text-secondary">No projects are currently open for staffing.</p>
            <p className="mt-1.5 max-w-sm mx-auto text-sm text-muted">
              Check back once a Project Manager creates a new project, or once one reopens.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div
              className="vendor-projects-grid grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6"
              data-testid="vendor-projects-grid"
            >
              {projects.map((project) => (
                <ProjectStaffingCard
                  key={project.id}
                  project={project}
                  onViewTeam={handleViewTeam}
                />
              ))}
            </div>
            <ListControls
              page={page}
              totalPages={pageInfo.total_pages}
              total={pageInfo.total}
              onPrevious={() => setPage((value) => value - 1)}
              onNext={() => setPage((value) => value + 1)}
            />
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
