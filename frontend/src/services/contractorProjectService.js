import apiClient from "./apiClient";

// List assignments for the authenticated contractor without sending an identity parameter.
async function listAssignedProjects() {
  const { data } = await apiClient.get("/contractor/projects");
  return data;
}

export default { listAssignedProjects };
