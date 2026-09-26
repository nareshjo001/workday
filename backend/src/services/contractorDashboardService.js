const contractorRepository = require("../repositories/contractorRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const dashboardRepository = require("../repositories/dashboardRepository");
const { pool } = require('../config/db');

// Resolve the authenticated contractor once and reuse their timesheets for dashboard aggregates.

// Bucket ISO work dates by their Monday in UTC.
function isoWeekStart(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

async function getContractorDashboard(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    // Return an empty dashboard when the authenticated account has no contractor record.
    return emptyDashboard();
  }

  const [activeProjectsRaw, timesheets, m20] = await Promise.all([
    dashboardRepository.listActiveProjectsForContractor(contractor.id),
    timesheetRepository.listByContractor(contractor.id),
    contractorM20(contractor.id),
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

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let totalSubmittedHours = 0;
  let totalApprovedHours = 0;
  const approvedByWeek = new Map();
  for (const t of timesheets) {
    totalSubmittedHours += t.hours_logged;
    if (t.status === "DRAFT" || t.status === "SUBMITTED") pending += 1;
    else if (t.status === "APPROVED") {
      approved += 1;
      totalApprovedHours += t.hours_logged;
      const weekStart = isoWeekStart(t.work_date);
      approvedByWeek.set(weekStart, (approvedByWeek.get(weekStart) || 0) + t.hours_logged);
    } else if (t.status === "REJECTED") rejected += 1;
  }

  // Limit the chart to 12 approved-work weeks while retaining lifetime totals in the summary.
  const hoursTrend = Array.from(approvedByWeek.entries())
    .map(([week, hours]) => ({ period: week, hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .slice(-12);

  return {
    summary: {
      total_approved_hours: Math.round(totalApprovedHours * 100) / 100,
    },
    active_projects: activeProjects,
    hours_trend: hoursTrend,
    timesheet_summary: {
      pending,
      approved,
      rejected,
      total_submitted_hours: Math.round(totalSubmittedHours * 100) / 100,
    },
    m20,
  };
}

async function contractorM20(contractorId) {
  const [[assignments]] = await pool.query(`SELECT
    COALESCE(SUM(pa.status='ACTIVE' AND (pa.start_date IS NULL OR pa.start_date<=CURDATE()) AND (pa.end_date IS NULL OR pa.end_date>=CURDATE())),0) active_assignments,
    COALESCE(SUM(pa.start_date>CURDATE()),0) upcoming_assignments,
    COALESCE(SUM(pa.allocated_hours),0) allocated_hours
    FROM project_assignments pa WHERE pa.contractor_id=?`, [contractorId]);
  const [[timesheets]] = await pool.query(`SELECT COALESCE(SUM(status IN ('SUBMITTED','APPROVED')),0) submitted_count,COALESCE(SUM(CASE WHEN status='SUBMITTED' THEN hours_logged ELSE 0 END),0) submitted_hours,COALESCE(SUM(CASE WHEN status='APPROVED' THEN hours_logged ELSE 0 END),0) approved_hours,COALESCE(SUM(status='REJECTED'),0) rejected_action_items FROM timesheets WHERE contractor_id=?`, [contractorId]);
  const [[compliance]] = await pool.query(`SELECT COALESCE(SUM(status='VERIFIED' AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 30 DAY)),0) expiring_documents FROM contractor_documents WHERE contractor_id=?`, [contractorId]);
  return { assignments:Object.fromEntries(Object.entries(assignments).map(([k,v])=>[k,Number(v)])), timesheets:Object.fromEntries(Object.entries(timesheets).map(([k,v])=>[k,Number(v)])), compliance:{ expiring_documents:Number(compliance.expiring_documents) } };
}

function emptyDashboard() {
  return {
    summary: { total_approved_hours: 0 },
    active_projects: [],
    hours_trend: [],
    timesheet_summary: { pending: 0, approved: 0, rejected: 0, total_submitted_hours: 0 },
    m20: { assignments: { active_assignments: 0, upcoming_assignments: 0, allocated_hours: 0 }, timesheets: { submitted_count: 0, submitted_hours: 0, approved_hours: 0, rejected_action_items: 0 }, compliance: { expiring_documents: 0 } },
  };
}

module.exports = { getContractorDashboard };
