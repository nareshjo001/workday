const { pool } = require("../config/db");

/**
 * Read-only aggregation queries backing the three role dashboards
 * (Vendor/PM/Contractor UI + analytics redesign). Deliberately a BRAND
 * NEW file rather than additions to assignmentRepository.js/
 * timesheetRepository.js/milestoneRepository.js/invoiceRepository.js —
 * every existing repository, service, controller, and route in this
 * codebase is left completely untouched by this feature (see
 * dashboardService.js's top comment for the full "why a new file"
 * reasoning). Every query here is a pure SELECT — nothing in this file
 * ever writes, and nothing here is reachable except through the three
 * new GET /api/{vendor,pm,contractor}/dashboard routes, each already
 * gated by that router's existing `authenticate + authorizeRoles` — no
 * new RBAC logic was written for this feature, it reuses what's there.
 *
 * SQL-level aggregation (COUNT/SUM/GROUP BY) is used throughout rather
 * than fetching raw rows for the frontend (or even this file's own
 * caller) to reduce in JS, per the "avoid N+1, use backend aggregation
 * for financial metrics" requirement — the few exceptions are documented
 * at their call site in dashboardService.js (e.g. reusing an
 * already-necessary full timesheet/invoice list fetch for more than one
 * derived figure, rather than issuing a second query for each).
 */

// ============================================================
// VENDOR
// ============================================================

/**
 * Distinct projects where this vendor currently has at least one
 * ACTIVE-assignment contractor, AND the project itself is ACTIVE — the
 * literal reading of "Active Projects: number of currently active
 * projects involving this vendor's contractors." A project the vendor
 * once worked on that is now COMPLETED does not count here (see
 * countCompletedProjectsForVendor below for that).
 */
async function countActiveProjectsForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT pa.project_id) AS count
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN projects p ON p.id = pa.project_id
     WHERE c.vendor_id = ? AND pa.status = 'ACTIVE' AND p.status = 'ACTIVE'`,
    [vendorId]
  );
  return Number(rows[0].count);
}

/**
 * Distinct contractors of this vendor with a currently-ACTIVE assignment
 * on a currently-ACTIVE project — "Active Contractors: number of this
 * vendor's contractors currently assigned to active projects." Distinct
 * on contractor_id, so a contractor can never be double-counted (the
 * data model already guarantees at most one ACTIVE assignment per
 * contractor at a time — see migration 016's active_contractor_key — so
 * DISTINCT here is a defensive belt-and-suspenders, not load-bearing).
 */
async function countActiveContractorsForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT pa.contractor_id) AS count
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN projects p ON p.id = pa.project_id
     WHERE c.vendor_id = ? AND pa.status = 'ACTIVE' AND p.status = 'ACTIVE'`,
    [vendorId]
  );
  return Number(rows[0].count);
}

/**
 * Distinct COMPLETED projects this vendor ever had a contractor on
 * (ACTIVE or RELEASED — assignment rows are never deleted, see
 * assignmentRepository.releaseAllActiveForProject's own comment, so a
 * completed project's now-RELEASED assignment still counts here).
 */
