const { pool } = require("../config/db");


// Create projects and requirements on one connection; derive company identity from the PM association.
async function create(conn, { name, description, pmId, startDate, endDate, expectedHours }) {
  const runner = conn || pool;
  const [result] = await runner.query(
    `INSERT INTO projects (name, description, pm_id, start_date, end_date, expected_hours, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [name, description, pmId, startDate, endDate, expectedHours]
  );
  return result.insertId;
}

// Resolve the linked client company while retaining the legacy company-name fallback in reads.
const COMPANY_PM_JOIN = `
  LEFT JOIN users pm_user ON pm_user.id = p.pm_id
  LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
  LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
`;
const COMPANY_PM_SELECT = `COALESCE(cc.name, p.company_name) AS company_name, pm_user.name AS pm_name`;

// Insert requirements in the same transaction as their project.
async function createRequirements(conn, projectId, requirements) {
  if (requirements.length === 0) return;
  for (const requirement of requirements) {
    await conn.query(`INSERT INTO project_requirements (project_id, skill, skill_id, required_count)
      SELECT ?, ?, id, ? FROM skills WHERE code = ? AND is_active = 1`, [projectId, requirement.skill, requirement.requiredCount, requirement.skill]);
  }
}

// Scope project history to the owning PM in SQL, including completed projects.
async function listByPm(pmId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT},
            p.start_date, p.end_date, p.expected_hours, p.budget, p.currency, p.max_hours_per_day, p.max_hours_per_week, p.allow_weekend, p.backdate_limit_days, p.candidate_response_sla_hours, p.status
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
  const [rows] = await pool.query(`SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT}, p.start_date, p.end_date, p.expected_hours, p.budget, p.currency, p.max_hours_per_day, p.max_hours_per_week, p.allow_weekend, p.backdate_limit_days, p.candidate_response_sla_hours, p.status FROM projects p ${COMPANY_PM_JOIN} WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, p.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return { rows, total: Number(count.total) };
}

// Unscoped project lookup requires authorization in the calling service.
async function findById(projectId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT},
            p.pm_id, p.start_date, p.end_date, p.expected_hours, p.budget, p.currency, p.max_hours_per_day, p.max_hours_per_week, p.allow_weekend, p.backdate_limit_days, p.candidate_response_sla_hours, p.status
     FROM projects p
     ${COMPANY_PM_JOIN}
     WHERE p.id = ?
     LIMIT 1`,
    [projectId]
  );
  return rows[0] || null;
}

// Lock the project in the caller's transaction to serialize capacity changes and completion.
async function lockByIdForUpdate(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT id, pm_id, name, description, start_date, end_date, expected_hours, budget, currency, max_hours_per_day, max_hours_per_week, allow_weekend, backdate_limit_days, candidate_response_sla_hours, status
     FROM projects WHERE id = ? LIMIT 1 FOR UPDATE`,
    [projectId]
  );
  return rows[0] || null;
}

// Make completion conditional so an already-completed project cannot be completed twice.
async function markCompleted(conn, projectId) {
  const [result] = await conn.query(
    `UPDATE projects SET status = 'COMPLETED' WHERE id = ? AND status != 'COMPLETED'`,
    [projectId]
  );
  return result.affectedRows > 0;
}

async function updateLifecycle(conn, projectId, fields) {
  const columns = { name: "name", description: "description", startDate: "start_date", endDate: "end_date", expectedHours: "expected_hours", budget: "budget", currency: "currency", maxHoursPerDay: "max_hours_per_day", maxHoursPerWeek: "max_hours_per_week", allowWeekend: "allow_weekend", backdateLimitDays: "backdate_limit_days", candidateResponseSlaHours: "candidate_response_sla_hours", status: "status" };
  const entries = Object.entries(fields).filter(([key]) => Object.hasOwn(columns, key));
  if (!entries.length) return;
  await conn.query(`UPDATE projects SET ${entries.map(([key]) => `${columns[key]}=?`).join(", ")} WHERE id=?`, [...entries.map(([, value]) => value), projectId]);
}

async function lockRequirement(conn, projectId, requirementId) {
  const [rows] = await conn.query("SELECT id, project_id, required_count, description, status FROM project_requirements WHERE id=? AND project_id=? LIMIT 1 FOR UPDATE", [requirementId, projectId]);
  return rows[0] || null;
}
async function assignmentCountForRequirement(conn, requirementId) { const [[row]] = await conn.query("SELECT COUNT(*) AS total FROM project_assignments WHERE requirement_id=? AND status='ACTIVE'", [requirementId]); return Number(row.total); }
async function updateRequirement(conn, requirementId, fields) { const entries=Object.entries(fields); if(!entries.length)return; const columns={requiredCount:"required_count",description:"description",status:"status"}; await conn.query(`UPDATE project_requirements SET ${entries.map(([key])=>`${columns[key]}=?`).join(", ")} WHERE id=?`,[...entries.map(([,value])=>value),requirementId]); }

async function listAvailablePageForVendor(query, vendorId) {
  const where = ["p.status = 'ACTIVE'", "(p.end_date IS NULL OR p.end_date >= CURDATE())", "pv.vendor_id = ?", "pv.status = 'ACTIVE'"]; const params = [vendorId];
  if (query.filters.search) { where.push("(p.name LIKE ? OR COALESCE(cc.name, p.company_name) LIKE ?)"); const term = `%${query.filters.search}%`; params.push(term, term); }
  if (query.filters.startDate) { where.push("p.start_date >= ?"); params.push(query.filters.startDate); }
  const clause = where.join(" AND ");
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM projects p INNER JOIN project_vendors pv ON pv.project_id=p.id ${COMPANY_PM_JOIN} WHERE ${clause}`, params);
  const [rows] = await pool.query(`SELECT p.id, p.name, p.description, ${COMPANY_PM_SELECT}, p.start_date, p.end_date, p.expected_hours, p.status FROM projects p INNER JOIN project_vendors pv ON pv.project_id=p.id ${COMPANY_PM_JOIN} WHERE ${clause} ORDER BY ${query.sortColumn} ${query.order}, p.id ${query.order} LIMIT ? OFFSET ?`, [...params, query.pageSize, query.offset]);
  return { rows, total: Number(count.total) };
}

// Batch counts by assignment requirement_id so later skill changes cannot alter historical staffing.
async function listRequirementsWithCounts(projectIds) {
  if (projectIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT pr.id, pr.project_id, COALESCE(s.code, pr.skill) AS skill, pr.skill_id, pr.required_count,
            pr.description, pr.status,
            COUNT(CASE WHEN pa.status = 'ACTIVE' THEN pa.id END) AS assigned_count
     FROM project_requirements pr
     LEFT JOIN skills s ON s.id = pr.skill_id
     LEFT JOIN project_assignments pa ON pa.requirement_id = pr.id
     WHERE pr.project_id IN (?)
     GROUP BY pr.id, pr.project_id, s.code, pr.skill, pr.skill_id, pr.required_count, pr.description, pr.status
     ORDER BY COALESCE(s.code, pr.skill) ASC`,
    [projectIds]
  );
  return rows.map((r) => ({ ...r, assigned_count: Number(r.assigned_count) }));
}

// Resolve a requirement only within its requested project.
async function findRequirementById(projectId, requirementId) {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.project_id, COALESCE(s.code, pr.skill) AS skill, pr.skill_id, pr.required_count,
            pr.description, pr.status
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
  updateLifecycle,
  lockRequirement,
  assignmentCountForRequirement,
  updateRequirement,
  listAvailablePageForVendor,
  listRequirementsWithCounts,
  findRequirementById,
};
