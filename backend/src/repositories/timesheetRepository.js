const { pool } = require("../config/db");

// Persist daily logs; calendar-week pagination selects complete groups of those rows.

// The unique contractor/project/date key prevents duplicate daily logs under concurrency.
async function create(conn, { contractorId, projectId, workDate, hoursLogged, description = null }) {
  const [result] = await conn.query(
    `INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, description, status)
     VALUES (?, ?, ?, ?, ?, 'DRAFT')`,
    [contractorId, projectId, workDate, hoursLogged, description]
  );
  return result.insertId;
}

// Unscoped timesheet lookup requires prior ownership checks by the caller.
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT t.id, t.contractor_id, t.project_id, p.name AS project_name,
            t.work_date, t.hours_logged, t.description, t.status, t.rejection_reason,
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

// Scope daily history to the authenticated contractor in SQL.
async function listByContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.contractor_id, t.project_id, p.name AS project_name,
            t.work_date, t.hours_logged, t.description, t.status, t.rejection_reason,
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

async function listPageByContractor(contractorId, query) {
  const where = ["t.contractor_id = ?"];
  const params = [contractorId];
  if (query.filters.status) { where.push("t.status = ?"); params.push(query.filters.status); }
  if (query.filters.projectId) { where.push("t.project_id = ?"); params.push(query.filters.projectId); }
  if (query.filters.startDate) { where.push("t.work_date >= ?"); params.push(query.filters.startDate); }
  const clause = where.join(" AND ");

  // Count distinct non-empty Monday-based calendar weeks.
  const [[count]] = await pool.query(
    `SELECT COUNT(DISTINCT DATE_SUB(t.work_date, INTERVAL WEEKDAY(t.work_date) DAY)) AS total
     FROM timesheets t
     WHERE ${clause}`,
    params
  );
  const totalWeeks = Number(count?.total) || 0;
  if (totalWeeks === 0) {
    return { rows: [], total: 0 };
  }

  // Select week starts for the requested page.
  const [weekRows] = await pool.query(
    `SELECT DISTINCT DATE_SUB(t.work_date, INTERVAL WEEKDAY(t.work_date) DAY) AS week_start
     FROM timesheets t
     WHERE ${clause}
     ORDER BY week_start DESC
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, query.offset]
  );
  const weekStarts = weekRows.map((r) => r.week_start);
  if (!weekStarts.length) {
    return { rows: [], total: totalWeeks };
  }

  // Fetch every row in the selected weeks so pagination never splits a calendar week.
  const [rows] = await pool.query(
    `SELECT t.id, t.contractor_id, t.project_id, p.name AS project_name,
            t.work_date, t.hours_logged, t.description, t.status, t.rejection_reason,
            t.submitted_at, t.reviewed_at, reviewer.name AS reviewer_name
     FROM timesheets t
     INNER JOIN projects p ON p.id = t.project_id
     LEFT JOIN users reviewer ON reviewer.id = t.reviewed_by
     WHERE ${clause}
       AND DATE_SUB(t.work_date, INTERVAL WEEKDAY(t.work_date) DAY) IN (?)
     ORDER BY t.work_date DESC, t.id DESC`,
    [...params, weekStarts]
  );

  return { rows: rows.map(toView), total: totalWeeks };
}

// Enforce PM project ownership in SQL when listing daily rows awaiting review.
async function listPendingForPm(pmId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id, p.name AS project_name,
            c.id AS contractor_id, u.name AS contractor_name, c.skill AS contractor_skill,
            t.work_date, t.hours_logged, t.description, t.submitted_at
     FROM timesheets t
     INNER JOIN projects p ON p.id = t.project_id
     INNER JOIN contractors c ON c.id = t.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     WHERE p.pm_id = ? AND t.status = 'SUBMITTED'
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
    description: r.description || null,
    submitted_at: r.submitted_at,
  }));
}

async function listPendingPageForPm(pmId, query) {
  const where = ["p.pm_id = ?", "t.status = 'SUBMITTED'"];
  const params = [pmId];
  if (query.filters.projectId) { where.push("t.project_id = ?"); params.push(query.filters.projectId); }
  if (query.filters.startDate) { where.push("t.work_date >= ?"); params.push(query.filters.startDate); }
  if (query.filters.search) { where.push("(p.name LIKE ? OR u.name LIKE ?)"); const pattern = `%${query.filters.search}%`; params.push(pattern, pattern); }
  const clause = where.join(" AND ");
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM timesheets t INNER JOIN projects p ON p.id = t.project_id INNER JOIN contractors c ON c.id = t.contractor_id INNER JOIN users u ON u.id = c.user_id WHERE ${clause}`, params);
  const [rows] = await pool.query(`SELECT t.id, t.project_id, p.name AS project_name, c.id AS contractor_id, u.name AS contractor_name, c.skill AS contractor_skill, t.work_date, t.hours_logged, t.description, t.submitted_at FROM timesheets t INNER JOIN projects p ON p.id = t.project_id INNER JOIN contractors c ON c.id = t.contractor_id INNER JOIN users u ON u.id = c.user_id WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, t.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return {
    rows: rows.map((r) => ({ id: r.id, project_id: r.project_id, project_name: r.project_name, contractor_id: r.contractor_id, contractor_name: r.contractor_name, contractor_skill: r.contractor_skill, work_date: r.work_date, hours_logged: Number(r.hours_logged), description: r.description || null, submitted_at: r.submitted_at })),
    total: Number(count.total),
  };
}

// Lock the timesheet and read its project owner before applying a conditional review transition.
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

// Update only SUBMITTED rows so concurrent review decisions cannot overwrite each other.
async function markReviewed(conn, timesheetId, status, reviewedBy, rejectionReason = null) {
  const [result] = await conn.query(
    `UPDATE timesheets
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
     WHERE id = ? AND status = 'SUBMITTED'`,
    [status, reviewedBy, rejectionReason, timesheetId]
  );
  return result.affectedRows > 0;
}

// Lock the daily log before checking ownership and revalidating the contractor's edit.
async function lockForOwnerEdit(conn, timesheetId) {
  const [rows] = await conn.query(
    `SELECT id, contractor_id, project_id, work_date, hours_logged, description, rejection_reason, status
     FROM timesheets
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [timesheetId]
  );
  return rows[0] || null;
}