async function countCompletedProjectsForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT pa.project_id) AS count
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN projects p ON p.id = pa.project_id
     WHERE c.vendor_id = ? AND p.status = 'COMPLETED'`,
    [vendorId]
  );
  return Number(rows[0].count);
}

/**
 * The vendor's currently-active projects (one row each), for the
 * "Project Progress" section — name/company/dates/expected_hours only;
 * the caller (dashboardService) combines this with the EXISTING generic
 * assignmentRepository.sumAllocatedHoursForProjects /
 * timesheetRepository.sumApprovedHoursForProjects (already used by
 * pmProjectService/vendorProjectService for the exact same
 * approved/expected -> progress% formula) rather than this file
 * reimplementing that math a third time.
 */
async function listActiveProjectsForVendor(vendorId) {
  // p.created_at is included in the SELECT DISTINCT list solely so the
  // ORDER BY below is valid: SQL requires every ORDER BY expression to
  // appear in the SELECT list whenever DISTINCT is used (otherwise,
  // which row's created_at should "win" once duplicate (id, name, ...)
  // rows collapse is ambiguous) — some servers enforce this strictly.
  // created_at is identical across every project_assignments row for a
  // given project, so including it doesn't change which rows DISTINCT
  // collapses. It's dropped by the caller's explicit field mapping
  // (vendorDashboardService.js), never surfaced to the API response.
  const [rows] = await pool.query(
    `SELECT DISTINCT p.id, p.name, COALESCE(cc.name, p.company_name) AS company_name,
            p.start_date, p.end_date, p.expected_hours, p.created_at
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN projects p ON p.id = pa.project_id
     LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
     LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
     WHERE c.vendor_id = ? AND pa.status = 'ACTIVE' AND p.status = 'ACTIVE'
     ORDER BY p.created_at DESC`,
    [vendorId]
  );
  return rows.map((r) => ({ ...r, expected_hours: r.expected_hours === null ? null : Number(r.expected_hours) }));
}

/**
 * Total APPROVED (i.e. vendor-approved, or the legacy AUTO_APPROVED
 * status — see invoiceService's FLAGGED DECISION comment) invoice amount
 * for this vendor's contractors — the business definition of "earned":
 * an invoice only reaches APPROVED after the vendor reviews it
 * (vendorInvoiceService.reviewInvoice); PENDING_REVIEW and REJECTED are
 * explicitly excluded, never counted as earned.
 */
async function totalEarningsForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM invoices WHERE vendor_id = ? AND status IN ('APPROVED', 'AUTO_APPROVED')`,
    [vendorId]
  );
  return Number(rows[0].total);
}

/**
 * Earned (APPROVED/AUTO_APPROVED) amount grouped by client company, for
 * "Highest Pay by Company" — highest first.
 */
async function earningsByCompanyForVendor(vendorId) {
  // Grouped via a derived subquery (rather than `GROUP BY <alias>` or
  // repeating the COALESCE expression in GROUP BY) so this is valid under
  // ONLY_FULL_GROUP_BY on both MySQL and MariaDB — some strict-mode
  // implementations still reject a GROUP BY that repeats a
  // COALESCE(...)-over-joined-columns expression verbatim, even though it
  // textually matches the SELECT list. Grouping by a plain projected
  // column from a derived table is the portable, universally-valid form.
  const [rows] = await pool.query(
    `SELECT company_name, SUM(amount) AS total
     FROM (
       SELECT i.amount, COALESCE(cc.name, p.company_name, 'Unknown') AS company_name
       FROM invoices i
       INNER JOIN projects p ON p.id = i.project_id
       LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
       LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
       WHERE i.vendor_id = ? AND i.status IN ('APPROVED', 'AUTO_APPROVED')
     ) earnings
     GROUP BY company_name
     ORDER BY total DESC`,
    [vendorId]
  );
  return rows.map((r) => ({ company_name: r.company_name, total: Number(r.total) }));
}

/**
 * Earned (APPROVED/AUTO_APPROVED) amount grouped by contractor, for
 * "Contractor Earnings Breakdown" — highest first.
 */
async function earningsByContractorForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT i.contractor_id, u.name AS contractor_name, SUM(i.amount) AS total
     FROM invoices i
     INNER JOIN contractors c ON c.id = i.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     WHERE i.vendor_id = ? AND i.status IN ('APPROVED', 'AUTO_APPROVED')
     GROUP BY i.contractor_id, u.name
     ORDER BY total DESC`,
    [vendorId]
  );
  return rows.map((r) => ({ contractor_id: r.contractor_id, contractor_name: r.contractor_name, total: Number(r.total) }));
}

/**
 * Invoice counts + amount totals grouped by status, for the "Invoice
 * Overview" KPI row (pending vendor approvals / approved / rejected /
 * total invoiced). EVERY status this vendor's invoices can be in is
 * included (not just APPROVED/AUTO_APPROVED) — "total invoiced" is
 * everything ever generated for this vendor, regardless of review
 * outcome, since that's the literal amount that has been invoiced.
 */
async function invoiceStatusCountsForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM invoices WHERE vendor_id = ? GROUP BY status`,
    [vendorId]
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
}

/**
 * Recent, real events for this vendor's own contractors/projects/
 * invoices — a UNION ALL across the exact event types the spec calls
 * out (contractor assigned, timesheet approved, milestone reached,
 * invoice generated, invoice approved/rejected), each producing a
 * uniform (type, message, occurred_at) row so they can be merged and
 * sorted in one pass. There is no dedicated activity/audit-log table in
 * this schema — this reconstructs a feed from the real timestamped
 * events already recorded on each underlying table, nothing fabricated.
 */
