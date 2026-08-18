const { pool } = require("../config/db");

/**
 * Database access for the `timesheets` table. SQL lives only here, same
 * convention as every other repository. Shared between
 * contractorTimesheetService (submit/list own/edit rejected) and
 * pmTimesheetService (list pending for my projects/approve/reject) — same
 * reuse pattern as assignmentRepository, which is shared between
 * contractorProjectService and vendorAssignmentService.
 *
 * Module 4 revision: one row is now one DAY of work (work_date), not one
 * week (the old week_start_date — see migration 013). Every function
 * below operates on individual daily rows; there is no "weekly total"
 * anywhere in this file or in the table itself — a weekly VIEW is
 * computed by the frontend by grouping the daily rows this module
 * returns (see frontend/src/components/timesheets/weekGrouping.js).
 */

/**
 * Inserts a new PENDING daily timesheet row. Relies on the DB-level
 * UNIQUE(contractor_id, project_id, work_date) constraint (see migration
 * 013) as the actual duplicate-submission guarantee — the caller
 * (contractorTimesheetService) catches ER_DUP_ENTRY and turns it into a
 * clean 409, same pattern as vendorAssignmentService/ER_DUP_ENTRY
 * handling.
 */
async function create({ contractorId, projectId, workDate, hoursLogged }) {
  const [result] = await pool.query(
    `INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, status, submitted_at)
     VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
    [contractorId, projectId, workDate, hoursLogged]
  );
  return result.insertId;
}

/**
 * A single timesheet by id, with no ownership scoping — used right after
 * create()/update() (by the id this same request just wrote) and by the
 * PM review flow's final re-fetch, so there is no path through this
 * function alone that lets one contractor read another's row by guessing
 * an id (every caller does its own ownership check first).
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT t.id, t.contractor_id, t.project_id, p.name AS project_name,
            t.work_date, t.hours_logged, t.status,
            t.submitted_at, t.reviewed_at, reviewer.name AS reviewer_name
     FROM timesheets t
     INNER JOIN projects p ON p.id = t.project_id
     LEFT JOIN users reviewer ON reviewer.id = t.reviewed_by
     WHERE t.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ? toView(rows[0]) : null;
}

/**
 * Every daily timesheet belonging to the given contractor, newest day
 * first. Ownership lives in the WHERE clause — the caller
 * (contractorTimesheetService) resolves contractorId from the
 * authenticated contractor's own JWT, never from a query param. The
 * frontend groups this flat list into project -> week -> day for
 * display; nothing about that grouping happens here.
 */
async function listByContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.contractor_id, t.project_id, p.name AS project_name,
            t.work_date, t.hours_logged, t.status,
            t.submitted_at, t.reviewed_at, reviewer.name AS reviewer_name
     FROM timesheets t
     INNER JOIN projects p ON p.id = t.project_id
     LEFT JOIN users reviewer ON reviewer.id = t.reviewed_by
     WHERE t.contractor_id = ?
     ORDER BY t.work_date DESC, t.id DESC`,
    [contractorId]
  );
  return rows.map(toView);
}

/**
 * PENDING daily timesheets for projects owned by the given PM. Ownership
 * is enforced in the WHERE/JOIN clause (t.project_id -> p.id, p.pm_id =
 * ?), not filtered in JavaScript afterward — the SQL relationship IS the
 * access-control boundary here. Each row is one contractor's one day, so
 * a PM approves/rejects individual days, never a whole week at once.
 */
