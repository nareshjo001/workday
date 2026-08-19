const dashboardRepository = require("../repositories/dashboardRepository");
const pmProjectService = require("./pmProjectService");

/**
 * PM dashboard/analytics (UI + analytics redesign). Read-only. `pmId` is
 * always `req.user.userId` off the JWT — this file never accepts a PM id
 * as a parameter, so there is no way to ask for another PM's dashboard.
 *
 * Reuses pmProjectService.listProjects(pmId) — the EXISTING, already-
 * ownership-scoped, already-progress-computed project list (same
 * function GET /api/pm/projects calls) — for every project-shaped figure
 * this dashboard needs (project counts, staffing status, hours progress,
 * completion analytics), rather than re-deriving progress a second way.
 * Only the aggregations that function genuinely can't provide in one
 * call (distinct active-contractor count, milestone status counts,
 * invoice status counts, the activity feed) come from the new
 * dashboardRepository.js.
 */

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Days between two ISO 'YYYY-MM-DD' date strings (b - a), via UTC epoch
 * math — used only for the "approaching end date" window below, a
 * display/analytics figure, not a business-rule gate (contrast with
 * contractorTimesheetService's date-window enforcement, which this does
 * not touch).
 */
function daysBetween(aIso, bIso) {
  const a = Date.UTC(...aIso.split("-").map(Number));
  const b = Date.UTC(...bIso.split("-").map(Number));
  return Math.round((b - a) / 86400000);
}

async function getPmDashboard(pmId) {
  const [projects, activeContractors, milestoneStatusCounts, milestonesWithBilling, invoiceStatusCounts, recentActivity] =
    await Promise.all([
      pmProjectService.listProjects(pmId),
      dashboardRepository.countActiveContractorsForPm(pmId),
      dashboardRepository.milestoneStatusCountsForPm(pmId),
      dashboardRepository.milestonesWithBillingCountForPm(pmId),
      dashboardRepository.invoiceStatusCountsForPm(pmId),
      dashboardRepository.listRecentActivityForPm(pmId, 15),
    ]);

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const completedProjects = projects.filter((p) => p.status === "COMPLETED");
  const pendingStaffingProjects = activeProjects.filter((p) => p.staffing_status === "PENDING");

  // Overall progress across ACTIVE projects: sum-of-hours (not
  // average-of-percentages), same "aggregate the raw hours, then divide
  // once" approach as every other progress figure in this codebase —
  // only projects with expected_hours set participate (legacy projects
  // with no expected_hours have nothing to divide by).
  const activeWithHours = activeProjects.filter((p) => p.expected_hours !== null && p.expected_hours > 0);
  const activeApprovedSum = activeWithHours.reduce((sum, p) => sum + p.approved_hours, 0);
  const activeExpectedSum = activeWithHours.reduce((sum, p) => sum + p.expected_hours, 0);
  const overallProgressPercent =
    activeExpectedSum > 0 ? Math.min(100, Math.round((activeApprovedSum / activeExpectedSum) * 1000) / 10) : null;

  // Completion analytics.
  const completedWithHours = completedProjects.filter((p) => p.expected_hours !== null && p.expected_hours > 0);
  const avgCompletionPercent =
    completedWithHours.length > 0
      ? Math.round(
          (completedWithHours.reduce((sum, p) => sum + Math.min(100, p.work_progress_percent ?? 0), 0) /
            completedWithHours.length) *
            10
        ) / 10
      : null;

  const today = todayDateString();
  // "Approaching end date": ACTIVE, has an end_date, within the next 14
  // days (inclusive). "Past end date, still ACTIVE": a real, honest fact
  // derived from two existing columns (end_date, status) — NOT a
  // fabricated "OVERDUE" lifecycle state, since projects.status has no
  // such value and nothing in this codebase auto-transitions a project
  // when its end_date passes (see pmProjectController.complete — a PM
  // always completes a project explicitly). Reported as its own labeled
  // figure rather than invented status text, per the "don't invent
  // overdue logic the lifecycle doesn't support" instruction.
  const approachingEndDate = activeProjects.filter(
    (p) => p.end_date && daysBetween(today, p.end_date) >= 0 && daysBetween(today, p.end_date) <= 14
  );
  const pastEndDateStillActive = activeProjects.filter((p) => p.end_date && p.end_date < today);

  const milestonesByStatus = new Map(milestoneStatusCounts.map((r) => [r.status, r.count]));

  const invoicesByStatus = new Map(invoiceStatusCounts.map((r) => [r.status, r]));
  const approvedInvoiceCount =
    (invoicesByStatus.get("APPROVED")?.count || 0) + (invoicesByStatus.get("AUTO_APPROVED")?.count || 0);
  const approvedInvoiceTotal =
    (invoicesByStatus.get("APPROVED")?.total || 0) + (invoicesByStatus.get("AUTO_APPROVED")?.total || 0);

  return {
    summary: {
      active_projects: activeProjects.length,
      active_contractors: activeContractors,
      completed_projects: completedProjects.length,
      pending_staffing_projects: pendingStaffingProjects.length,
      overall_progress_percent: overallProgressPercent,
    },
    // Full per-project breakdown — reused as-is for BOTH "Project
    // Progress Overview" (every field) and "Hours Progress" (the
    // frontend filters to expected_hours-bearing ACTIVE rows), so the
    // exact same server-computed numbers back both sections.
    projects,
    milestones: {
      pending: milestonesByStatus.get("PENDING") || 0,
      met: milestonesByStatus.get("MET") || 0,
      with_billing_generated: milestonesWithBilling,
    },
    invoices: {
      pending_review_count: invoicesByStatus.get("PENDING_REVIEW")?.count || 0,
      approved_count: approvedInvoiceCount,
      approved_total: approvedInvoiceTotal,
      rejected_count: invoicesByStatus.get("REJECTED")?.count || 0,
      rejected_total: invoicesByStatus.get("REJECTED")?.total || 0,
      by_status: invoiceStatusCounts,
    },
    completion_analytics: {
      completed_projects: completedProjects.length,
      average_completion_percent: avgCompletionPercent,
      approaching_end_date_count: approachingEndDate.length,
      approaching_end_date: approachingEndDate.map((p) => ({ id: p.id, name: p.name, end_date: p.end_date })),
      past_end_date_still_active_count: pastEndDateStillActive.length,
      past_end_date_still_active: pastEndDateStillActive.map((p) => ({ id: p.id, name: p.name, end_date: p.end_date })),
    },
    recent_activity: recentActivity,
  };
}

module.exports = { getPmDashboard };
