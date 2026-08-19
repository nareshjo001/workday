const dashboardRepository = require("../repositories/dashboardRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");

/**
 * Vendor dashboard/analytics (UI + analytics redesign). Read-only —
 * calls no mutating repository function anywhere in this file. `vendorId`
 * is always `req.user.userId` off the JWT, resolved by the controller —
 * this file never accepts a vendor id as a parameter from a request, so
 * there is no way to ask for another vendor's dashboard by supplying a
 * different id (see routes/vendorRoutes.js: this endpoint sits behind
 * the SAME `authenticate + authorizeRoles(VENDOR)` gate every other
 * vendor route already uses).
 *
 * Reuses the EXISTING generic sumAllocatedHoursForProjects /
 * sumApprovedHoursForProjects batch reads (already used by
 * pmProjectService/vendorProjectService) for the project-progress
 * numbers rather than duplicating that SQL — only the vendor-specific
 * aggregations (earnings, invoice counts, activity feed, "which
 * projects/contractors are this vendor's") are new, and all of that new
 * SQL lives in dashboardRepository.js, not here.
 */

/**
 * Same approved/expected -> percentage formula as
 * pmProjectService.toProjectView / vendorProjectService.toProjectView —
 * duplicated here rather than imported, matching this codebase's own
 * established "small pure-function duplication over a cross-service
 * import" convention (see e.g. deriveStaffingStatus, formatHours across
 * multiple files).
 */
function computeWorkProgressPercent(approvedHours, expectedHours) {
  if (expectedHours === null || expectedHours === undefined || expectedHours === 0) return null;
  return Math.min(100, Math.round((approvedHours / expectedHours) * 1000) / 10);
}

async function getVendorDashboard(vendorId) {
  const [
    activeProjects,
    activeContractors,
    completedProjects,
    totalEarnings,
    earningsByCompany,
    earningsByContractor,
    invoiceStatusCounts,
    projectsForProgress,
    recentActivity,
  ] = await Promise.all([
    dashboardRepository.countActiveProjectsForVendor(vendorId),
    dashboardRepository.countActiveContractorsForVendor(vendorId),
    dashboardRepository.countCompletedProjectsForVendor(vendorId),
    dashboardRepository.totalEarningsForVendor(vendorId),
    dashboardRepository.earningsByCompanyForVendor(vendorId),
    dashboardRepository.earningsByContractorForVendor(vendorId),
    dashboardRepository.invoiceStatusCountsForVendor(vendorId),
    dashboardRepository.listActiveProjectsForVendor(vendorId),
    dashboardRepository.listRecentActivityForVendor(vendorId, 15),
  ]);

  // Second pass: attach the same server-computed allocated/approved/
  // progress figures every other project view in this codebase carries —
  // one batched query for however many active projects this vendor has,
  // never N+1.
  const projectIds = projectsForProgress.map((p) => p.id);
  let projectProgress = [];
  if (projectIds.length > 0) {
    const [allocatedRows, approvedRows] = await Promise.all([
      assignmentRepository.sumAllocatedHoursForProjects(projectIds),
      timesheetRepository.sumApprovedHoursForProjects(projectIds),
    ]);
    const allocatedByProject = new Map(allocatedRows.map((r) => [r.project_id, r.allocated_hours]));
    const approvedByProject = new Map(approvedRows.map((r) => [r.project_id, r.approved_hours]));
    projectProgress = projectsForProgress.map((p) => {
      const allocatedHours = Number(allocatedByProject.get(p.id) || 0);
      const approvedHours = Number(approvedByProject.get(p.id) || 0);
      return {
        id: p.id,
        name: p.name,
        company_name: p.company_name,
        start_date: p.start_date,
        end_date: p.end_date,
        expected_hours: p.expected_hours,
        allocated_hours: allocatedHours,
        approved_hours: approvedHours,
        work_progress_percent: computeWorkProgressPercent(approvedHours, p.expected_hours),
      };
    });
  }

  // Invoice overview: pending vendor approvals / approved / rejected /
  // total invoiced (every status, since "invoiced" happens at generation
  // time regardless of review outcome — see dashboardRepository's own
  // comment on invoiceStatusCountsForVendor).
  const byStatus = new Map(invoiceStatusCounts.map((r) => [r.status, r]));
  const approvedCount = (byStatus.get("APPROVED")?.count || 0) + (byStatus.get("AUTO_APPROVED")?.count || 0);
  const approvedTotal = (byStatus.get("APPROVED")?.total || 0) + (byStatus.get("AUTO_APPROVED")?.total || 0);
  const totalInvoicedAmount = invoiceStatusCounts.reduce((sum, r) => sum + r.total, 0);

  return {
    summary: {
      active_projects: activeProjects,
      active_contractors: activeContractors,
      completed_projects: completedProjects,
      total_earnings: totalEarnings,
    },
    earnings_by_company: earningsByCompany,
    earnings_by_contractor: earningsByContractor,
    project_progress: projectProgress,
    invoices: {
      pending_review_count: byStatus.get("PENDING_REVIEW")?.count || 0,
      approved_count: approvedCount,
      approved_total: approvedTotal,
      rejected_count: byStatus.get("REJECTED")?.count || 0,
      rejected_total: byStatus.get("REJECTED")?.total || 0,
      total_invoiced_amount: totalInvoicedAmount,
      by_status: invoiceStatusCounts,
    },
    recent_activity: recentActivity,
  };
}

module.exports = { getVendorDashboard };
