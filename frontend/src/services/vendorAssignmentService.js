import apiClient from "./apiClient";

// Submit candidates without allocation values; PM acceptance and allocation remain separate operations.
async function submitCandidates(projectId, requirementId, contractorIds, dates = {}) {
  return Promise.all(contractorIds.map(async (contractorId) => (await apiClient.post(`/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, { contractor_id: contractorId, start_date: dates.startDate || undefined, end_date: dates.endDate || undefined })).data));
}

export default { submitCandidates };
