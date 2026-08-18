const { pool } = require("../config/db");

/**
 * Database access for the `invoices` table (Module 6). SQL lives only
 * here, same convention as every other repository. An invoice is never
 * created directly by a PM or Vendor request — the only writes here are
 * `create` (from invoiceService.generateInvoiceForMilestone, an internal
 * Module 5->6 hook) and `applyReview` (from a PM's PATCH request, gated
 * by ownership + a conditional status transition).
 */

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

/**
 * Inserts a new invoice, snapshotting project_id/contractor_id/vendor_id/
 * amount at generation time (see invoiceService.generateInvoiceForMilestone
 * for where each of those is actually resolved from — never from a
 * request). Relies on UNIQUE(milestone_billing_id) (migration 015) as
 * the real "exactly one invoice per milestone billing" guarantee under
 * concurrency — the caller catches ER_DUP_ENTRY and treats it as
 * "someone else already generated this one," same pattern as every other
 * duplicate-under-race guard in this codebase.
 */
async function create({ milestoneBillingId, projectId, contractorId, vendorId, amount, status }) {
  const [result] = await pool.query(
    `INSERT INTO invoices (milestone_billing_id, project_id, contractor_id, vendor_id, amount, status, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [milestoneBillingId, projectId, contractorId, vendorId, amount, status]
  );
  return result.insertId;
}

/**
 * The idempotency fast path for invoice generation: if a milestone
 * billing already has an invoice, generateInvoiceForMilestone returns
 * THIS row instead of attempting a second insert. No ownership scoping
 * — this is an internal lookup by a unique, server-generated id, not a
 * path reachable from an authenticated HTTP request with an
 * attacker-chosen id.
 */
async function findByMilestoneBillingId(milestoneBillingId) {
  const [rows] = await pool.query(
    `SELECT id, milestone_billing_id, project_id, contractor_id, vendor_id, amount, status,
            generated_at, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at
     FROM invoices WHERE milestone_billing_id = ? LIMIT 1`,
    [milestoneBillingId]
  );
  return rows[0] ? toRow(rows[0]) : null;
}

/**
 * A single invoice by id, with no ownership scoping — used right after
 * create()/review() to re-fetch fresh state for a response. Every
 * HTTP-reachable caller does its own ownership check first (see
 * lockOwnedByVendorForReview below, which scopes by vendor_id in SQL
 * before this is ever called), same pattern as timesheetRepository.findById
 * / milestoneRepository.findById.
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, milestone_billing_id, project_id, contractor_id, vendor_id, amount, status,
            generated_at, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at
     FROM invoices WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? toRow(rows[0]) : null;
}

/**
 * Shared SELECT fragment joining an invoice to its project/contractor/
 * milestone display names — every "list/show an invoice" query below
 * uses this same shape so the PM view, Vendor view, and post-review
 * re-fetch never drift into three different response shapes for the
 * same underlying data.
 */
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

/**
 * A single invoice's full display view by id — used to build the
 * response after generateInvoiceForMilestone creates a row and after a
 * PM review commits. No ownership scoping (see findById's comment above
 * for why that's fine here).
 */
async function findDetailedById(id) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE i.id = ? LIMIT 1`, [id]);
  return rows[0] ? toDetailView(rows[0]) : null;
}

/**
 * Conditionally transitions PENDING_REVIEW -> APPROVED/REJECTED. The
 * `AND status = 'PENDING_REVIEW'` guard is the actual atomicity
 * backstop, on top of the row lock from lockOwnedByVendorForReview below
 * — even if two requests somehow both got past the lock, only the first
 * UPDATE here can match a still-PENDING_REVIEW row; the second gets
 * affectedRows = 0 and the caller turns that into a clean 409, never a
 * silent overwrite of the first review's outcome (same pattern as
 * timesheetRepository.markReviewed / milestoneRepository.markMet).
 * AUTO_APPROVED, APPROVED, and REJECTED are all terminal — there is no
 * UPDATE anywhere in this file whose WHERE clause matches any of them.
 */
async function applyReview(conn, invoiceId, { status, reviewedBy, rejectionReason }) {
  const [result] = await conn.query(
    `UPDATE invoices
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
     WHERE id = ? AND status = 'PENDING_REVIEW'`,
    [status, reviewedBy, rejectionReason ?? null, invoiceId]
  );
  return result.affectedRows > 0;
}

/**
 * Every invoice for contractors belonging to the given vendor, newest
 * first. Ownership is enforced via the invoice's OWN snapshotted
 * `vendor_id` column (set once at generation time, see
 * invoiceService.generateInvoiceForMilestone) rather than a live join to
 * contractors.vendor_id — this endpoint intentionally shows a vendor
 * their invoices' historically-correct ownership, not whatever the
 * contractor's CURRENT vendor happens to be (there is no
 * reassign-contractor-to-a-different-vendor feature anywhere in this
 * codebase, so in practice the two are always identical, but the
 * snapshot is the one the spec calls out as authoritative — see
 * migration 015's comment).
 */
async function listForVendor(vendorId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE i.vendor_id = ? ORDER BY i.generated_at DESC`, [
    vendorId,
  ]);
  return rows.map(toDetailView);
}

/**
 * Locks the target invoice row for the duration of the caller's
 * transaction (`SELECT ... FOR UPDATE`), scoped to `vendor_id = ?` —
 * invoice-workflow redesign: approval authority moves to the Vendor (see
 * vendorInvoiceService.reviewInvoice). Same pattern as
 * lockOwnedByPmForReview above, just scoped by the invoice's own
 * snapshotted vendor_id instead of a project-ownership JOIN. A vendor
 * probing another vendor's invoice id gets `null` here, indistinguishable
 * from a nonexistent id (no existence leakage).
 */
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

/**
 * Every invoice for projects owned by the given PM, every status —
 * invoice-workflow redesign: a PM no longer approves/rejects (see
 * invoiceApprovalService's retired mutation), only VIEWS their own
 * projects' invoice history, with vendor-approved invoices surfacing
 * first as the primary financial record (spec: "vendor-approved invoices
 * shown prominently") — ORDER BY puts APPROVED first, then
 * PENDING_REVIEW/AUTO_APPROVED, then REJECTED last, newest within each
 * group. Ownership is enforced in the JOIN/WHERE clause
 * (i.project_id -> p.id, p.pm_id = ?), never filtered in JavaScript
 * afterward.
 */
async function listForPm(pmId) {
  const [rows] = await pool.query(
    `${DETAIL_SELECT}
     WHERE p.pm_id = ?
     ORDER BY FIELD(i.status, 'APPROVED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'REJECTED'), i.generated_at DESC`,
    [pmId]
  );
  return rows.map(toDetailView);
}

module.exports = {
  create,
  findByMilestoneBillingId,
  findById,
  findDetailedById,
  listForPm,
  lockOwnedByVendorForReview,
  applyReview,
  listForVendor,
};
