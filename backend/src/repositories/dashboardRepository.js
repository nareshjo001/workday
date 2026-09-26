const { pool } = require("../config/db");

// Aggregate role-scoped dashboard metrics in SQL without mutating business records.

// Vendor dashboard queries.

// Count active projects with active assignments for this vendor.
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

// Count each contractor once across the vendor's active projects.
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

// Include released assignments when counting the vendor's completed projects.
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

// Fetch scoped projects for shared server-side progress calculations.
async function listProjectsForVendorScope(scope) {
  // Include created_at in SELECT DISTINCT for strict ORDER BY compatibility; response mapping omits it.
  const [rows] = await pool.query(
    `SELECT DISTINCT p.id, p.name, COALESCE(cc.name, p.company_name) AS company_name,
            p.status, p.start_date, p.end_date, p.expected_hours, p.created_at
     FROM projects p
     INNER JOIN project_managers pm ON pm.user_id = p.pm_id
     LEFT JOIN client_companies cc ON cc.id = pm.company_id
     WHERE ${scope.where}
       AND p.status = 'ACTIVE'
     ORDER BY p.created_at DESC, p.id DESC`,
    scope.values
  );
  return rows.map((r) => ({ ...r, expected_hours: r.expected_hours === null ? null : Number(r.expected_hours) }));
}

// Count only APPROVED and legacy AUTO_APPROVED invoice amounts as earnings.
async function totalEarningsForVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM invoices WHERE vendor_id = ? AND status IN ('APPROVED', 'AUTO_APPROVED')`,
    [vendorId]
  );
  return Number(rows[0].total);
}

// Rank client companies by approved and legacy auto-approved earnings.
async function earningsByCompanyForVendor(vendorId, scope) {
  // Group projected columns through a subquery for MySQL/MariaDB ONLY_FULL_GROUP_BY compatibility.
  const [rows] = await pool.query(
    `SELECT company_name, SUM(total_amount) AS total
     FROM (
       SELECT i.total_amount, COALESCE(cc.name, p.company_name, 'Unknown') AS company_name
       FROM invoices i
       INNER JOIN projects p ON p.id = i.project_id
       INNER JOIN project_managers pm ON pm.user_id = p.pm_id
       LEFT JOIN client_companies cc ON cc.id = pm.company_id
       WHERE ${scope.where} AND i.vendor_id = ? AND i.status IN ('APPROVED', 'AUTO_APPROVED')
     ) earnings
     GROUP BY company_name
     ORDER BY total DESC`,
    [...scope.values, vendorId]
  );
  return rows.map((r) => ({ company_name: r.company_name, total: Number(r.total) }));
}

// Rank contractors by approved and legacy auto-approved earnings.
async function earningsByContractorForVendor(vendorId, scope) {
  const [rows] = await pool.query(
    `SELECT i.contractor_id, u.name AS contractor_name, SUM(i.total_amount) AS total
     FROM invoices i
     INNER JOIN contractors c ON c.id = i.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     INNER JOIN projects p ON p.id = i.project_id
     INNER JOIN project_managers pm ON pm.user_id = p.pm_id
     WHERE ${scope.where} AND i.vendor_id = ? AND c.vendor_id = ?
       AND i.status IN ('APPROVED', 'AUTO_APPROVED')
     GROUP BY i.contractor_id, u.name
     ORDER BY total DESC`,
    [...scope.values, vendorId, vendorId]
  );
  return rows.map((r) => ({ contractor_id: r.contractor_id, contractor_name: r.contractor_name, total: Number(r.total) }));
}

// Include every invoice status in the vendor's invoiced totals.
async function invoiceStatusCountsForVendor(vendorId, scope) {
  const [rows] = await pool.query(
    `SELECT i.status, COUNT(*) AS count, COALESCE(SUM(i.total_amount), 0) AS total
     FROM invoices i
     INNER JOIN projects p ON p.id = i.project_id
     INNER JOIN project_managers pm ON pm.user_id = p.pm_id
     WHERE ${scope.where} AND i.vendor_id = ? GROUP BY i.status`,
    [...scope.values, vendorId]
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
}

// Build vendor-scoped activity from timestamped business records.
async function listRecentActivityForVendor(vendorId, scope, limit) {
  const [rows] = await pool.query(
    `(SELECT 'ASSIGNED' AS type, CONCAT(u.name, ' assigned to ', p.name) AS message, pa.created_at AS occurred_at
      FROM project_assignments pa
      INNER JOIN contractors c ON c.id = pa.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN projects p ON p.id = pa.project_id
      INNER JOIN project_managers pm ON pm.user_id = p.pm_id
      WHERE ${scope.where} AND c.vendor_id = ?)
     UNION ALL
     (SELECT 'TIMESHEET_APPROVED', CONCAT(u.name, ' — ', t.hours_logged, 'h approved on ', p.name), t.reviewed_at
      FROM timesheets t
      INNER JOIN contractors c ON c.id = t.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN project_managers pm ON pm.user_id = p.pm_id
      WHERE ${scope.where} AND c.vendor_id = ? AND t.status = 'APPROVED' AND t.reviewed_at IS NOT NULL)
     UNION ALL
     (SELECT 'MILESTONE_MET', CONCAT('Milestone "', m.name, '" reached on ', p.name), m.met_at
      FROM milestones m
      INNER JOIN projects p ON p.id = m.project_id
      INNER JOIN project_managers pm ON pm.user_id = p.pm_id
      WHERE ${scope.where} AND m.status = 'MET' AND m.met_at IS NOT NULL)
     UNION ALL
     (SELECT 'INVOICE_GENERATED', CONCAT('Invoice generated for ', u.name, ' — ', p.name), i.generated_at
      FROM invoices i
      INNER JOIN projects p ON p.id = i.project_id
      INNER JOIN contractors c ON c.id = i.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN project_managers pm ON pm.user_id = p.pm_id
      WHERE ${scope.where} AND i.vendor_id = ?)
     UNION ALL
     (SELECT IF(i.status = 'REJECTED', 'INVOICE_REJECTED', 'INVOICE_APPROVED'),
             CONCAT('Invoice ', LOWER(i.status), ' for ', u.name, ' — ', p.name), i.reviewed_at
      FROM invoices i
      INNER JOIN projects p ON p.id = i.project_id
      INNER JOIN contractors c ON c.id = i.contractor_id
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN project_managers pm ON pm.user_id = p.pm_id
      WHERE ${scope.where} AND i.vendor_id = ? AND i.reviewed_at IS NOT NULL AND i.status IN ('APPROVED', 'REJECTED'))
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [...scope.values, vendorId, ...scope.values, vendorId, ...scope.values,
      ...scope.values, vendorId, ...scope.values, vendorId, Number(limit)]
  );
  return rows;
}

