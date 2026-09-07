import apiClient from "./apiClient";

/**
 * Contractor's own timesheet API. Built on the shared apiClient, same as
 * contractorProjectService/pmProjectService — the JWT is attached
 * automatically, so nothing here ever passes a contractor id explicitly.
 *
 * GET /contractor/timesheets returns a flat list of DAILY rows (one row
 * per work_date, not per week) — see
 * components/timesheets/weekGrouping.js for how the page groups these
 * into the project -> week -> day view.
 */

async function listMyTimesheets(params = {}) {
  const { data } = await apiClient.get("/contractor/timesheets", { params });
  return data;
}

/**
 * `projectId`/`workDate`/`hoursLogged` only — there is no field for
 * status/reviewedBy/contractorId because the backend never reads those
 * from this request; they are always server-controlled.
 */
async function submitTimesheet({ projectId, workDate, hoursLogged, description }) {
  const { data } = await apiClient.post("/contractor/timesheets", {
    projectId,
    workDate,
    hoursLogged,
    description,
  });
  return data;
}

async function submitTimesheets(timesheetIds) {
  const { data } = await apiClient.post("/contractor/timesheets/submit", { timesheetIds });
  return data;
}

/**
 * Edits one of the contractor's own REJECTED daily logs — resubmits it
 * (status resets to PENDING server-side). `projectId` is never sent
 * here: it cannot change on an edit, see
 * contractorTimesheetValidators.validateEditTimesheet on the backend.
 */
async function updateTimesheet(timesheetId, { workDate, hoursLogged, description }) {
  const { data } = await apiClient.patch(`/contractor/timesheets/${timesheetId}`, {
    workDate,
    hoursLogged,
    description,
  });
  return data;
}

export default { listMyTimesheets, submitTimesheets, submitTimesheet, updateTimesheet };
