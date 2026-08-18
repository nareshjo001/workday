/**
 * Pure grouping helpers that turn the flat list of daily timesheet rows
 * GET /api/contractor/timesheets returns into the project -> week -> day
 * hierarchy ContractorTimesheetsPage renders. The backend has no concept
 * of a "week" anywhere in the daily data model (see backend migration
 * 013 — one row is one day, work_date) — grouping by week, and summing
 * each week's Total/Approved/Pending/Rejected hours, is purely a display
 * computation done here, every time, from the daily rows currently in
 * state. Nothing computed in this file is ever sent back to the server
 * or treated as authoritative; it is recomputed on every render from
 * whatever the API most recently returned.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Monday that starts the week containing `dateStr` (a "YYYY-MM-DD"
 * string), returned the same way. Parsed/computed entirely in UTC so
 * this never drifts by a day depending on the browser's local timezone —
 * same convention the backend's date validators use for date-only
 * values (see contractorTimesheetValidators.js).
 */
export function getWeekStart(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date.getTime() - diffToMonday * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

/** The Sunday that ends the week started by `weekStartStr`. */
export function getWeekEnd(weekStartStr) {
  const monday = new Date(`${weekStartStr}T00:00:00Z`);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return sunday.toISOString().slice(0, 10);
}

function emptyTotals() {
  return { total: 0, approved: 0, pending: 0, rejected: 0 };
}

/**
 * approved/pending/rejected are mutually exclusive slices of total by
 * status (never double counted) — same "Approved excludes pending and
 * rejected" rule the Vendor Project Team view uses for
 * logged_hours/approved_hours (see backend assignmentRepository
 * .listAssignedContractorsWithHours).
 */
function addToTotals(totals, log) {
  const hours = Number(log.hours_logged) || 0;
  totals.total += hours;
  if (log.status === "APPROVED") totals.approved += hours;
  else if (log.status === "PENDING") totals.pending += hours;
  else if (log.status === "REJECTED") totals.rejected += hours;
}

/**
 * Groups a flat list of daily timesheet rows into:
 *   [{ project_id, project_name, weeks: [
 *     { weekStart, weekEnd, logs: [...], totals: {total, approved, pending, rejected} }
 *   ] }]
 * Projects are ordered by name; weeks within a project newest-first;
 * daily logs within a week newest-first — matching the newest-first
 * convention the flat (pre-revision) timesheet list always used.
 */
export function groupTimesheetsByProjectAndWeek(timesheets) {
  const projectMap = new Map();

  for (const log of timesheets) {
    if (!projectMap.has(log.project_id)) {
      projectMap.set(log.project_id, {
        project_id: log.project_id,
        project_name: log.project_name,
        weekMap: new Map(),
      });
    }
    const project = projectMap.get(log.project_id);

    const weekStart = getWeekStart(log.work_date);
    if (!project.weekMap.has(weekStart)) {
      project.weekMap.set(weekStart, {
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        logs: [],
        totals: emptyTotals(),
      });
    }
    const week = project.weekMap.get(weekStart);
    week.logs.push(log);
    addToTotals(week.totals, log);
  }

  const projects = Array.from(projectMap.values()).map((project) => {
    const weeks = Array.from(project.weekMap.values())
      .map((week) => ({
        ...week,
        logs: week.logs.slice().sort((a, b) => (a.work_date < b.work_date ? 1 : -1)),
      }))
      .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    return { project_id: project.project_id, project_name: project.project_name, weeks };
  });

  projects.sort((a, b) => a.project_name.localeCompare(b.project_name));
  return projects;
}
