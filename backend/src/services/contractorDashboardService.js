const contractorRepository = require("../repositories/contractorRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const dashboardRepository = require("../repositories/dashboardRepository");

/**
 * Contractor dashboard/analytics (UI + analytics redesign). Read-only.
 * `userId` is always `req.user.userId` off the JWT — resolved to this
 * contractor's own contractors.id exactly like
 * contractorProjectService.listAssignedProjects /
 * contractorTimesheetService.listMyTimesheets, so there is no parameter
 * anywhere in this file that lets a caller ask for a different
 * contractor's dashboard.
 *
 * Reuses the EXISTING timesheetRepository.listByContractor (the same
 * call GET /api/contractor/timesheets already makes) for three derived
 * figures at once — timesheet status summary, total approved hours, and
 * the hours-trend chart — one fetch, three views of the same data,
 * rather than three separate queries or three separate frontend
 * re-derivations of the same list.
 */

/**
 * Monday (UTC) of the week containing an ISO 'YYYY-MM-DD' date string,
 * returned as its own 'YYYY-MM-DD' string — the bucket key for the hours
 * trend chart. Plain UTC epoch math, no reliance on the current date/time
 * (this is formatting historical timesheet data, not a "now" business
 * rule), so it's safe to compute per-row here.
 */
function isoWeekStart(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

async function getContractorDashboard(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    // Same "no contractor record looks like no data" stance as
    // contractorProjectService/contractorTimesheetService — an empty,
    // well-shaped dashboard rather than a 404 or a crash.
    return emptyDashboard();
  }

  const [activeProjectsRaw, lifetimeRevenue, revenueByProject, invoiceHistory, timesheets] = await Promise.all([
    dashboardRepository.listActiveProjectsForContractor(contractor.id),
    dashboardRepository.lifetimeRevenueForContractor(contractor.id),
    dashboardRepository.revenueByProjectForContractor(contractor.id),
    dashboardRepository.invoiceHistoryForContractor(contractor.id, 15),
    timesheetRepository.listByContractor(contractor.id),
  ]);

  const activeProjects = activeProjectsRaw.map((p) => {
    const workProgressPercent =
      p.expected_hours === null || p.expected_hours === 0
        ? null
        : Math.min(100, Math.round((p.project_approved_hours / p.expected_hours) * 1000) / 10);
    const remainingHours = p.allocated_hours === null ? null : Math.max(0, p.allocated_hours - p.my_approved_hours);
    return {
      id: p.id,
      name: p.name,
      company_name: p.company_name,
      expected_hours: p.expected_hours,
      allocated_hours: p.allocated_hours,
      my_approved_hours: p.my_approved_hours,
      remaining_hours: remainingHours,
      project_approved_hours: p.project_approved_hours,
      work_progress_percent: workProgressPercent,
    };
  });

  // Timesheet summary + total approved hours, from the one already-
  // fetched list.
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let totalSubmittedHours = 0;
  let totalApprovedHours = 0;
  const approvedByWeek = new Map();
  for (const t of timesheets) {
    totalSubmittedHours += t.hours_logged;
    if (t.status === "PENDING") pending += 1;
    else if (t.status === "APPROVED") {
      approved += 1;
      totalApprovedHours += t.hours_logged;
      const weekStart = isoWeekStart(t.work_date);
      approvedByWeek.set(weekStart, (approvedByWeek.get(weekStart) || 0) + t.hours_logged);
    } else if (t.status === "REJECTED") rejected += 1;
  }

  // Weekly hours trend, oldest -> newest, capped to the most recent 12
  // weeks with approved hours so the chart stays readable for a
  // long-tenured contractor without truncating silently — the frontend
  // is told the true total via timesheet_summary regardless of how many
  // trend points are shown.
  const hoursTrend = Array.from(approvedByWeek.entries())
    .map(([week, hours]) => ({ period: week, hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .slice(-12);

  return {
    summary: {
      lifetime_revenue: lifetimeRevenue,
      total_approved_hours: Math.round(totalApprovedHours * 100) / 100,
    },
    active_projects: activeProjects,
    highest_revenue_project: revenueByProject[0] || null,
    revenue_by_project: revenueByProject,
    hours_trend: hoursTrend,
    timesheet_summary: {
      pending,
      approved,
      rejected,
      total_submitted_hours: Math.round(totalSubmittedHours * 100) / 100,
    },
    invoice_history: invoiceHistory,
  };
}

function emptyDashboard() {
  return {
    summary: { lifetime_revenue: 0, total_approved_hours: 0 },
    active_projects: [],
    highest_revenue_project: null,
    revenue_by_project: [],
    hours_trend: [],
    timesheet_summary: { pending: 0, approved: 0, rejected: 0, total_submitted_hours: 0 },
    invoice_history: [],
  };
}

module.exports = { getContractorDashboard };
