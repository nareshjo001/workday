import apiClient from "./apiClient";

// Browse projects and staffing requirements within the vendor's authorized scope.
async function listAvailableProjects(params = {}) {
  const { data } = await apiClient.get("/vendor/projects", { params });
  return data;
}

async function getProjectDetail(projectId) {
  const { data } = await apiClient.get(`/vendor/projects/${projectId}/requirements`);
  return data;
}

// List the vendor's eligible contractors for one project requirement.
async function getEligibleContractors(projectId, requirementId) {
  const { data } = await apiClient.get(
    `/vendor/projects/${projectId}/requirements/${requirementId}/eligible-contractors`
  );
  return data;
}

export default { listAvailableProjects, getProjectDetail, getEligibleContractors };
