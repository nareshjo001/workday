const dashboardRepository = require("../repositories/dashboardRepository");
const pmProjectService = require("./pmProjectService");
const auditActivityService = require("./auditActivityService");

// Build the authenticated PM's dashboard from ownership-scoped project and aggregation queries.

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// Compare ISO dates in UTC for dashboard date-window metrics.
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
      auditActivityService.pm(pmId, { page: 1, limit: 5 }),
    ]);

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const completedProjects = projects.filter((p) => p.status === "COMPLETED");
  const pendingStaffingProjects = activeProjects.filter((p) => p.staffing_status === "PENDING");

  // Weight progress by summed hours, excluding projects without a positive expected-hours target.
  const activeWithHours = activeProjects.filter((p) => p.expected_hours !== null && p.expected_hours > 0);
  const activeApprovedSum = activeWithHours.reduce((sum, p) => sum + p.approved_hours, 0);
  const activeExpectedSum = activeWithHours.reduce((sum, p) => sum + p.expected_hours, 0);
  const overallProgressPercent =
    activeExpectedSum > 0 ? Math.min(100, Math.round((activeApprovedSum / activeExpectedSum) * 1000) / 10) : null;

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
  // Report approaching and past end dates separately without inventing a lifecycle status.
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
    // Reuse server-computed project metrics across dashboard sections.
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
    recent_activity: recentActivity.items,
  };
}

module.exports = { getPmDashboard };