async function listPendingForPm(pmId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id, p.name AS project_name,
            c.id AS contractor_id, u.name AS contractor_name, c.skill AS contractor_skill,
            t.work_date, t.hours_logged, t.submitted_at
     FROM timesheets t
     INNER JOIN projects p ON p.id = t.project_id
     INNER JOIN contractors c ON c.id = t.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     WHERE p.pm_id = ? AND t.status = 'PENDING'
     ORDER BY t.submitted_at ASC`,
    [pmId]
  );
  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    project_name: r.project_name,
    contractor_id: r.contractor_id,
    contractor_name: r.contractor_name,
    contractor_skill: r.contractor_skill,
    work_date: r.work_date,
    hours_logged: Number(r.hours_logged),
    submitted_at: r.submitted_at,
  }));
}

/**
 * Locks the target timesheet row for the duration of the caller's
 * transaction (`SELECT ... FOR UPDATE` — must run on `conn` inside an
 * open transaction, see pmTimesheetService.reviewTimesheet). Joins in
 * the owning project's pm_id and current status in the same query so the
 * service can verify BOTH "PM owns this project" and "still PENDING"
 * from one locked read, before deciding whether to update.
 *
 * A second, concurrent review request for the SAME timesheet blocks here
 * until the first transaction commits or rolls back — that wait, plus
 * the conditional `WHERE status = 'PENDING'` in markReviewed below, is
 * what guarantees only one of two simultaneous approve/reject requests
 * actually transitions the row.
 */
async function lockForReview(conn, timesheetId) {
  const [rows] = await conn.query(
    `SELECT t.id, t.contractor_id, t.project_id, t.status, t.hours_logged, p.pm_id
     FROM timesheets t
     INNER JOIN projects p ON p.id = t.project_id
     WHERE t.id = ?
     LIMIT 1
     FOR UPDATE`,
    [timesheetId]
  );
  return rows[0] || null;
}

/**
 * Conditionally transitions PENDING -> APPROVED/REJECTED. The
 * `AND status = 'PENDING'` guard is the actual atomicity backstop, on
 * top of the row lock from lockForReview above — even if two requests
 * somehow both got past the lock (e.g. lock scope edge cases), only the
 * first UPDATE here can match a still-PENDING row; the second gets
 * affectedRows = 0 and the caller turns that into a clean 409, never a
 * silent overwrite of the first review's outcome. A PM always reviews
 * exactly one daily row at a time — this never touches any row besides
 * the one identified by timesheetId, so there is no "approve the whole
 * week" path anywhere in this codebase.
 */
async function markReviewed(conn, timesheetId, status, reviewedBy) {
  const [result] = await conn.query(
    `UPDATE timesheets
     SET status = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ? AND status = 'PENDING'`,
    [status, reviewedBy, timesheetId]
  );
  return result.affectedRows > 0;
}

/**
 * Locks the target row for a contractor's own edit
 * (PATCH /api/contractor/timesheets/:id — see
 * contractorTimesheetService.updateTimesheet). Deliberately a separate,
 * smaller query than lockForReview above: this path never needs the
 * owning project's pm_id, and it does need work_date/hours_logged so the
 * service can build a full "what actually changed" picture and re-run
 * date-range validation against the (freshly-fetched) project.
 */
async function lockForOwnerEdit(conn, timesheetId) {
  const [rows] = await conn.query(
    `SELECT id, contractor_id, project_id, work_date, hours_logged, status
     FROM timesheets
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [timesheetId]
  );
  return rows[0] || null;
}

/**
 * Applies a contractor's edit to their own REJECTED daily log and resets
 * it back into the PM's review queue. The conditional
 * `WHERE id = ? AND status = 'REJECTED'` is the same atomicity pattern as
 * markReviewed above — even with the row lock from lockForOwnerEdit
 * already held, this is the real guarantee that a row which stopped
 * being REJECTED between the lock read and this UPDATE (should be
 * unreachable, but not assumed) cannot be silently edited.
 *
 * reviewed_by/reviewed_at are explicitly cleared (not just left stale)
 * because this is functionally a brand new submission — the previous
 * reviewer's decision no longer applies to the new hours/date being
 * reviewed. submitted_at is refreshed to NOW() for the same reason: this
 * row is re-entering the PENDING queue now, not when it was first
 * submitted, so it should sort into the PM's queue (ordered by
 * submitted_at ASC — see listPendingForPm) at its true resubmission time.
 * Relies on the same UNIQUE(contractor_id, project_id, work_date)
 * constraint as create() above if the edited work_date collides with
 * another existing row for this contractor+project — the caller
 * (contractorTimesheetService) catches ER_DUP_ENTRY and turns it into a
 * clean 409.
 */
async function updateRejectedLog(conn, timesheetId, { workDate, hoursLogged }) {
  const [result] = await conn.query(
    `UPDATE timesheets
     SET work_date = ?, hours_logged = ?, status = 'PENDING',
         reviewed_by = NULL, reviewed_at = NULL, submitted_at = NOW()
     WHERE id = ? AND status = 'REJECTED'`,
    [workDate, hoursLogged, timesheetId]
  );
  return result.affectedRows > 0;
}

function toView(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    work_date: row.work_date,
    hours_logged: Number(row.hours_logged),
    status: row.status,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewer_name: row.reviewer_name || null,
  };
}

module.exports = {
  create,
  findById,
  listByContractor,
  listPendingForPm,
  lockForReview,
  markReviewed,
  lockForOwnerEdit,
  updateRejectedLog,
};
