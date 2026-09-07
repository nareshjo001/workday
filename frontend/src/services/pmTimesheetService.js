import apiClient from "./apiClient";

/**
 * PM's timesheet-review API. Built on the shared apiClient, same as
 * pmProjectService — the JWT is attached automatically, so nothing here
 * ever passes a pm id explicitly.
 */

async function listPending(params = {}) {
  const { data } = await apiClient.get("/pm/timesheets/pending", { params });
  return data;
}

async function reviewTimesheet(timesheetId, status, rejectionReason = null) {
  const { data } = await apiClient.patch(`/pm/timesheets/${timesheetId}`, { status, ...(rejectionReason ? { rejectionReason } : {}) });
  return data;
}

async function bulkReviewTimesheets(timesheetIds, status, rejectionReason = null) {
  const { data } = await apiClient.patch("/pm/timesheets/bulk-review", { timesheetIds, status, ...(rejectionReason ? { rejectionReason } : {}) });
  return data;
}

export default { listPending, reviewTimesheet, bulkReviewTimesheets };
