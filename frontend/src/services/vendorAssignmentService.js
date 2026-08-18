import apiClient from "./apiClient";

/**
 * Vendor's project-assignment API. Replaces the old single-contractor
 * POST /vendor/assignments endpoint (Module 3 revision) with the
 * vendor-centric workflow revision's atomic multi-contractor assign:
 * one request assigns every selected contractor to one requirement in a
 * single all-or-nothing transaction.
 *
 * MVP FIX 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"): `contractorIds` is a plain array of ids — there is no hours
 * value anywhere in this request. Allocating hours to an assigned
 * contractor is exclusively pmProjectService.updateContractorAllocation's
 * job (a PM-only endpoint); the backend validator for THIS endpoint
 * (vendorAssignmentValidators.validateAssignContractors) never even
 * looks for an hours field, so sending one here would simply be ignored.
 */
async function assignContractors(projectId, requirementId, contractorIds) {
  const { data } = await apiClient.post(
    `/vendor/projects/${projectId}/requirements/${requirementId}/assign`,
    { contractorIds }
  );
  return data;
}

export default { assignContractors };
