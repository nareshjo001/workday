import apiClient from "./apiClient";

// Use session-derived PM identity for project management requests.

async function listProjects(params = {}) {
  const { data } = await apiClient.get("/pm/projects", { params });
  return data;
}

// Translate requirements to API field names while deriving company ownership server-side.
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

// Complete the owned project and release its active assignments server-side.
async function completeProject(projectId) {
  const { data } = await apiClient.patch(`/pm/projects/${projectId}/complete`);
  return data;
}
async function getCloseReadiness(projectId) { const { data } = await apiClient.get(`/pm/projects/${projectId}/close-readiness`); return data; }
async function updateProject(projectId, payload) { const { data } = await apiClient.patch(`/pm/projects/${projectId}`, payload); return data; }
async function updateRequirement(projectId, requirementId, payload) { const { data } = await apiClient.patch(`/pm/projects/${projectId}/requirements/${requirementId}`, payload); return data; }

async function listAssignedContractors(projectId) {
  const { data } = await apiClient.get(`/pm/projects/${projectId}/contractors`);
  return data;
}

// Request a PM-owned allocation change for an existing assignment.
async function updateContractorAllocation(projectId, contractorId, allocatedHours) {
  const { data } = await apiClient.patch(`/pm/projects/${projectId}/contractors/${contractorId}/allocation`, {
    allocated_hours: allocatedHours,
  });
  return data;
}

async function releaseContractor(projectId, contractorId, { actualEndDate, reason }) {
  const { data } = await apiClient.patch(`/pm/projects/${projectId}/contractors/${contractorId}/release`, {
    actual_end_date: actualEndDate,
    reason,
  });
  return data;
}

export default {
  listProjects,
  createProject,
  listAssignedContractors,
  completeProject,
  getCloseReadiness,
  updateProject,
  updateRequirement,
  updateContractorAllocation,
  releaseContractor,
};