// Conditionally return a rejected log to DRAFT, clear its review, and refresh submitted_at.
async function updateRejectedLog(conn, timesheetId, { workDate, hoursLogged, description = null }) {
  const [result] = await conn.query(
    `UPDATE timesheets
     SET work_date = ?, hours_logged = ?, description = ?, status = 'DRAFT',
         reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL, submitted_at = NOW()
     WHERE id = ? AND status = 'REJECTED'`,
    [workDate, hoursLogged, description, timesheetId]
  );
  return result.affectedRows > 0;
}

// Keep draft edits in DRAFT without changing submission or review metadata.
async function updateDraftLog(conn, timesheetId, { workDate, hoursLogged, description = null }) {
  const [result] = await conn.query(
    `UPDATE timesheets
     SET work_date = ?, hours_logged = ?, description = ?
     WHERE id = ? AND status = 'DRAFT'`,
    [workDate, hoursLogged, description, timesheetId]
  );
  return result.affectedRows > 0;
}

async function lockOwnedByIds(conn, contractorId, ids) {
  const [rows] = await conn.query(
    `SELECT id, contractor_id, project_id, status FROM timesheets
     WHERE contractor_id = ? AND id IN (?) ORDER BY id ASC FOR UPDATE`,
    [contractorId, ids]
  );
  return rows;
}

async function markSubmitted(conn, ids) {
  const [result] = await conn.query(
    `UPDATE timesheets SET status = 'SUBMITTED', submitted_at = NOW(), reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL
     WHERE id IN (?) AND status IN ('DRAFT', 'REJECTED')`,
    [ids]
  );
  return result.affectedRows;
}

// Read reserved hours under the assignment lock, excluding the edited row to avoid double-counting.
async function sumReservedHoursForContractorProject(conn, contractorId, projectId, excludeTimesheetId = null) {
  const params = [contractorId, projectId];
  let sql = `SELECT COALESCE(SUM(hours_logged), 0) AS total
     FROM timesheets
     WHERE contractor_id = ? AND project_id = ? AND status IN ('DRAFT', 'SUBMITTED', 'APPROVED')`;
  if (excludeTimesheetId) {
    sql += ` AND id != ?`;
    params.push(excludeTimesheetId);
  }
  const [rows] = await conn.query(sql, params);
  return Number(rows[0].total);
}