async function listRecentActivityForVendor(vendorId, limit) {
  const [rows] = await pool.query(
    `(SELECT 'ASSIGNED' AS type, CONCAT(u.name, ' assigned to ', p.name) AS message, pa.created_at AS occurred_at
      FROM project_assignments pa
      INNER JOIN contractors c ON c.id = pa.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN projects p ON p.id = pa.project_id
      WHERE c.vendor_id = ?)
     UNION ALL
     (SELECT 'TIMESHEET_APPROVED', CONCAT(u.name, ' — ', t.hours_logged, 'h approved on ', p.name), t.reviewed_at
      FROM timesheets t
      INNER JOIN contractors c ON c.id = t.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN projects p ON p.id = t.project_id
      WHERE c.vendor_id = ? AND t.status = 'APPROVED' AND t.reviewed_at IS NOT NULL)
     UNION ALL
     (SELECT 'MILESTONE_MET', CONCAT('Milestone "', m.name, '" reached on ', p.name), m.met_at
      FROM milestones m
      INNER JOIN projects p ON p.id = m.project_id
      WHERE m.status = 'MET' AND m.met_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM project_assignments pa2
          INNER JOIN contractors c2 ON c2.id = pa2.contractor_id
          WHERE pa2.project_id = p.id AND c2.vendor_id = ?
        ))
     UNION ALL
     (SELECT 'INVOICE_GENERATED', CONCAT('Invoice generated for ', u.name, ' — ', p.name), i.generated_at
      FROM invoices i
      INNER JOIN projects p ON p.id = i.project_id
      INNER JOIN contractors c ON c.id = i.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE i.vendor_id = ?)
     UNION ALL
     (SELECT IF(i.status = 'REJECTED', 'INVOICE_REJECTED', 'INVOICE_APPROVED'),
             CONCAT('Invoice ', LOWER(i.status), ' for ', u.name, ' — ', p.name), i.reviewed_at
      FROM invoices i
      INNER JOIN projects p ON p.id = i.project_id
      INNER JOIN contractors c ON c.id = i.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE i.vendor_id = ? AND i.reviewed_at IS NOT NULL AND i.status IN ('APPROVED', 'REJECTED'))
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [vendorId, vendorId, vendorId, vendorId, vendorId, Number(limit)]
  );
  return rows;
}

// ============================================================
// PM
// ============================================================

/**
 * Distinct contractors currently ACTIVE-assigned across this PM's own
 * ACTIVE projects — "Active Contractors: avoid double-counting
 * contractors if the data model guarantees uniqueness" (it does — at
 * most one ACTIVE assignment per contractor, see migration 016 — DISTINCT
 * here is defensive, same rationale as countActiveContractorsForVendor).
 */
async function countActiveContractorsForPm(pmId) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT pa.contractor_id) AS count
     FROM project_assignments pa
     INNER JOIN projects p ON p.id = pa.project_id
     WHERE p.pm_id = ? AND pa.status = 'ACTIVE' AND p.status = 'ACTIVE'`,
    [pmId]
  );
  return Number(rows[0].count);
}

/**
 * Milestone counts grouped by status, across every one of this PM's own
 * projects — "Milestone Overview: pending / met" KPIs. There is no
 * "upcoming" concept distinct from PENDING in this schema (a milestone
 * has a threshold_hours, not a due date — see milestones table,
 * migration 014/016), so this deliberately does not invent a third
 * bucket; see dashboardService.js for how PENDING is surfaced.
 */
