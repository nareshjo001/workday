const { pool } = require("../config/db");

function whereFor(filters, scope) {
  const where = ["p.status = 'ACTIVE'", "pr.status = 'OPEN'"];
  const params = [];
  if (scope.type === "pm") { where.push("p.pm_id = ?"); params.push(scope.id); }
  else { where.push("pv.vendor_id = ?", "pv.status = 'ACTIVE'"); params.push(scope.id); }
  if (filters.clientId) { where.push("cc.id = ?"); params.push(filters.clientId); }
  if (filters.projectId) { where.push("p.id = ?"); params.push(filters.projectId); }
  if (filters.skill) { where.push("COALESCE(s.code, pr.skill) = ?"); params.push(filters.skill); }
  return { where, params };
}

/**
 * One requirement per row, with decision-state counts.  The vendor query
 * deliberately joins the active M09 project-vendor relationship: a vendor
 * loses visibility the moment PM access is revoked, even for its own prior
 * submissions. PM data is always scoped by the owning PM.
 */
async function listRequirementPipeline(filters, scope) {
  const { where, params } = whereFor(filters, scope);
  const candidateScope = scope.type === "vendor" ? " AND cs.vendor_id = ?" : "";
  const candidateParams = scope.type === "vendor" ? [scope.id] : [];
  const vendorJoin = scope.type === "vendor" ? "JOIN project_vendors pv ON pv.project_id = p.id" : "";
  const [rows] = await pool.query(`
    SELECT p.id AS project_id, p.name AS project_name, p.candidate_response_sla_hours, cc.id AS company_id,
           COALESCE(cc.name, p.company_name) AS company_name,
           pr.id AS requirement_id, COALESCE(s.code, pr.skill) AS skill, pr.required_count,
           COUNT(DISTINCT CASE WHEN pa.status = 'ACTIVE' THEN pa.id END) AS assigned_count,
           COUNT(DISTINCT CASE WHEN cs.status = 'SUBMITTED' THEN cs.id END) AS submitted_count,
           COUNT(DISTINCT CASE WHEN cs.status = 'SHORTLISTED' THEN cs.id END) AS shortlisted_count,
           COUNT(DISTINCT CASE WHEN cs.status = 'ACCEPTED' THEN cs.id END) AS accepted_count,
           COUNT(DISTINCT CASE WHEN cs.status = 'REJECTED' THEN cs.id END) AS rejected_count,
           COUNT(DISTINCT CASE WHEN cs.status = 'WITHDRAWN' THEN cs.id END) AS withdrawn_count,
           MIN(CASE WHEN cs.status IN ('SUBMITTED', 'SHORTLISTED') THEN cs.submitted_at END) AS oldest_open_submitted_at
    FROM projects p
    ${vendorJoin}
    JOIN project_requirements pr ON pr.project_id = p.id
    LEFT JOIN skills s ON s.id = pr.skill_id
    LEFT JOIN project_managers pm_link ON pm_link.user_id = p.pm_id
    LEFT JOIN client_companies cc ON cc.id = pm_link.company_id
    LEFT JOIN candidate_submissions cs ON cs.requirement_id = pr.id${candidateScope}
    LEFT JOIN project_assignments pa ON pa.requirement_id = pr.id
    WHERE ${where.join(" AND ")}
    GROUP BY p.id, p.name, p.candidate_response_sla_hours, cc.id, cc.name, p.company_name,
             pr.id, s.code, pr.skill, pr.required_count
    ORDER BY oldest_open_submitted_at IS NULL, oldest_open_submitted_at ASC, p.id ASC, pr.id ASC
  `, [...candidateParams, ...params]);
  return rows;
}

module.exports = { listRequirementPipeline };
