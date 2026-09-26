// Group returned daily rows into project/week summaries for display only.

const DAY_MS = 24 * 60 * 60 * 1000;

// Find the week's Monday in UTC so local timezones cannot shift calendar dates.
export function getWeekStart(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date.getTime() - diffToMonday * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

export function getWeekEnd(weekStartStr) {
  const monday = new Date(`${weekStartStr}T00:00:00Z`);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return sunday.toISOString().slice(0, 10);
}

function emptyTotals() {
  return { total: 0, approved: 0, pending: 0, rejected: 0 };
}

// Accumulate mutually exclusive status totals without counting a log twice.
function addToTotals(totals, log) {
  const hours = Number(log.hours_logged) || 0;
  totals.total += hours;
  if (log.status === "APPROVED") totals.approved += hours;
  else if (log.status === "DRAFT" || log.status === "SUBMITTED") totals.pending += hours;
  else if (log.status === "REJECTED") totals.rejected += hours;
}

// Order projects by name, then their calendar weeks and daily logs newest first.
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
