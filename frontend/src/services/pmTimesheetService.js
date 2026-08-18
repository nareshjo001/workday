import apiClient from "./apiClient";

/**
 * PM's timesheet-review API. Built on the shared apiClient, same as
 * pmProjectService — the JWT is attached automatically, so nothing here
 * ever passes a pm id explicitly.
 */

async function listPending() {
  const { data } = await apiClient.get("/pm/timesheets/pending");
  return data;
}

async function reviewTimesheet(timesheetId, status) {
  const { data } = await apiClient.patch(`/pm/timesheets/${timesheetId}`, { status });
  return data;
}

export default { listPending, reviewTimesheet };
