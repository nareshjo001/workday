import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import ProjectTable from "../components/projects/ProjectTable";
import ProjectCardList from "../components/projects/ProjectCardList";
import contractorProjectService from "../services/contractorProjectService";

/**
 * Contractor's read-only view of their assigned projects. No id is ever
 * passed to the API — the backend derives the contractor from the JWT,
 * so there's nothing here for the contractor to tamper with even if they
 * wanted to.
 */
export default function ContractorProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await contractorProjectService.listAssignedProjects();
        setProjects(data);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout title="My Projects">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">My Projects</h1>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading your projects…" />
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No projects assigned yet.</p>
            <p className="max-w-sm text-sm text-muted">
              Your Vendor will assign you to a project — check back once you've been assigned.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <ProjectTable projects={projects} showId={false} />
            <ProjectCardList projects={projects} showId={false} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
