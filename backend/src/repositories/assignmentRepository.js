const { pool } = require("../config/db");


// Use a friendly duplicate pre-check; the unique constraint remains the concurrency guarantee.
async function existsFor(contractorId, projectId) {
  const [rows] = await pool.query(
    `SELECT id FROM project_assignments WHERE contractor_id = ? AND project_id = ? LIMIT 1`,
    [contractorId, projectId]
  );
  return rows.length > 0;
}

// Lock the requirement in the caller's transaction before checking staffing capacity.
async function lockRequirementForUpdate(conn, projectId, skill) {
  const [rows] = await conn.query(
    `SELECT pr.id, pr.project_id, COALESCE(s.code, pr.skill) AS skill, pr.required_count, pr.status
     FROM project_requirements pr LEFT JOIN skills s ON s.id = pr.skill_id
     WHERE pr.project_id = ? AND COALESCE(s.code, pr.skill) = ?
     LIMIT 1
     FOR UPDATE`,
    [projectId, skill]
  );
  return rows[0] || null;
}

// Lock the requirement only when it belongs to the requested project.
async function lockRequirementForUpdateById(conn, projectId, requirementId) {
  const [rows] = await conn.query(
    `SELECT pr.id, pr.project_id, COALESCE(s.code, pr.skill) AS skill, pr.required_count, pr.status
     FROM project_requirements pr LEFT JOIN skills s ON s.id = pr.skill_id
     WHERE pr.id = ? AND pr.project_id = ?
     LIMIT 1
     FOR UPDATE`,
    [requirementId, projectId]
  );
  return rows[0] || null;
}

// Check active assignments on the transaction connection; released rows do not block this lookup.
async function isContractorAssigned(conn, contractorId) {
  const [rows] = await conn.query(
    `SELECT id FROM project_assignments WHERE contractor_id = ? AND status = 'ACTIVE' LIMIT 1`,
    [contractorId]
  );
  return rows.length > 0;
}

async function lockOverlappingAssignments(conn, contractorId, startDate, endDate) {
  const [rows] = await conn.query(
    `SELECT id, project_id, start_date, end_date, actual_end_date
     FROM project_assignments
     WHERE contractor_id = ? AND status = 'ACTIVE'
       AND start_date <= COALESCE(?, '9999-12-31')
       AND COALESCE(end_date, '9999-12-31') >= ?
     FOR UPDATE`,
    [contractorId, endDate, startDate]
  );
  return rows;
}

// Count assignments on the same connection after acquiring the requirement lock.
async function countAssignmentsForRequirement(conn, requirementId) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count FROM project_assignments WHERE requirement_id = ?`,
    [requirementId]
  );
  return Number(rows[0].count);
}

// Insert the assignment in the same transaction as the locked capacity check.
async function createWithRequirement(conn, contractorId, projectId, requirementId, allocatedHours, startDate = null, endDate = null, rateCard = null) {
  const [result] = await conn.query(
    `INSERT INTO project_assignments (contractor_id, project_id, requirement_id, allocated_hours, bill_rate_snapshot, cost_rate_snapshot, currency, rate_card_id, assigned_date, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), COALESCE(?, CURDATE()), ?)`,
    [contractorId, projectId, requirementId, allocatedHours, rateCard?.bill_rate||null, rateCard?.cost_rate||null, rateCard?.currency||null, rateCard?.id||null, startDate, endDate]
  );
  return result.insertId;
}

async function rateSnapshotForContractorProject(conn, contractorId, projectId) {
  const [rows] = await conn.query(
    `SELECT bill_rate_snapshot, currency FROM project_assignments
     WHERE contractor_id = ? AND project_id = ? AND bill_rate_snapshot IS NOT NULL
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [contractorId, projectId]
  );
  return rows[0] ? { billRate: Number(rows[0].bill_rate_snapshot), currency: rows[0].currency || "USD" } : null;
}

async function billRateSnapshotForContractorProject(conn, contractorId, projectId) {
  return (await rateSnapshotForContractorProject(conn, contractorId, projectId))?.billRate ?? null;
}

// Write the PM-validated allocation on the caller's locked transaction connection.
async function updateAllocatedHours(conn, assignmentId, allocatedHours) {
  const [result] = await conn.query(
    `UPDATE project_assignments SET allocated_hours = ? WHERE id = ?`,
    [allocatedHours, assignmentId]
  );
  return result.affectedRows > 0;
}

