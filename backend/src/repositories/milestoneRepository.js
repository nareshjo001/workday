const { pool } = require("../config/db");

/**
 * Database access for `milestones` and `milestone_billings` (Module 5).
 * SQL lives only here, same convention as every other repository. Split
 * across two tables but kept in one file since both are exclusively
 * Module 5's — same rationale as timesheetRepository owning one table.
 */

/**
 * Inserts a new PENDING milestone. `projectId`/`contractorId` ownership
 * and assignment checks happen in the service layer BEFORE this is
 * called (pmMilestoneService.createMilestone) — this function trusts its
 * caller, same convention as projectRepository.create.
 */
async function create({ projectId, contractorId, name, thresholdHours }) {
  const [result] = await pool.query(
    `INSERT INTO milestones (project_id, contractor_id, name, threshold_hours, status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [projectId, contractorId, name, thresholdHours]
  );
  return result.insertId;
}

/**
 * A single milestone by id, with no ownership scoping — used right after
 * create()/evaluation to re-fetch fresh state for a response. Every
 * caller does its own ownership check first (pmMilestoneService resolves
 * the owning project and checks project.pm_id), same pattern as
 * timesheetRepository.findById.
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, project_id, contractor_id, name, threshold_hours, status, met_at, created_at
     FROM milestones WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Every milestone for a project, across all contractors staffed on it,
 * newest first, each annotated with its contractor's name and — if MET —
 * its immutable billing snapshot (LEFT JOIN, so a MET milestone that for
 * some reason has no billing row yet, e.g. mid-transaction, still lists
 * cleanly with billing fields null rather than being silently dropped).
 * Ownership (project belongs to the calling PM) is checked by the
 * service layer before this runs — see pmMilestoneService.listMilestones,
 * same division of responsibility as projectRepository.listByPm vs.
 * pmProjectService.
 */
async function listByProject(projectId) {
  const [rows] = await pool.query(
    `SELECT m.id, m.project_id, m.contractor_id, u.name AS contractor_name,
            m.name, m.threshold_hours, m.status, m.met_at, m.created_at,
            b.approved_hours, b.hourly_rate, b.billing_amount
     FROM milestones m
     INNER JOIN contractors c ON c.id = m.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN milestone_billings b ON b.milestone_id = m.id AND b.contractor_id = m.contractor_id
     WHERE m.project_id = ?
     ORDER BY m.created_at DESC`,
    [projectId]
  );
  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    contractor_id: r.contractor_id,
    contractor_name: r.contractor_name,
    name: r.name,
    threshold_hours: Number(r.threshold_hours),
    status: r.status,
    met_at: r.met_at,
    created_at: r.created_at,
    approved_hours: r.approved_hours === null ? null : Number(r.approved_hours),
    hourly_rate: r.hourly_rate === null ? null : Number(r.hourly_rate),
    billing_amount: r.billing_amount === null ? null : Number(r.billing_amount),
  }));
}

/**
 * Locks every currently-PENDING milestone for one contractor+project for
 * the duration of the caller's transaction (`SELECT ... FOR UPDATE` —
 * must run on `conn` inside an open transaction, see
 * milestoneService.evaluateMilestonesForContractorProject). This is the
 * actual concurrency guarantee: a second, concurrent evaluation for the
 * SAME contractor+project (e.g. two timesheet approvals landing at
 * nearly the same time) blocks here until the first transaction commits
 * or rolls back — so the second evaluation only ever sees milestones
 * that are still genuinely PENDING after the first one's decisions, and
 * can never mark/bill the same milestone twice. ORDER BY threshold_hours
 * ASC is not required for correctness (idx_milestones_project_contractor_status
 * already scopes the lock to a small range) but keeps evaluation order
 * predictable (lowest threshold first) for anyone reading logs/tests.
 * Already-MET milestones are excluded here on purpose — nothing about
 * evaluation ever needs to touch them again.
 */
async function lockPendingForContractorProject(conn, projectId, contractorId) {
  const [rows] = await conn.query(
    `SELECT id, project_id, contractor_id, name, threshold_hours, status
     FROM milestones
     WHERE project_id = ? AND contractor_id = ? AND status = 'PENDING'
     ORDER BY threshold_hours ASC
     FOR UPDATE`,
    [projectId, contractorId]
  );
  return rows;
}

/**
 * Conditionally transitions PENDING -> MET, stamping met_at. The
 * `AND status = 'PENDING'` guard is the real atomicity backstop, on top
 * of the row lock from lockPendingForContractorProject above — same
 * belt-and-suspenders pattern as timesheetRepository.markReviewed. Under
 * the row lock this should always affect exactly one row when called,
 * but the caller still checks affectedRows rather than assuming it.
 */
async function markMet(conn, milestoneId) {
  const [result] = await conn.query(
    `UPDATE milestones SET status = 'MET', met_at = NOW() WHERE id = ? AND status = 'PENDING'`,
    [milestoneId]
  );
  return result.affectedRows > 0;
}

/**
 * Sums a contractor's APPROVED hours for a single project — the
 * authoritative "how many hours has this contractor had approved on
 * this project" figure, recomputed fresh from timesheets every time
 * rather than trusting any caller-supplied total (Module 5 spec: never
 * trust a request payload for anything billing-related). Deliberately
 * takes `conn` and must run inside the SAME transaction that holds the
 * milestone row lock (see evaluateMilestonesForContractorProject) so this
 * read is consistent with the milestones being evaluated against it —
 * matches the "Approved Hours excludes PENDING and REJECTED" convention
 * already established by assignmentRepository.listAssignedContractorsWithHours
 * and ProjectTeamModal.
 */
async function sumApprovedHours(conn, contractorId, projectId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(hours_logged), 0) AS total
     FROM timesheets
     WHERE contractor_id = ? AND project_id = ? AND status = 'APPROVED'`,
    [contractorId, projectId]
  );
  return Number(rows[0].total);
}

