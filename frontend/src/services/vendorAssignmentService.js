import apiClient from "./apiClient";

/**
 * Vendor's project-assignment API. Replaces the old single-contractor
 * POST /vendor/assignments endpoint (Module 3 revision) with the
 * vendor-centric workflow revision's atomic multi-contractor assign:
 * one request assigns every selected contractor to one requirement in a
 * single all-or-nothing transaction.
 */
async function assignContractors(projectId, requirementId, contractorIds) {
  const { data } = await apiClient.post(
    `/vendor/projects/${projectId}/requirements/${requirementId}/assign`,
    { contractorIds }
  );
  return data;
}

export default { assignContractors };
