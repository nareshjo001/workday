import apiClient from "./apiClient";

// Use session-derived PM identity for timesheet review requests.

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