/**
 * Inserts the immutable billing snapshot for a just-MET milestone. Must
 * run on the same transaction-scoped `conn` as markMet above — both the
 * PENDING -> MET transition and its billing snapshot succeed or fail
 * together (Module 5 spec: a milestone is never left MET without a
 * billing row, or billed without being MET).
 *
 * Relies on UNIQUE(milestone_id, contractor_id) (migration 014) as the
 * actual duplicate-billing guarantee under concurrency — the row lock
 * from lockPendingForContractorProject already prevents this in
 * practice, but the constraint is what's really relied on, same
 * "friendly pre-check backed by a real constraint" pattern as every
 * other ER_DUP_ENTRY catch in this codebase. The caller
 * (billingService.createBillingRecord) catches ER_DUP_ENTRY and treats it
 * as "already billed, nothing to do" rather than an error.
 */
async function createBilling(conn, { milestoneId, contractorId, approvedHours, hourlyRate, billingAmount }) {
  const [result] = await conn.query(
    `INSERT INTO milestone_billings (milestone_id, contractor_id, approved_hours, hourly_rate, billing_amount)
     VALUES (?, ?, ?, ?, ?)`,
    [milestoneId, contractorId, approvedHours, hourlyRate, billingAmount]
  );
  return result.insertId;
}

/**
 * A single milestone_billings row by its own id, joined with its parent
 * milestone for project_id — added for Module 6. invoiceService reads
 * project_id and contractor_id from HERE (the authoritative DB row),
 * never from whatever a caller happens to pass in, so invoice generation
 * stays correct even if it's ever invoked with stale/mismatched
 * arguments. No ownership scoping — same rationale as findById above,
 * this is an internal, server-triggered lookup (invoiceService), not a
 * path reachable from an authenticated HTTP request.
 */
async function findBillingById(id) {
  const [rows] = await pool.query(
    `SELECT b.id, b.milestone_id, b.contractor_id, b.approved_hours, b.hourly_rate, b.billing_amount,
            m.project_id
     FROM milestone_billings b
     INNER JOIN milestones m ON m.id = b.milestone_id
     WHERE b.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    milestone_id: r.milestone_id,
    project_id: r.project_id,
    contractor_id: r.contractor_id,
    approved_hours: Number(r.approved_hours),
    hourly_rate: Number(r.hourly_rate),
    billing_amount: Number(r.billing_amount),
  };
}

module.exports = {
  create,
  findById,
  listByProject,
  lockPendingForContractorProject,
  markMet,
  sumApprovedHours,
  createBilling,
  findBillingById,
};
