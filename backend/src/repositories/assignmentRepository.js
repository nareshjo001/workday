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
 * "Is this contractor currently on an ACTIVE assignment ANYWHERE" check —
 * the one-contractor-one-project-AT-A-TIME rule (project hours/allocation
 * redesign: a RELEASED contractor is eligible for reassignment again, see
 * migration 016's active_contractor_key generated column). Must be called
 * on the transaction-scoped `conn` inside the same transaction that later
 * inserts the assignment. The actual concurrency guarantee against two
 * simultaneous assignments of the same contractor is the
 * UNIQUE(active_contractor_key) constraint (migration 016) — this
 * pre-check just turns the common case into a clean error instead of a
 * raw ER_DUP_ENTRY.
 */
async function isContractorAssigned(conn, contractorId) {
  const [rows] = await conn.query(
    `SELECT id FROM project_assignments WHERE contractor_id = ? AND status = 'ACTIVE' LIMIT 1`,
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
 * `allocatedHours` is always NULL at insert time (MVP fix 1: allocation
 * ownership belongs to the PM, never the Vendor — see
 * vendorAssignmentService.assignContractors, which never accepts an
 * hours value from the request, and pmProjectService.updateContractorAllocation,
 * the only place this column is ever set to a non-null value, afterward).
 * Must run on the same transaction-scoped `conn` as the capacity check
 * above — the row lock is what's actually preventing another transaction
 * from reading a stale count between the check and this insert. status
 * defaults to 'ACTIVE' (migration 016's column default) — every new
 * assignment starts active, never pre-released.
 */
async function createWithRequirement(conn, contractorId, projectId, requirementId, allocatedHours) {
  const [result] = await conn.query(
    `INSERT INTO project_assignments (contractor_id, project_id, requirement_id, allocated_hours, assigned_date)
     VALUES (?, ?, ?, ?, CURDATE())`,
    [contractorId, projectId, requirementId, allocatedHours]
  );
  return result.insertId;
}

/**
 * Updates ONLY allocated_hours on an existing assignment row — MVP fix 1
 * (the PM, not the Vendor, owns work-hour allocation; see
 * pmProjectService.updateContractorAllocation). Must run on the same
 * transaction-scoped `conn` as the row lock the caller already holds
 * (lockActiveForContractorProject below) — that lock, plus the caller's
 * own validation (project capacity, contractor already-approved-hours
 * floor) happening inside the same transaction, is what makes this update
 * safe under concurrency; this function itself does no validation, it
 * only writes the value it's given.
 */
async function updateAllocatedHours(conn, assignmentId, allocatedHours) {
  const [result] = await conn.query(
    `UPDATE project_assignments SET allocated_hours = ? WHERE id = ?`,
    [allocatedHours, assignmentId]
  );
  return result.affectedRows > 0;
}

/**
 * SUM(allocated_hours) across every currently-ACTIVE assignment on a
 * project — the authoritative "how much of this project's expected_hours
 * is already staffed" figure. Legacy pre-migration-016 assignments (NULL
 * allocated_hours) are coalesced to 0 so they never silently block new
 * allocations. Takes `conn` and must run INSIDE the same transaction that
 * holds the project row lock (projectRepository.lockByIdForUpdate) — this
 * is what makes "new total <= expected_hours" safe under concurrency: a
 * second transaction trying to allocate against the same project blocks
 * on that lock until this one commits, so it can never read a
 * stale/pre-insert total.
 */
async function sumAllocatedHoursForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(allocated_hours), 0) AS total
     FROM project_assignments WHERE project_id = ? AND status = 'ACTIVE'`,
    [projectId]
  );
  return Number(rows[0].total);
}

/**
 * Batch variant of sumAllocatedHoursForProject for LIST views (PM's own
 * project list, Vendor's browse list) — one query for however many
 * projects are being rendered rather than N+1. Plain pool read (no lock,
 * no transaction) — display-only, the real capacity guarantee is always
 * the transactional check in vendorAssignmentService, never this read.
 */
async function sumAllocatedHoursForProjects(projectIds) {
  if (projectIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT project_id, COALESCE(SUM(allocated_hours), 0) AS total
     FROM project_assignments WHERE project_id IN (?) AND status = 'ACTIVE'
     GROUP BY project_id`,
    [projectIds]
  );
  return rows.map((r) => ({ project_id: r.project_id, allocated_hours: Number(r.total) }));
}

/**
 * Locks this contractor's ACTIVE assignment on a project for the
 * duration of the caller's transaction (`SELECT ... FOR UPDATE` — must
 * run on `conn` inside an open transaction, see
 * contractorTimesheetService.submitTimesheet /
 * contractorTimesheetService.updateTimesheet). This is the actual
 * concurrency guarantee behind "a contractor can never submit more hours
 * than their remaining allocation, even with two near-simultaneous
 * submissions" — a second concurrent submission for the SAME
 * contractor+project blocks here until the first transaction commits or
 * rolls back, so the "reserved hours" SUM read after this lock is always
 * consistent with whatever the first request just inserted/committed.
 * Returns null if the contractor has no ACTIVE assignment on this
 * project (never assigned, or already RELEASED) — the caller turns that
 * into a clean 404/409 rather than allowing a submission with nothing to
 * check capacity against.
 */
async function lockActiveForContractorProject(conn, contractorId, projectId) {
  const [rows] = await conn.query(
    `SELECT id, contractor_id, project_id, allocated_hours, status
     FROM project_assignments
     WHERE contractor_id = ? AND project_id = ? AND status = 'ACTIVE'
     LIMIT 1
     FOR UPDATE`,
    [contractorId, projectId]
  );
  return rows[0] || null;
}

/**
 * Releases every currently-ACTIVE assignment on a project — the
 * mandatory side effect of project completion (spec requirement: a
 * project being marked COMPLETED must auto-release every active
 * contractor, never delete the assignment row). Must run on the same
 * transaction-scoped `conn` as projectRepository.markCompleted, so
 * "project completed" and "assignments released" always succeed or fail
 * together. Once released, active_contractor_key becomes NULL (migration
 * 016's generated column), which is what makes the contractor eligible
 * for a brand new assignment elsewhere.
 */
async function releaseAllActiveForProject(conn, projectId) {
  const [result] = await conn.query(
    `UPDATE project_assignments SET status = 'RELEASED', released_at = NOW()
     WHERE project_id = ? AND status = 'ACTIVE'`,
    [projectId]
  );
  return result.affectedRows;
}

/**
 * Projects assigned to a given contractor, joined with the project's own
 * fields (including company_name, added in the Module 3 revision) plus
 * this assignment's assigned_date and the skill it was assigned under.
 * Scoped by contractor_id — the caller (contractorProjectService)
 * resolves that id from the authenticated contractor's own JWT, never
 * from a query/body param.
 */
/**
 * Projects assigned to a given contractor (every assignment row they've
 * ever had — ACTIVE and RELEASED both, history is never dropped), each
 * annotated with allocated_hours/status/released_at (project hours
 * redesign) plus this contractor's own reserved (PENDING+APPROVED) and
 * approved hours logged against that specific project — the figures the
 * contractor-facing timesheet page banner needs (Allocated/Approved/
 * Pending/Remaining) computed once here rather than re-derived client
 * side from the flat timesheet list. Scoped by contractor_id — the
 * caller (contractorProjectService) resolves that id from the
 * authenticated contractor's own JWT, never from a query/body param.
 */
async function listProjectsForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description,
            COALESCE(cc.name, p.company_name) AS company_name, pm_user.name AS pm_name,
            p.start_date, p.end_date, p.status,
            pa.assigned_date, pr.skill AS assigned_skill,
            pa.allocated_hours, pa.status AS assignment_status, pa.released_at,
            COALESCE(SUM(CASE WHEN t.status = 'APPROVED' THEN t.hours_logged ELSE 0 END), 0) AS approved_hours,
            COALESCE(SUM(CASE WHEN t.status = 'PENDING' THEN t.hours_logged ELSE 0 END), 0) AS pending_hours
     FROM project_assignments pa
     INNER JOIN projects p ON p.id = pa.project_id
     LEFT JOIN project_requirements pr ON pr.id = pa.requirement_id
     LEFT JOIN users pm_user ON pm_user.id = p.pm_id
     LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
     LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
     LEFT JOIN timesheets t ON t.contractor_id = pa.contractor_id AND t.project_id = pa.project_id
     WHERE pa.contractor_id = ?
     GROUP BY pa.id, p.id, p.name, p.description, company_name, pm_user.name,
              p.start_date, p.end_date, p.status, pa.assigned_date, pr.skill,
              pa.allocated_hours, pa.status, pa.released_at
     ORDER BY pa.created_at DESC`,
    [contractorId]
  );
  return rows.map((r) => ({
    ...r,
    allocated_hours: r.allocated_hours === null ? null : Number(r.allocated_hours),
    approved_hours: Number(r.approved_hours),
    pending_hours: Number(r.pending_hours),
    remaining_hours:
      r.allocated_hours === null
        ? null
        : Math.max(0, Number(r.allocated_hours) - Number(r.approved_hours) - Number(r.pending_hours)),
  }));
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
    `SELECT pa.id AS assignment_id, pa.requirement_id, c.id AS contractor_id, u.name AS contractor_name,
            c.skill AS contractor_skill, c.status AS contractor_status,
            pa.allocated_hours, pa.status AS assignment_status, pa.released_at,
            COALESCE(SUM(t.hours_logged), 0) AS logged_hours,
            COALESCE(SUM(CASE WHEN t.status = 'APPROVED' THEN t.hours_logged ELSE 0 END), 0) AS approved_hours,
            COALESCE(SUM(CASE WHEN t.status = 'PENDING' THEN t.hours_logged ELSE 0 END), 0) AS pending_hours
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN timesheets t ON t.contractor_id = pa.contractor_id AND t.project_id = pa.project_id
     WHERE pa.project_id = ?
     GROUP BY pa.id, pa.requirement_id, c.id, u.name, c.skill, c.status,
              pa.allocated_hours, pa.status, pa.released_at
     ORDER BY u.name ASC`,
    [projectId]
  );
  return rows.map((r) => {
    const allocatedHours = r.allocated_hours === null ? null : Number(r.allocated_hours);
    const approvedHours = Number(r.approved_hours);
    const pendingHours = Number(r.pending_hours);
    return {
      assignment_id: r.assignment_id,
      requirement_id: r.requirement_id,
      contractor_id: r.contractor_id,
      contractor_name: r.contractor_name,
      contractor_skill: r.contractor_skill,
      contractor_status: r.contractor_status,
      allocated_hours: allocatedHours,
      assignment_status: r.assignment_status,
      released_at: r.released_at,
      logged_hours: Number(r.logged_hours),
      approved_hours: approvedHours,
      pending_hours: pendingHours,
      remaining_hours: allocatedHours === null ? null : Math.max(0, allocatedHours - approvedHours - pendingHours),
    };
  });
}

module.exports = {
  existsFor,
  lockRequirementForUpdate,
  lockRequirementForUpdateById,
  isContractorAssigned,
  countAssignmentsForRequirement,
  createWithRequirement,
  updateAllocatedHours,
  sumAllocatedHoursForProject,
  sumAllocatedHoursForProjects,
  lockActiveForContractorProject,
  releaseAllActiveForProject,
  listProjectsForContractor,
  listAssignedContractorsWithHours,
};
