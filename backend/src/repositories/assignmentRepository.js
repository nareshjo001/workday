const { pool } = require("../config/db");

/**
 * Database access for the `project_assignments` table — the join between
 * a Vendor-owned contractor and a PM-owned project. SQL lives only here.
 */

/**
 * Friendly pre-check before insert (see the ER_DUP_ENTRY catch in
 * vendorAssignmentService for the actual guarantee, backed by the
 * UNIQUE(contractor_id, project_id) constraint).
 */
async function existsFor(contractorId, projectId) {
  const [rows] = await pool.query(
    `SELECT id FROM project_assignments WHERE contractor_id = ? AND project_id = ? LIMIT 1`,
    [contractorId, projectId]
  );
  return rows.length > 0;
}

/**
 * Locks the single project_requirements row for (projectId, skill) for
 * the duration of the caller's transaction — `SELECT ... FOR UPDATE`
 * must run on `conn` inside an open transaction (see
 * vendorAssignmentService.createAssignment). Any other transaction
 * trying to lock the SAME requirement row blocks until this one commits
 * or rolls back, which is what actually prevents two concurrent
 * assignments from both reading "capacity available" and both inserting.
 * Returns null if there's no requirement for that project+skill at all.
 */
async function lockRequirementForUpdate(conn, projectId, skill) {
  const [rows] = await conn.query(
    `SELECT id, project_id, skill, required_count
     FROM project_requirements
     WHERE project_id = ? AND skill = ?
     LIMIT 1
     FOR UPDATE`,
    [projectId, skill]
  );
  return rows[0] || null;
}

/**
 * Same lock as lockRequirementForUpdate above, but looked up directly by
 * requirement id — the new nested-resource assignment endpoint
 * (POST /api/vendor/projects/:id/requirements/:requirementId/assign)
 * already has the requirement id from the URL, and also needs to confirm
 * that requirement actually belongs to the given projectId (defense
 * against a requirementId from a DIFFERENT project being passed in).
 */
async function lockRequirementForUpdateById(conn, projectId, requirementId) {
  const [rows] = await conn.query(
    `SELECT id, project_id, skill, required_count
     FROM project_requirements
     WHERE id = ? AND project_id = ?
     LIMIT 1
     FOR UPDATE`,
    [requirementId, projectId]
  );
  return rows[0] || null;
}

/**
 * Global "is this contractor assigned to ANY project" check — the new
 * business rule (vendor-centric workflow revision) is one contractor, one
 * project, ever, not just "not already on THIS project" (contrast with
 * existsFor above, which is per-project and now only used for the
 * friendly duplicate-in-this-project message). Must be called on the
 * transaction-scoped `conn` inside the same transaction that later
 * inserts the assignment, AFTER the requirement row (and therefore,
 * transitively, nothing about locking a contractor row directly) — the
 * actual concurrency guarantee against two simultaneous assignments of
 * the same contractor to two different projects is the
 * UNIQUE(contractor_id) constraint from migration 011, this pre-check
 * just turns the common case into a clean error instead of a raw
 * ER_DUP_ENTRY.
 */
async function isContractorAssigned(conn, contractorId) {
  const [rows] = await conn.query(
    `SELECT id FROM project_assignments WHERE contractor_id = ? LIMIT 1`,
    [contractorId]
  );
  return rows.length > 0;
}

/**
 * How many assignments currently point at a given requirement. Must be
 * read AFTER lockRequirementForUpdate has taken the row lock, and on the
 * same connection/transaction, so this count reflects the true
 * up-to-the-moment state — a concurrent transaction blocked on the lock
 * can't have inserted yet.
 */
