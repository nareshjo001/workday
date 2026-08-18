import apiClient from "./apiClient";

/**
 * Contractor's read-only view of their assigned projects. No id of any
 * kind is ever passed — the backend derives the contractor from the JWT.
 */
async function listAssignedProjects() {
  const { data } = await apiClient.get("/contractor/projects");
  return data;
}

export default { listAssignedProjects };
