const { pool } = require("../config/db");

/**
 * Database access for the `projects` table (and, since the Module 3
 * revision, the `project_requirements` table that hangs off it). Same
 * convention as userRepository.js / contractorRepository.js — SQL lives
 * only here, every query is parameterized.
 *
 * Every read/write a PM can trigger is scoped by pm_id, same pattern as
 * Module 2's vendor_id scoping on contractors.
 */

/**
 * Inserts the project row itself. Callers that also need to insert
 * project_requirements in the same transaction should pass `conn`
 * (a checked-out connection with beginTransaction() already called) —
 * see pmProjectService.createProject. Falls back to the pool for callers
 * that don't need a transaction (there currently are none, but the
 * signature stays consistent with createRequirements below).
 *
 * company_name is NO LONGER accepted here — company identity is now
 * derived from the creating PM's project_managers/client_companies link
 * (see the JOIN in listByPm/findById/listAvailableForVendor below), not
 * typed per-project. The column itself is left NULL for new rows; reads
 * fall back to it only for pre-migration-009 legacy projects via
 * COALESCE(cc.name, p.company_name).
 */
async function create(conn, { name, description, pmId, startDate, endDate, expectedHours }) {
  const runner = conn || pool;
  const [result] = await runner.query(
    `INSERT INTO projects (name, description, pm_id, start_date, end_date, expected_hours, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [name, description, pmId, startDate, endDate, expectedHours]
  );
  return result.insertId;
}

/**
 * Shared JOIN fragment resolving a project's client company + PM display
 * name: prefer the PM's linked client_companies row (the current source
 * of truth, see migration 009), falling back to the legacy
 * projects.company_name column for rows created before that migration
 * whose PM has since been backfilled to a possibly-different company
 * (migration 010 backfills from this same legacy value, so in practice
 * they usually agree — COALESCE just guards the edge case where they
 * don't, e.g. a PM who has since changed employer in a later revision).
 */
const COMPANY_PM_JOIN = `
  LEFT JOIN users pm_user ON pm_user.id = p.pm_id
  LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
  LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
`;
const COMPANY_PM_SELECT = `COALESCE(cc.name, p.company_name) AS company_name, pm_user.name AS pm_name`;

/**
 * Inserts every staffing requirement row for a project in one query.
 * Always called with the SAME transaction-scoped connection as create()
 * above, per Module 3 revision spec section 3 — project + requirements
 * must succeed or fail together, never partially.
 */
async function createRequirements(conn, projectId, requirements) {
  if (requirements.length === 0) return;
  for (const requirement of requirements) {
    await conn.query(`INSERT INTO project_requirements (project_id, skill, skill_id, required_count)
      SELECT ?, ?, id, ? FROM skills WHERE code = ? AND is_active = 1`, [projectId, requirement.skill, requirement.requiredCount, requirement.skill]);
  }
}

/**
 * All projects belonging to the given PM. Ownership lives in the WHERE
 * clause, not filtered afterward. Includes historical/expired/completed
 * projects — a PM should still see their own project history (Module 3
 * revision spec section 4), only Vendor-facing staffing availability
 * filters those out (see listAvailableForVendor below).
 */
async function listByPm(pmId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT},
            p.start_date, p.end_date, p.expected_hours, p.status
     FROM projects p
     ${COMPANY_PM_JOIN}
     WHERE p.pm_id = ?
     ORDER BY p.created_at DESC`,
    [pmId]
  );
  return rows;
}

async function listPageByPm(pmId, query) {
  const where = ["p.pm_id = ?"]; const params = [pmId];
  if (query.filters.status) { where.push("p.status = ?"); params.push(query.filters.status); }
  if (query.filters.search) { where.push("(p.name LIKE ? OR COALESCE(cc.name, p.company_name) LIKE ?)"); const term = `%${query.filters.search}%`; params.push(term, term); }
  if (query.filters.startDate) { where.push("p.start_date >= ?"); params.push(query.filters.startDate); }
  const clause = where.join(" AND ");
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM projects p ${COMPANY_PM_JOIN} WHERE ${clause}`, params);
  const [rows] = await pool.query(`SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT}, p.start_date, p.end_date, p.expected_hours, p.status FROM projects p ${COMPANY_PM_JOIN} WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, p.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return { rows, total: Number(count.total) };
}

/**
 * A project by id, with NO ownership scoping — per the Module 3 MVP
 * decision, a Vendor may assign their contractor to any existing
 * project; the only thing that needs to be true here is that the
 * project exists. (Contrast with contractorRepository.findByVendorAndId,
 * which deliberately DOES scope by owner — different rule for a
 * different relationship, not an inconsistency.)
 */
