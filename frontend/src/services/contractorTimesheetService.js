import apiClient from "./apiClient";

// Fetch daily logs scoped to the authenticated contractor; the UI groups returned rows for display.

async function listMyTimesheets(params = {}) {
  const { data } = await apiClient.get("/contractor/timesheets", { params });
  return data;
}

// Send editable log fields only; ownership and review metadata remain server-controlled.
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

// Edit draft or rejected logs without changing their project; rejected corrections return to DRAFT.
async function updateTimesheet(timesheetId, { workDate, hoursLogged, description }) {
  const { data } = await apiClient.patch(`/contractor/timesheets/${timesheetId}`, {
    workDate,
    hoursLogged,
    description,
  });
  return data;
}

export default { listMyTimesheets, submitTimesheets, submitTimesheet, updateTimesheet };