// Sum active allocations under the project lock; legacy NULL allocations count as zero.
async function sumAllocatedHoursForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(allocated_hours), 0) AS total
     FROM project_assignments WHERE project_id = ? AND status = 'ACTIVE'`,
    [projectId]
  );
  return Number(rows[0].total);
}

async function assignmentDateBoundsForProject(conn, projectId) {
  const [[row]] = await conn.query(
    `SELECT MIN(assigned_date) AS first_assigned_date, MAX(assigned_date) AS last_assigned_date
     FROM project_assignments WHERE project_id = ?`,
    [projectId]
  );
  return row;
}

// Batch display totals without locks; enforce capacity separately inside the allocation transaction.
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

// Lock the active assignment before checking reserved hours to serialize concurrent submissions.
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

// Release assignments atomically with project completion while retaining assignment history.
async function releaseAllActiveForProject(conn, projectId, releasedBy) {
  const [result] = await conn.query(
    `UPDATE project_assignments pa JOIN projects p ON p.id = pa.project_id
     SET pa.status = 'RELEASED', pa.released_at = NOW(),
         pa.actual_end_date = COALESCE(pa.actual_end_date, LEAST(CURDATE(), COALESCE(p.end_date, CURDATE()))),
         pa.released_by = ?
     WHERE pa.project_id = ? AND pa.status = 'ACTIVE'`,
    [releasedBy, projectId]
  );
  return result.affectedRows;
}

async function releaseActiveAssignment(conn, assignmentId, actualEndDate, reason, releasedBy) {
  const [result] = await conn.query(
    `UPDATE project_assignments SET status = 'RELEASED', released_at = NOW(), actual_end_date = ?, release_reason = ?, released_by = ?
     WHERE id = ? AND status = 'ACTIVE'`, [actualEndDate, reason, releasedBy, assignmentId]
  );
  return result.affectedRows > 0;
}

// Return all contractor assignments with project-specific hour totals, preserving released history.
async function listProjectsForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description,
            COALESCE(cc.name, p.company_name) AS company_name, pm_user.name AS pm_name,
            p.start_date AS project_start_date,
            p.end_date AS project_end_date,
            p.status AS project_status,
            pa.assigned_date, pr.skill AS assigned_skill,
            pa.allocated_hours,
            pa.status AS assignment_status,
            pa.released_at AS assignment_released_at,
            pa.start_date AS assignment_start_date,
            pa.end_date AS assignment_end_date,
            pa.actual_end_date, pa.release_reason,
            COALESCE(SUM(CASE WHEN t.status = 'APPROVED' THEN t.hours_logged ELSE 0 END), 0) AS approved_hours,
            COALESCE(SUM(CASE WHEN t.status IN ('DRAFT', 'SUBMITTED') THEN t.hours_logged ELSE 0 END), 0) AS pending_hours
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
              pa.allocated_hours, pa.status, pa.released_at, pa.start_date, pa.end_date, pa.actual_end_date, pa.release_reason
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

// Include zero-hour assignments and distinguish all logged hours from approved billable hours.
async function listAssignedContractorsWithHours(projectId) {
  const [rows] = await pool.query(
    `SELECT pa.id AS assignment_id, pa.requirement_id, c.id AS contractor_id, u.name AS contractor_name,
            c.skill AS contractor_skill, c.status AS contractor_status,
            pa.allocated_hours, pa.bill_rate_snapshot, pa.currency, pa.status AS assignment_status, pa.released_at,
            pa.start_date, pa.end_date, pa.actual_end_date, pa.release_reason,
            COALESCE(SUM(t.hours_logged), 0) AS logged_hours,
            COALESCE(SUM(CASE WHEN t.status = 'APPROVED' THEN t.hours_logged ELSE 0 END), 0) AS approved_hours,
            COALESCE(SUM(CASE WHEN t.status IN ('DRAFT', 'SUBMITTED') THEN t.hours_logged ELSE 0 END), 0) AS pending_hours
     FROM project_assignments pa
     INNER JOIN contractors c ON c.id = pa.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN timesheets t ON t.contractor_id = pa.contractor_id AND t.project_id = pa.project_id
     WHERE pa.project_id = ?
     GROUP BY pa.id, pa.requirement_id, c.id, u.name, c.skill, c.status,
              pa.allocated_hours, pa.bill_rate_snapshot, pa.currency, pa.status, pa.released_at,
              pa.start_date, pa.end_date, pa.actual_end_date, pa.release_reason
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
      bill_rate_snapshot: r.bill_rate_snapshot === null ? null : Number(r.bill_rate_snapshot),
      currency: r.currency,
      assignment_status: r.assignment_status,
      released_at: r.released_at,
      start_date: r.start_date,
      end_date: r.end_date,
      actual_end_date: r.actual_end_date,
      release_reason: r.release_reason,
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
  lockOverlappingAssignments,
  countAssignmentsForRequirement,
  createWithRequirement,
  billRateSnapshotForContractorProject,
  rateSnapshotForContractorProject,
  updateAllocatedHours,
  sumAllocatedHoursForProject,
  assignmentDateBoundsForProject,
  sumAllocatedHoursForProjects,
  lockActiveForContractorProject,
  releaseAllActiveForProject,
  releaseActiveAssignment,
  listProjectsForContractor,
  listAssignedContractorsWithHours,
};