async function countAssignmentsForRequirement(conn, requirementId) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count FROM project_assignments WHERE requirement_id = ?`,
    [requirementId]
  );
  return Number(rows[0].count);
}

/**
 * Inserts the assignment, tagged with the specific requirement it fills.
 * Must run on the same transaction-scoped `conn` as the capacity check
 * above — the row lock is what's actually preventing another transaction
 * from reading a stale count between the check and this insert.
 */
async function createWithRequirement(conn, contractorId, projectId, requirementId) {
  const [result] = await conn.query(
    `INSERT INTO project_assignments (contractor_id, project_id, requirement_id, assigned_date)
     VALUES (?, ?, ?, CURDATE())`,
    [contractorId, projectId, requirementId]
  );
  return result.insertId;
}

/**
 * Projects assigned to a given contractor, joined with the project's own
 * fields (including company_name, added in the Module 3 revision) plus
 * this assignment's assigned_date and the skill it was assigned under.
 * Scoped by contractor_id — the caller (contractorProjectService)
 * resolves that id from the authenticated contractor's own JWT, never
 * from a query/body param.
 */
async function listProjectsForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description,
            COALESCE(cc.name, p.company_name) AS company_name, pm_user.name AS pm_name,
            p.start_date, p.end_date, p.status,
            pa.assigned_date, pr.skill AS assigned_skill
     FROM project_assignments pa
     INNER JOIN projects p ON p.id = pa.project_id
     LEFT JOIN project_requirements pr ON pr.id = pa.requirement_id
     LEFT JOIN users pm_user ON pm_user.id = p.pm_id
     LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
     LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
     WHERE pa.contractor_id = ?
     ORDER BY pa.created_at DESC`,
    [contractorId]
  );
  return rows;
}

/**
 * Every contractor currently assigned to a project, one row per
 * assignment, annotated with their Logged vs. Approved hours on THAT
 * project — powers the Vendor's "Project Team" view (extends
 * GET /api/vendor/projects/:id/requirements rather than adding a
 * separate endpoint, see vendorProjectService.getProjectDetail).
 *
 * logged_hours sums hours_logged across every timesheet row for this
 * contractor+project regardless of status (PENDING/APPROVED/REJECTED
 * all count as "hours the contractor has logged"). approved_hours sums
 * only rows with status = 'APPROVED' — this is the one place those two
 * numbers are actually computed; the requirement doc's "Approved Hours"
 * excludes both PENDING and REJECTED on purpose (an hour isn't billable
 * until a PM has said so), and this SUM...CASE does that in one query
 * rather than two.
 *
 * The LEFT JOIN to timesheets means a contractor with zero logged hours
 * still appears (as 0/0), not silently dropped — a vendor should be able
 * to see "assigned, hasn't logged anything yet" as its own state.
 * requirement_id comes straight off project_assignments (an assignment
 * is always tied to the specific requirement it filled, see migration
 * 008) so the caller can group contractors under the correct per-skill
 * requirement without a second lookup.
 */
async function listAssignedContractorsWithHours(projectId) {
  const [rows] = await pool.query(
    `SELECT pa.requirement_id, c.id AS contractor_id, u.name AS contractor_name,
            c.skill AS contractor_skill, c.status AS contractor_status,
            COALESCE(SUM(t.hours_logged), 0) AS logged_hours,
            COALESCE(SUM(CASE WHEN t.status = 'APPROVED' THEN t.hours_logged ELSE 0 END), 0) AS approved_hours
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN timesheets t ON t.contractor_id = pa.contractor_id AND t.project_id = pa.project_id
     WHERE pa.project_id = ?
     GROUP BY pa.requirement_id, c.id, u.name, c.skill, c.status
     ORDER BY u.name ASC`,
    [projectId]
  );
  return rows.map((r) => ({
    requirement_id: r.requirement_id,
    contractor_id: r.contractor_id,
    contractor_name: r.contractor_name,
    contractor_skill: r.contractor_skill,
    contractor_status: r.contractor_status,
    logged_hours: Number(r.logged_hours),
    approved_hours: Number(r.approved_hours),
  }));
}

module.exports = {
  existsFor,
  lockRequirementForUpdate,
  lockRequirementForUpdateById,
  isContractorAssigned,
  countAssignmentsForRequirement,
  createWithRequirement,
  listProjectsForContractor,
  listAssignedContractorsWithHours,
};