// PM dashboard queries.

// Count each active contractor once across the PM's active projects.
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

// Group milestone counts by stored status without inventing an upcoming lifecycle state.
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

// Count each milestone once when it has at least one billing contribution.
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

// Aggregate invoice statuses and amounts only for the PM's projects.
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

// Contractor dashboard queries.

// Return active assignments with both contractor-specific and project-wide approved hours.
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

// Group the contractor's approved and legacy auto-approved earnings by project.
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

// Exclude unapproved invoices from the contractor's lifetime earnings.
async function lifetimeRevenueForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM invoices WHERE contractor_id = ? AND status IN ('APPROVED', 'AUTO_APPROVED')`,
    [contractorId]
  );
  return Number(rows[0].total);
}

// Return the contractor's newest invoices up to the dashboard limit.
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
  countActiveProjectsForVendor,
  countActiveContractorsForVendor,
  countCompletedProjectsForVendor,
  listProjectsForVendorScope,
  totalEarningsForVendor,
  earningsByCompanyForVendor,
  earningsByContractorForVendor,
  invoiceStatusCountsForVendor,
  listRecentActivityForVendor,
  countActiveContractorsForPm,
  milestoneStatusCountsForPm,
  milestonesWithBillingCountForPm,
  invoiceStatusCountsForPm,
  listActiveProjectsForContractor,
  revenueByProjectForContractor,
  lifetimeRevenueForContractor,
  invoiceHistoryForContractor,
};