// Read contractor-approved hours within the caller's transaction for billing and allocation checks.
async function sumApprovedHoursForContractorProject(conn, contractorId, projectId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(hours_logged), 0) AS total
     FROM timesheets WHERE contractor_id = ? AND project_id = ? AND status = 'APPROVED'`,
    [contractorId, projectId]
  );
  return Number(rows[0].total);
}

// Sum approved hours across all contractors for project-wide progress.
async function sumApprovedHoursForProject(projectId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(hours_logged), 0) AS total
     FROM timesheets WHERE project_id = ? AND status = 'APPROVED'`,
    [projectId]
  );
  return Number(rows[0].total);
}

// Batch approved-hour totals to avoid a query per project.
async function sumApprovedHoursForProjects(projectIds) {
  if (projectIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT project_id, COALESCE(SUM(hours_logged), 0) AS total
     FROM timesheets WHERE project_id IN (?) AND status = 'APPROVED'
     GROUP BY project_id`,
    [projectIds]
  );
  return rows.map((r) => ({ project_id: r.project_id, approved_hours: Number(r.total) }));
}

// Read approved hours on the locked capacity-update connection to avoid stale validation.
async function sumApprovedHoursForProjectForUpdate(conn, projectId) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(hours_logged), 0) AS total
     FROM timesheets WHERE project_id = ? AND status = 'APPROVED'`,
    [projectId]
  );
  return Number(row.total);
}

async function workDateBoundsForProject(conn, projectId) {
  const [[row]] = await conn.query(
    `SELECT MIN(work_date) AS first_work_date, MAX(work_date) AS last_work_date
     FROM timesheets WHERE project_id = ?`,
    [projectId]
  );
  return row;
}

async function sumReservedHoursForContractorProjectDate(conn, contractorId, projectId, workDate, excludeId) {
  const [rows] = await conn.query(`SELECT COALESCE(SUM(hours_logged),0) AS total FROM timesheets WHERE contractor_id=? AND project_id=? AND work_date=? AND status IN ('DRAFT','SUBMITTED','APPROVED') ${excludeId ? 'AND id != ?' : ''}`, excludeId ? [contractorId,projectId,workDate,excludeId] : [contractorId,projectId,workDate]);
  return Number(rows[0].total);
}
async function sumReservedHoursForContractorProjectWeek(conn, contractorId, projectId, workDate, excludeId) {
  const [rows] = await conn.query(`SELECT COALESCE(SUM(hours_logged),0) AS total FROM timesheets WHERE contractor_id=? AND project_id=? AND YEARWEEK(work_date,1)=YEARWEEK(?,1) AND status IN ('DRAFT','SUBMITTED','APPROVED') ${excludeId ? 'AND id != ?' : ''}`, excludeId ? [contractorId,projectId,workDate,excludeId] : [contractorId,projectId,workDate]);
  return Number(rows[0].total);
}
async function countSubmittedForProject(conn, projectId) { const [[row]]=await conn.query("SELECT COUNT(*) AS total FROM timesheets WHERE project_id=? AND status='SUBMITTED'",[projectId]); return Number(row.total); }

// Read approved rows by review time and ID within the milestone evaluation transaction.
async function listApprovedOrderedForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT id, contractor_id, hours_logged
     FROM timesheets
     WHERE project_id = ? AND status = 'APPROVED'
     ORDER BY reviewed_at ASC, id ASC`,
    [projectId]
  );
  return rows.map((r) => ({ id: r.id, contractor_id: r.contractor_id, hours_logged: Number(r.hours_logged) }));
}

function toView(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    work_date: row.work_date,
    hours_logged: Number(row.hours_logged),
    description: row.description || null,
    rejection_reason: row.rejection_reason || null,
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
  listPageByContractor,
  listPendingForPm,
  listPendingPageForPm,
  lockForReview,
  markReviewed,
  lockForOwnerEdit,
  updateRejectedLog,
  updateDraftLog,
  lockOwnedByIds,
  markSubmitted,
  sumReservedHoursForContractorProject,
  sumApprovedHoursForContractorProject,
  sumApprovedHoursForProject,
  sumApprovedHoursForProjectForUpdate,
  sumApprovedHoursForProjects,
  sumReservedHoursForContractorProjectDate,
  sumReservedHoursForContractorProjectWeek,
  countSubmittedForProject,
  workDateBoundsForProject,
  listApprovedOrderedForProject,
};
