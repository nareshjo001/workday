import apiClient from "./apiClient";

/**
 * Vendor's contractor-management API. Built on the shared apiClient, same
 * as authService — the JWT is attached automatically by apiClient's
 * request interceptor, so nothing here ever needs to read the token or
 * pass a vendor id explicitly. The backend derives the vendor from the
 * token on every call.
 */

/**
 * `skill` (optional) narrows the list to contractors with that primary
 * skill — used by the requirement-specific assignment picker (see
 * VendorAssignmentsPage) so only compatible contractors are offered.
 * Still scoped to this vendor's own contractors server-side regardless.
 */
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
