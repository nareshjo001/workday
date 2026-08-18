import apiClient from "./apiClient";

/**
 * Vendor's project-browsing API — projects currently open for staffing,
 * with requirement/staffing-progress data attached. Replaces the old
 * "ask the PM for a numeric ID" flow (see VendorAssignmentsPage).
 */
async function listAvailableProjects() {
  const { data } = await apiClient.get("/vendor/projects");
  return data;
}

/**
 * One project's detail (name/company/PM/dates/requirements with live
 * counts) — the screen a vendor lands on after clicking a project from
 * the browse list.
 */
async function getProjectDetail(projectId) {
  const { data } = await apiClient.get(`/vendor/projects/${projectId}/requirements`);
  return data;
}

/**
 * Contractors THIS vendor could assign to one specific requirement.
 * Returns { requirement, eligible_contractors }.
 */
async function getEligibleContractors(projectId, requirementId) {
  const { data } = await apiClient.get(
    `/vendor/projects/${projectId}/requirements/${requirementId}/eligible-contractors`
  );
  return data;
}

export default { listAvailableProjects, getProjectDetail, getEligibleContractors };