async function milestoneStatusCountsForPm(pmId) {
  const [rows] = await pool.query(
    `SELECT m.status, COUNT(*) AS count
     FROM milestones m
     INNER JOIN projects p ON p.id = m.project_id
     WHERE p.pm_id = ?
     GROUP BY m.status`,
    [pmId]
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

/**
 * Distinct milestones (of this PM's projects) that have at least one
 * billing contribution row — "milestones with billing generated."
 */
async function milestonesWithBillingCountForPm(pmId) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT b.milestone_id) AS count
     FROM milestone_billings b
     INNER JOIN milestones m ON m.id = b.milestone_id
     INNER JOIN projects p ON p.id = m.project_id
     WHERE p.pm_id = ?`,
    [pmId]
  );
  return Number(rows[0].count);
}

/**
 * Invoice counts + amount totals grouped by status, across every one of
 * this PM's own projects — same shape/reasoning as
 * invoiceStatusCountsForVendor above (PM's "Invoice Overview": pending
 * review / approved / rejected / total approved billing).
 */
async function invoiceStatusCountsForPm(pmId) {
  const [rows] = await pool.query(
    `SELECT i.status, COUNT(*) AS count, COALESCE(SUM(i.amount), 0) AS total
     FROM invoices i
     INNER JOIN projects p ON p.id = i.project_id
     WHERE p.pm_id = ?
     GROUP BY i.status`,
    [pmId]
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
}

/**
 * Same shape/reasoning as listRecentActivityForVendor above, scoped to
 * projects owned by this PM instead of a vendor's contractors — the PM
 * spec's example list additionally calls out "Timesheet submitted" (not
 * just approved/rejected), so that event type is included here but not
 * in the vendor version, matching each role's own stated examples.
 */
async function listRecentActivityForPm(pmId, limit) {
  const [rows] = await pool.query(
    `(SELECT 'ASSIGNED' AS type, CONCAT(u.name, ' assigned to ', p.name) AS message, pa.created_at AS occurred_at
      FROM project_assignments pa
      INNER JOIN projects p ON p.id = pa.project_id
      INNER JOIN contractors c ON c.id = pa.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE p.pm_id = ?)
     UNION ALL
     (SELECT 'TIMESHEET_SUBMITTED', CONCAT(u.name, ' submitted ', t.hours_logged, 'h on ', p.name), t.submitted_at
      FROM timesheets t
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN contractors c ON c.id = t.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE p.pm_id = ?)
     UNION ALL
     (SELECT IF(t.status = 'REJECTED', 'TIMESHEET_REJECTED', 'TIMESHEET_APPROVED'),
             CONCAT(u.name, ' — ', t.hours_logged, 'h ', LOWER(t.status), ' on ', p.name), t.reviewed_at
      FROM timesheets t
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN contractors c ON c.id = t.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE p.pm_id = ? AND t.status IN ('APPROVED', 'REJECTED') AND t.reviewed_at IS NOT NULL)
     UNION ALL
     (SELECT 'MILESTONE_MET', CONCAT('Milestone "', m.name, '" reached on ', p.name), m.met_at
      FROM milestones m
      INNER JOIN projects p ON p.id = m.project_id
      WHERE p.pm_id = ? AND m.status = 'MET' AND m.met_at IS NOT NULL)
     UNION ALL
     (SELECT 'INVOICE_GENERATED', CONCAT('Invoice generated for ', u.name, ' — ', p.name), i.generated_at
      FROM invoices i
      INNER JOIN projects p ON p.id = i.project_id
      INNER JOIN contractors c ON c.id = i.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE p.pm_id = ?)
     UNION ALL
     (SELECT IF(i.status = 'REJECTED', 'INVOICE_REJECTED', 'INVOICE_APPROVED'),
             CONCAT('Invoice ', LOWER(i.status), ' for ', u.name, ' — ', p.name), i.reviewed_at
      FROM invoices i
      INNER JOIN projects p ON p.id = i.project_id
      INNER JOIN contractors c ON c.id = i.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE p.pm_id = ? AND i.reviewed_at IS NOT NULL AND i.status IN ('APPROVED', 'REJECTED'))
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [pmId, pmId, pmId, pmId, pmId, pmId, Number(limit)]
  );
  return rows;
}

// ============================================================
// CONTRACTOR
// ============================================================

/**
 * This contractor's currently-ACTIVE assignment(s) — in practice at most
 * one, per the existing one-active-assignment-at-a-time constraint
 * (migration 016), but this returns an array and the caller does not
 * assume length <= 1, per the spec's explicit "if the system allows
 * multiple active projects, display all" instruction. Each row carries
 * BOTH this contractor's own approved hours on the project AND the
 * project-WIDE approved hours (every contractor combined) via a
 * correlated subquery, so "Current Project Progress" (project-level:
 * approved/expected) and this contractor's own remaining-allocation
 * figures can both be shown without a second query or a second
 * progress-calculation formula living in the frontend.
 */
