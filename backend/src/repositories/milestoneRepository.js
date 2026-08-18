const { pool } = require("../config/db");

/**
 * Database access for `milestones` and `milestone_billings` (Module 5,
 * redesigned to be project-level — see migration 016 and
 * milestoneService.checkAndTriggerMilestones). SQL lives only here, same
 * convention as every other repository. Split across two tables but kept
 * in one file since both are exclusively Module 5's — same rationale as
 * timesheetRepository owning one table.
 *
 * milestone_billings keeps its original name even though it now serves as
 * the per-contractor CONTRIBUTION ledger for a project-level milestone
 * (one row per milestone per contributing contractor, not one row per
 * milestone total) — its existing shape (milestone_id, contractor_id,
 * approved_hours, hourly_rate, billing_amount) and its existing
 * UNIQUE(milestone_id, contractor_id) constraint already match that
 * exactly. See migration 016's comment for why it was not renamed.
 */

/**
 * Inserts a new PENDING project-level milestone (no contractor_id — a
 * milestone is a project-wide cumulative-hours checkpoint, see this
 * file's own top comment and milestoneService.checkAndTriggerMilestones).
 * Project ownership is checked in the service layer BEFORE this is
 * called (pmMilestoneService.createMilestone) — this function trusts its
 * caller, same convention as projectRepository.create.
 */
async function create({ projectId, name, thresholdHours }) {
  const [result] = await pool.query(
    `INSERT INTO milestones (project_id, name, threshold_hours, status)
     VALUES (?, ?, ?, 'PENDING')`,
    [projectId, name, thresholdHours]
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
    `SELECT id, project_id, name, threshold_hours, status, met_at, created_at
     FROM milestones WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Every milestone for a project, lowest threshold first, each annotated
 * with the FULL list of per-contractor contributions recorded against it
 * (if MET) — a project-level milestone can have zero, one, or many
 * contribution rows, one per contractor who had newly-approved (never
 * previously billed) hours at the moment this milestone was reached (MVP
 * fix 2: each contractor's own approved hours, independent of every other
 * contractor — see milestoneService for how those are computed). Returns
 * one row per milestone with a
 * `contributions` array, NOT one row per (milestone, contractor) pair —
 * the frontend renders a milestone once with its contributor breakdown
 * nested, matching the "Milestones are PROJECT-level" display
 * requirement. Ownership (project belongs to the calling PM) is checked
 * by the service layer before this runs.
 */
async function listByProject(projectId) {
  const [milestoneRows] = await pool.query(
    `SELECT id, project_id, name, threshold_hours, status, met_at, created_at
     FROM milestones WHERE project_id = ? ORDER BY threshold_hours ASC`,
    [projectId]
  );
  if (milestoneRows.length === 0) return [];

  const milestoneIds = milestoneRows.map((m) => m.id);
  const [contributionRows] = await pool.query(
    `SELECT b.milestone_id, b.contractor_id, u.name AS contractor_name,
            b.approved_hours, b.hourly_rate, b.billing_amount, b.created_at
     FROM milestone_billings b
     INNER JOIN contractors c ON c.id = b.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     WHERE b.milestone_id IN (?)
     ORDER BY u.name ASC`,
    [milestoneIds]
  );

  const contributionsByMilestone = new Map();
  for (const row of contributionRows) {
    if (!contributionsByMilestone.has(row.milestone_id)) {
      contributionsByMilestone.set(row.milestone_id, []);
    }
    contributionsByMilestone.get(row.milestone_id).push({
      contractor_id: row.contractor_id,
      contractor_name: row.contractor_name,
      approved_hours: Number(row.approved_hours),
      hourly_rate: Number(row.hourly_rate),
      billing_amount: Number(row.billing_amount),
      created_at: row.created_at,
    });
  }

  return milestoneRows.map((m) => ({
    id: m.id,
    project_id: m.project_id,
    name: m.name,
    threshold_hours: Number(m.threshold_hours),
    status: m.status,
    met_at: m.met_at,
    created_at: m.created_at,
    contributions: contributionsByMilestone.get(m.id) || [],
  }));
}

/**
 * Locks every currently-PENDING milestone for a WHOLE PROJECT (across
 * every contractor — the redesign's core change) for the duration of the
 * caller's transaction (`SELECT ... FOR UPDATE` — must run on `conn`
 * inside an open transaction, see
 * milestoneService.checkAndTriggerMilestones). This is the actual
 * concurrency guarantee: a second, concurrent evaluation for the SAME
 * project (e.g. two timesheet approvals for different contractors landing
 * at nearly the same time) blocks here until the first transaction
 * commits or rolls back, so the second evaluation only ever sees
 * milestones that are still genuinely PENDING after the first one's
 * decisions, and can never mark/bill the same milestone twice. ORDER BY
 * threshold_hours ASC matters here too (MVP fix 2): when a single
 * evaluation call crosses several thresholds at once, milestones are
 * still processed lowest-to-highest, so the EARLIEST-crossed milestone is
 * the one that bills each contractor's available (never-before-billed)
 * hours first — see milestoneService.checkAndTriggerMilestones for why
 * that ordering, not threshold math, is what "WHEN a milestone is
 * reached" actually determines. Already-MET milestones are excluded here
 * on purpose — nothing about evaluation ever needs to touch them again.
 */
async function lockPendingForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT id, project_id, name, threshold_hours, status
     FROM milestones
     WHERE project_id = ? AND status = 'PENDING'
     ORDER BY threshold_hours ASC
     FOR UPDATE`,
    [projectId]
  );
  return rows;
}

