import apiClient from "./apiClient";


// Apply optional skill filters within the server-enforced vendor scope.
async function listContractors(params = {}) {
  const { data } = await apiClient.get("/vendor/contractors", {
    params,
  });
  return data;
}

async function createContractor({ name, email, hourlyRate }) {
  const { data } = await apiClient.post("/vendor/contractors", {
    name,
    email,
    hourly_rate: hourlyRate,
  });
  return data;
}

async function updateContractor(id, { hourlyRate, status }) {
  const body = {};
  if (hourlyRate !== undefined) body.hourly_rate = hourlyRate;
  if (status !== undefined) body.status = status;

  const { data } = await apiClient.patch(`/vendor/contractors/${id}`, body);
  return data;
}

async function getHistory(id) {
  const { data } = await apiClient.get(`/vendor/contractors/${id}/history`);
  return data.assignments;
}

async function getReleaseReadiness(projectId, contractorId) {
  const { data } = await apiClient.get(`/vendor/projects/${projectId}/contractors/${contractorId}/release-readiness`);
  return data;
}

async function release(projectId, contractorId, { actualEndDate, reason }) {
  const { data } = await apiClient.patch(`/vendor/projects/${projectId}/contractors/${contractorId}/release`, {
    actual_end_date: actualEndDate,
    reason,
  });
  return data;
}

export default { listContractors, createContractor, updateContractor, getHistory, getReleaseReadiness, release };