async function listActiveProjectsForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, COALESCE(cc.name, p.company_name) AS company_name,
            p.expected_hours, pa.allocated_hours,
            (SELECT COALESCE(SUM(t2.hours_logged), 0) FROM timesheets t2
              WHERE t2.project_id = p.id AND t2.status = 'APPROVED') AS project_approved_hours,
            (SELECT COALESCE(SUM(t3.hours_logged), 0) FROM timesheets t3
              WHERE t3.project_id = p.id AND t3.contractor_id = pa.contractor_id AND t3.status = 'APPROVED') AS my_approved_hours
     FROM project_assignments pa
     INNER JOIN projects p ON p.id = pa.project_id
     LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
     LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
     WHERE pa.contractor_id = ? AND pa.status = 'ACTIVE'
     ORDER BY pa.created_at DESC`,
    [contractorId]
  );
  return rows.map((r) => ({
    ...r,
    expected_hours: r.expected_hours === null ? null : Number(r.expected_hours),
    allocated_hours: r.allocated_hours === null ? null : Number(r.allocated_hours),
    project_approved_hours: Number(r.project_approved_hours),
    my_approved_hours: Number(r.my_approved_hours),
  }));
}

/**
 * This contractor's earned (APPROVED/AUTO_APPROVED) amount grouped by
 * project — "Revenue by Project" / "Highest Revenue Project."
 */
async function revenueByProjectForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT i.project_id, p.name AS project_name, SUM(i.amount) AS total
     FROM invoices i
     INNER JOIN projects p ON p.id = i.project_id
     WHERE i.contractor_id = ? AND i.status IN ('APPROVED', 'AUTO_APPROVED')
     GROUP BY i.project_id, p.name
     ORDER BY total DESC`,
    [contractorId]
  );
  return rows.map((r) => ({ project_id: r.project_id, project_name: r.project_name, total: Number(r.total) }));
}

/**
 * This contractor's lifetime earned (APPROVED/AUTO_APPROVED only —
 * PENDING_REVIEW/REJECTED never count as earned) amount — "Lifetime
 * Revenue Earned."
 */
async function lifetimeRevenueForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM invoices WHERE contractor_id = ? AND status IN ('APPROVED', 'AUTO_APPROVED')`,
    [contractorId]
  );
  return Number(rows[0].total);
}

/**
 * This contractor's own invoice/billing history — project, hours,
 * amount, status, date — newest first, capped at `limit` rows (a
 * dashboard history panel, not the full audit record).
 */
async function invoiceHistoryForContractor(contractorId, limit) {
  const [rows] = await pool.query(
    `SELECT i.id, i.project_id, p.name AS project_name, m.id AS milestone_id, m.name AS milestone_name,
            b.approved_hours, i.amount, i.status, i.generated_at
     FROM invoices i
     INNER JOIN projects p ON p.id = i.project_id
     INNER JOIN milestone_billings b ON b.id = i.milestone_billing_id
     INNER JOIN milestones m ON m.id = b.milestone_id
     WHERE i.contractor_id = ?
     ORDER BY i.generated_at DESC
     LIMIT ?`,
    [contractorId, Number(limit)]
  );
  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    project_name: r.project_name,
    milestone_id: r.milestone_id,
    milestone_name: r.milestone_name,
    hours: Number(r.approved_hours),
    amount: Number(r.amount),
    status: r.status,
    generated_at: r.generated_at,
  }));
}

module.exports = {
  // Vendor
  countActiveProjectsForVendor,
  countActiveContractorsForVendor,
  countCompletedProjectsForVendor,
  listActiveProjectsForVendor,
  totalEarningsForVendor,
  earningsByCompanyForVendor,
  earningsByContractorForVendor,
  invoiceStatusCountsForVendor,
  listRecentActivityForVendor,
  // PM
  countActiveContractorsForPm,
  milestoneStatusCountsForPm,
  milestonesWithBillingCountForPm,
  invoiceStatusCountsForPm,
  listRecentActivityForPm,
  // Contractor
  listActiveProjectsForContractor,
  revenueByProjectForContractor,
  lifetimeRevenueForContractor,
  invoiceHistoryForContractor,
};