/**
 * SUM(approved_hours) already billed to each contractor across EVERY
 * milestone of a project, grouped by contractor — MVP fix 2 ("billing
 * must use each contractor's actual approved hours"). This is the
 * per-contractor "already billed" ledger milestoneService.
 * checkAndTriggerMilestones needs to compute each contractor's marginal
 * (never-before-billed) hours when a new milestone is met: a contractor's
 * billable amount for a newly-met milestone is their own total APPROVED
 * hours minus whatever this query returns for them, never anything
 * derived from another contractor's hours or from the milestone's own
 * threshold_hours. Must run on `conn` inside the SAME transaction as
 * lockPendingForProject, so it reflects exactly what is already
 * immutably billed as of the moment being evaluated — reading the
 * `milestone_billings` rows themselves (rather than re-deriving from
 * `threshold_hours` math) is the auditable approach: every already-billed
 * hour is accounted for by an actual row, never inferred.
 *
 * Returns a Map<contractorId, totalHoursAlreadyBilled> (contractors with
 * no billing rows yet on this project simply have no entry).
 */
async function sumBilledHoursByContractorForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT b.contractor_id, SUM(b.approved_hours) AS total
     FROM milestone_billings b
     INNER JOIN milestones m ON m.id = b.milestone_id
     WHERE m.project_id = ?
     GROUP BY b.contractor_id`,
    [projectId]
  );
  return new Map(rows.map((r) => [r.contractor_id, Number(r.total)]));
}

/**
 * Conditionally transitions PENDING -> MET, stamping met_at. The
 * `AND status = 'PENDING'` guard is the real atomicity backstop, on top
 * of the row lock from lockPendingForProject above — same
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
 * Inserts one contributor's immutable contribution/billing snapshot for a
 * just-MET milestone. Must run on the same transaction-scoped `conn` as
 * markMet above — both the PENDING -> MET transition and every one of its
 * contribution rows succeed or fail together. Called once PER
 * contributing contractor (a project-level milestone can have several) —
 * see milestoneService.checkAndTriggerMilestones, which computes each
 * contractor's own marginal (never-before-billed) approved hours,
 * independent of every other contractor, before calling this.
 *
 * Relies on UNIQUE(milestone_id, contractor_id) (migration 014) as the
 * actual duplicate-contribution guarantee under concurrency — the row
 * lock from lockPendingForProject already prevents this in practice, but
 * the constraint is what's really relied on, same "friendly pre-check
 * backed by a real constraint" pattern as every other ER_DUP_ENTRY catch
 * in this codebase. The caller (billingService.createBillingRecord)
 * catches ER_DUP_ENTRY and treats it as "already billed, nothing to do"
 * rather than an error.
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
  lockPendingForProject,
  sumBilledHoursByContractorForProject,
  markMet,
  createBilling,
  findBillingById,
};
