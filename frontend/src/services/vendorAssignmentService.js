import apiClient from "./apiClient";

/**
 * Vendor candidate-submission adapter. The UI may submit several selected
 * contractors, but each candidate is independently reviewed by the PM;
 * only PM acceptance creates an assignment.
 *
 * MVP FIX 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"): `contractorIds` is a plain array of ids — there is no hours
 * value anywhere in this request. Allocating hours to an assigned
 * contractor is exclusively pmProjectService.updateContractorAllocation's
 * job through the PM-only allocation endpoint.
 */
async function submitCandidates(projectId, requirementId, contractorIds, dates = {}) {
  return Promise.all(contractorIds.map(async (contractorId) => (await apiClient.post(`/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, { contractor_id: contractorId, start_date: dates.startDate || undefined, end_date: dates.endDate || undefined })).data));
}

export default { submitCandidates };