async function findById(projectId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT},
            p.pm_id, p.start_date, p.end_date, p.expected_hours, p.status
     FROM projects p
     ${COMPANY_PM_JOIN}
     WHERE p.id = ?
     LIMIT 1`,
    [projectId]
  );
  return rows[0] || null;
}

/**
 * Row-locked variant of findById (`SELECT ... FOR UPDATE`) — must run on
 * `conn` inside an open transaction. This is the actual concurrency
 * guarantee behind "SUM(allocated_hours) <= expected_hours can never be
 * violated even under simultaneous requests" (vendorAssignmentService)
 * and behind project-completion's atomic release-all-assignments step
 * (pmProjectService.completeProject): a second, concurrent transaction
 * trying to lock the SAME project row blocks here until the first commits
 * or rolls back, so two nearly-simultaneous allocation requests against
 * the same project can never both read a stale "capacity available"
 * figure. No COMPANY_PM_JOIN here — this internal, transaction-scoped
 * read only needs the columns those business rules actually touch, not
 * the display-only company/PM name join every read-facing query carries.
 */
async function lockByIdForUpdate(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT id, pm_id, start_date, end_date, expected_hours, status
     FROM projects WHERE id = ? LIMIT 1 FOR UPDATE`,
    [projectId]
  );
  return rows[0] || null;
}

/**
 * Conditionally transitions a project to COMPLETED. `WHERE status !=
 * 'COMPLETED'` is the real atomicity backstop (same conditional-UPDATE
 * pattern as timesheetRepository.markReviewed / milestoneRepository.markMet)
 * on top of the row lock from lockByIdForUpdate above — a project can be
 * marked COMPLETED from ACTIVE or ON_HOLD, but re-completing an
 * already-COMPLETED project is a no-op (affectedRows = 0), not a second
 * release-all-assignments pass.
 */
async function markCompleted(conn, projectId) {
  const [result] = await conn.query(
    `UPDATE projects SET status = 'COMPLETED' WHERE id = ? AND status != 'COMPLETED'`,
    [projectId]
  );
  return result.affectedRows > 0;
}

async function listAvailablePageForVendor(query, vendorId) {
  const where = ["p.status = 'ACTIVE'", "(p.end_date IS NULL OR p.end_date >= CURDATE())", "pv.vendor_id = ?", "pv.status = 'ACTIVE'"]; const params = [vendorId];
  if (query.filters.search) { where.push("(p.name LIKE ? OR COALESCE(cc.name, p.company_name) LIKE ?)"); const term = `%${query.filters.search}%`; params.push(term, term); }
  if (query.filters.startDate) { where.push("p.start_date >= ?"); params.push(query.filters.startDate); }
  const clause = where.join(" AND ");
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM projects p INNER JOIN project_vendors pv ON pv.project_id=p.id ${COMPANY_PM_JOIN} WHERE ${clause}`, params);
  const [rows] = await pool.query(`SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT}, p.start_date, p.end_date, p.expected_hours, p.status FROM projects p INNER JOIN project_vendors pv ON pv.project_id=p.id ${COMPANY_PM_JOIN} WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, p.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return { rows, total: Number(count.total) };
}

/**
 * Staffing requirements for a set of project ids, each row annotated with
 * how many project_assignments currently point at it. One query for
 * however many projects are being rendered (PM's own list, or the
 * Vendor's browse list) rather than N+1 queries per project.
 *
 * assigned_count is a LEFT JOIN + COUNT against project_assignments.requirement_id,
 * NOT against contractors.skill — the assignment was locked to a specific
 * requirement at the moment it was created (see assignmentRepository),
 * so a contractor changing their skill later can never change what an
 * existing assignment counts toward. See migration 008 for why.
 */
async function listRequirementsWithCounts(projectIds) {
  if (projectIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT pr.id, pr.project_id, COALESCE(s.code, pr.skill) AS skill, pr.skill_id, pr.required_count,
            COUNT(pa.id) AS assigned_count
     FROM project_requirements pr
     LEFT JOIN skills s ON s.id = pr.skill_id
     LEFT JOIN project_assignments pa ON pa.requirement_id = pr.id
     WHERE pr.project_id IN (?)
     GROUP BY pr.id, pr.project_id, s.code, pr.skill, pr.skill_id, pr.required_count
     ORDER BY COALESCE(s.code, pr.skill) ASC`,
    [projectIds]
  );
  return rows.map((r) => ({ ...r, assigned_count: Number(r.assigned_count) }));
}

/**
 * A single project_requirements row, scoped to the given project — used
 * by the eligible-contractors endpoint to resolve which skill a
 * requirementId refers to (and to 404 if it doesn't belong to the
 * project in the URL, same defense as
 * assignmentRepository.lockRequirementForUpdateById).
 */
async function findRequirementById(projectId, requirementId) {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.project_id, COALESCE(s.code, pr.skill) AS skill, pr.skill_id, pr.required_count
     FROM project_requirements pr LEFT JOIN skills s ON s.id = pr.skill_id
     WHERE pr.id = ? AND pr.project_id = ?
     LIMIT 1`,
    [requirementId, projectId]
  );
  return rows[0] || null;
}

module.exports = {
  create,
  createRequirements,
  listByPm,
  listPageByPm,
  findById,
  lockByIdForUpdate,
  markCompleted,
  listAvailablePageForVendor,
  listRequirementsWithCounts,
  findRequirementById,
};
