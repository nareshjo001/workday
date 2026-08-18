import apiClient from "./apiClient";

/**
 * PM's project-management API. Built on the shared apiClient, same as
 * authService/vendorContractorService — the JWT is attached automatically,
 * so nothing here ever passes a pm id explicitly.
 */

async function listProjects() {
  const { data } = await apiClient.get("/pm/projects");
  return data;
}

/**
 * `requirements` is [{ skill, requiredCount }, ...] — translated to the
 * backend's { skill, required_count } shape here so page/component code
 * can stay in camelCase like the rest of the frontend.
 *
 * company_name is NO LONGER sent — a project's client company is derived
 * server-side from the creating PM's own company association (set at PM
 * signup), not typed per-project. See CreateProjectModal.
 *
 * `expectedHours` (project hours/allocation redesign) is the project's
 * total hours capacity, required for every new project — see
 * CreateProjectModal.
 */
async function createProject({ name, description, startDate, endDate, expectedHours, requirements }) {
  const { data } = await apiClient.post("/pm/projects", {
    name,
    description: description || undefined,
    start_date: startDate,
    end_date: endDate || undefined,
    expected_hours: expectedHours,
    requirements: requirements.map((r) => ({
      skill: r.skill,
      required_count: r.requiredCount,
    })),
  });
  return data;
}

/**
 * Marks one of the PM's own projects COMPLETED — project hours/
 * allocation redesign addition. Auto-releases every active assignment on
 * it server-side (see pmProjectService.completeProject on the backend);
 * returns { project, released_assignment_count }.
 */
async function completeProject(projectId) {
  const { data } = await apiClient.patch(`/pm/projects/${projectId}/complete`);
  return data;
}

/**
 * Contractors currently assigned to one of this PM's own projects —
 * Module 5 addition, now also powers the MVP fix 1 allocation UI (see
 * PmMilestonesPage's "Team on this project" section).
 */
async function listAssignedContractors(projectId) {
  const { data } = await apiClient.get(`/pm/projects/${projectId}/contractors`);
  return data;
}

/**
 * MVP fix 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"): sets/changes how many of the project's expected_hours a
 * specific, already-assigned contractor is allocated. Only the PM has
 * this control — the Vendor's assignment flow (see
 * vendorAssignmentService) never sends or sees an hours value at all.
 * Returns the updated contractor row (allocated/approved/pending/
 * remaining hours).
 */
async function updateContractorAllocation(projectId, contractorId, allocatedHours) {
  const { data } = await apiClient.patch(`/pm/projects/${projectId}/contractors/${contractorId}/allocation`, {
    allocated_hours: allocatedHours,
  });
  return data;
}

export default {
  listProjects,
  createProject,
  listAssignedContractors,
  completeProject,
  updateContractorAllocation,
};
