const { pool } = require("../config/db");

// Submission reminders include the audit row for the current lifecycle. The
// submitted_at value is returned only as a deterministic legacy/seed fallback
// when no matching submission audit exists.
async function submittedTimesheets() {
  const [rows] = await pool.query(`SELECT t.id, p.pm_id AS recipient_id, p.name AS project_name,
      t.submitted_at,
      (SELECT MAX(a.id) FROM audit_log a
       WHERE a.action = 'TIMESHEET_SUBMITTED'
         AND a.entity_type = 'timesheet'
         AND CAST(a.entity_id AS UNSIGNED) = t.id
         AND a.created_at >= t.submitted_at) AS submission_audit_id
    FROM timesheets t
    INNER JOIN projects p ON p.id = t.project_id
    WHERE t.status = 'SUBMITTED'`);
  return rows;
}

async function submittedCandidates() {
  const [rows] = await pool.query(`SELECT cs.id, p.pm_id AS recipient_id, p.name AS project_name
    FROM candidate_submissions cs
    INNER JOIN projects p ON p.id = cs.project_id
    WHERE cs.status = 'SUBMITTED'`);
  return rows;
}

async function submittedInvoices() {
  const [rows] = await pool.query(`SELECT i.id, p.pm_id AS recipient_id, p.name AS project_name,
      i.submitted_at,
      (SELECT MAX(a.id) FROM audit_log a
       WHERE a.action = 'INVOICE_SUBMITTED'
         AND a.entity_type = 'invoice'
         AND CAST(a.entity_id AS UNSIGNED) = i.id
         AND a.created_at >= i.submitted_at) AS submission_audit_id
    FROM invoices i
    INNER JOIN projects p ON p.id = i.project_id
    WHERE i.status = 'SUBMITTED'`);
  return rows;
}

async function expiringVerifiedDocuments(days = 30) {
  const [rows] = await pool.query(`SELECT d.id, c.vendor_id AS recipient_id
    FROM contractor_documents d
    INNER JOIN contractors c ON c.id = d.contractor_id
    WHERE d.status = 'VERIFIED'
      AND d.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)`, [days]);
  return rows;
}

module.exports = { submittedTimesheets, submittedCandidates, submittedInvoices, expiringVerifiedDocuments };
