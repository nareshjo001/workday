const { pool } = require("../config/db");


function toRow(r) {
  return {
    id: r.id,
    milestone_billing_id: r.milestone_billing_id,
    project_id: r.project_id,
    contractor_id: r.contractor_id,
    vendor_id: r.vendor_id,
    amount: Number(r.amount),
    status: r.status,
    generated_at: r.generated_at,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
    rejection_reason: r.rejection_reason,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Snapshot invoice ownership and amount; the unique billing key prevents duplicate generation.
async function create({ milestoneBillingId, projectId, contractorId, vendorId, amount, status }) {
  const [result] = await pool.query(
    `INSERT INTO invoices (milestone_billing_id, project_id, contractor_id, vendor_id, amount, status, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [milestoneBillingId, projectId, contractorId, vendorId, amount, status]
  );
  return result.insertId;
}

// Look up an existing invoice by its trusted billing ID for idempotent generation.
async function findByMilestoneBillingId(milestoneBillingId) {
  const [rows] = await pool.query(
    `SELECT id, milestone_billing_id, project_id, contractor_id, vendor_id, amount, status,
            generated_at, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at
     FROM invoices WHERE milestone_billing_id = ? LIMIT 1`,
    [milestoneBillingId]
  );
  return rows[0] ? toRow(rows[0]) : null;
}

// Unscoped lookup for callers that have already verified ownership.
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, milestone_billing_id, project_id, contractor_id, vendor_id, amount, status,
            generated_at, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at
     FROM invoices WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? toRow(rows[0]) : null;
}

// Reuse one joined invoice shape across list, detail, and response queries.
const DETAIL_SELECT = `
  SELECT i.id, i.project_id, p.name AS project_name,
         i.contractor_id, u.name AS contractor_name,
         m.id AS milestone_id, m.name AS milestone_name,
         i.amount, i.status, i.generated_at,
         i.reviewed_by, reviewer.name AS reviewed_by_name, i.reviewed_at, i.rejection_reason
  FROM invoices i
  INNER JOIN projects p ON p.id = i.project_id
  INNER JOIN contractors c ON c.id = i.contractor_id
  INNER JOIN users u ON u.id = c.user_id
  INNER JOIN milestone_billings b ON b.id = i.milestone_billing_id
  INNER JOIN milestones m ON m.id = b.milestone_id
  LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by
`;

function toDetailView(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    project_name: r.project_name,
    contractor_id: r.contractor_id,
    contractor_name: r.contractor_name,
    milestone_id: r.milestone_id,
    milestone_name: r.milestone_name,
    amount: Number(r.amount),
    status: r.status,
    generated_at: r.generated_at,
    reviewed_by_name: r.reviewed_by_name || null,
    reviewed_at: r.reviewed_at,
    rejection_reason: r.rejection_reason,
  };
}

// Build the detailed invoice view only after the caller has verified access.
async function findDetailedById(id) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE i.id = ? LIMIT 1`, [id]);
  return rows[0] ? toDetailView(rows[0]) : null;
}

// Guard the legacy review transition by status so concurrent decisions cannot overwrite each other.
async function applyReview(conn, invoiceId, { status, reviewedBy, rejectionReason }) {
  const [result] = await conn.query(
    `UPDATE invoices
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
     WHERE id = ? AND status = 'PENDING_REVIEW'`,
    [status, reviewedBy, rejectionReason ?? null, invoiceId]
  );
  return result.affectedRows > 0;
}

// Keep completion blocked while legacy invoice review is unresolved.
async function countPendingReviewForProject(conn, projectId) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total FROM invoices WHERE project_id = ? AND status = 'PENDING_REVIEW'`,
    [projectId]
  );
  return Number(row.total);
}

// Scope historical invoice ownership by its snapshotted vendor_id, not the contractor's current vendor.
async function listForVendor(vendorId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE i.vendor_id = ? ORDER BY i.generated_at DESC`, [
    vendorId,
  ]);
  return rows.map(toDetailView);
}

async function listPageForVendor(vendorId, query) {
  const where = ["i.vendor_id = ?"]; const params = [vendorId];
  if (query.filters.status) { where.push("i.status = ?"); params.push(query.filters.status); }
  if (query.filters.projectId) { where.push("i.project_id = ?"); params.push(query.filters.projectId); }
  const clause = where.join(" AND ");
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM invoices i WHERE ${clause}`, params);
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, i.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return { rows: rows.map(toDetailView), total: Number(count.total) };
}

// Lock the vendor-owned invoice in the caller's transaction without exposing foreign invoice existence.
async function lockOwnedByVendorForReview(conn, invoiceId, vendorId) {
  const [rows] = await conn.query(
    `SELECT id, project_id, contractor_id, vendor_id, amount, status, milestone_billing_id
     FROM invoices
     WHERE id = ? AND vendor_id = ?
     LIMIT 1
     FOR UPDATE`,
    [invoiceId, vendorId]
  );
  return rows[0] || null;
}

// Enforce PM project ownership in SQL and retain the legacy invoice ordering.
async function listForPm(pmId) {
  const [rows] = await pool.query(
    `${DETAIL_SELECT}
     WHERE p.pm_id = ?
     ORDER BY FIELD(i.status, 'APPROVED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'REJECTED'), i.generated_at DESC`,
    [pmId]
  );
  return rows.map(toDetailView);
}

async function listPageForPm(pmId, query) {
  const where = ["p.pm_id = ?"]; const params = [pmId];
  if (query.filters.status) { where.push("i.status = ?"); params.push(query.filters.status); }
  if (query.filters.projectId) { where.push("i.project_id = ?"); params.push(query.filters.projectId); }
  const clause = where.join(" AND ");
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM invoices i INNER JOIN projects p ON p.id = i.project_id WHERE ${clause}`, params);
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, i.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return { rows: rows.map(toDetailView), total: Number(count.total) };
}

module.exports = {
  create,
  findByMilestoneBillingId,
  findById,
  findDetailedById,
  listForPm,
  listPageForPm,
  lockOwnedByVendorForReview,
  applyReview,
  countPendingReviewForProject,
  listForVendor,
  listPageForVendor,
};
