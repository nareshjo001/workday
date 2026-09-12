const { pool } = require("../config/db");

async function ownedProject(pmId, projectId) {
  const [[project]] = await pool.query("SELECT id, name, status FROM projects WHERE id=? AND pm_id=?", [projectId, pmId]);
  return project || null;
}

const actorSelect = "a.id, a.action, a.entity_type, a.entity_id, a.before_json, a.after_json, a.created_at, u.name actor_name, a.actor_role";
const actorJoin = "FROM audit_log a JOIN users u ON u.id=a.actor_user_id";
const projectClause = `(
  (a.entity_type='project' AND a.entity_id=?)
  OR (a.entity_type='project_requirement' AND EXISTS (SELECT 1 FROM project_requirements r WHERE r.id=CAST(a.entity_id AS UNSIGNED) AND r.project_id=?))
  OR (a.entity_type='candidate_submission' AND EXISTS (SELECT 1 FROM candidate_submissions c WHERE c.id=CAST(a.entity_id AS UNSIGNED) AND c.project_id=?))
  OR (a.entity_type='project_assignment' AND EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.id=CAST(a.entity_id AS UNSIGNED) AND pa.project_id=?))
  OR (a.entity_type='timesheet' AND EXISTS (SELECT 1 FROM timesheets t WHERE t.id=CAST(a.entity_id AS UNSIGNED) AND t.project_id=?))
  OR (a.entity_type='invoice' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id=CAST(a.entity_id AS UNSIGNED) AND i.project_id=?))
  OR (a.entity_type='payment' AND EXISTS (SELECT 1 FROM payments pay JOIN invoices i ON i.id=pay.invoice_id WHERE pay.id=CAST(a.entity_id AS UNSIGNED) AND i.project_id=?))
  OR (a.entity_type='milestone' AND EXISTS (SELECT 1 FROM milestones m WHERE m.id=CAST(a.entity_id AS UNSIGNED) AND m.project_id=?))
)`;

async function page(sql, params, { page: pageNumber, limit }) {
  const offset = (pageNumber - 1) * limit;
  const [rows] = await pool.query(`${sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const [[count]] = await pool.query(`SELECT COUNT(*) total ${sql.slice(sql.indexOf("FROM"))}`, params);
  return { rows, total: Number(count.total) };
}

function projectActivity(projectId, paging) {
  return page(`SELECT ${actorSelect} ${actorJoin} WHERE ${projectClause}`, Array(8).fill(projectId), paging);
}

function vendorActivity(vendorId, paging) {
  const scope = `(
    (a.entity_type='contractor' AND EXISTS (SELECT 1 FROM contractors c WHERE c.id=CAST(a.entity_id AS UNSIGNED) AND c.vendor_id=?))
    OR (a.entity_type='candidate_submission' AND EXISTS (SELECT 1 FROM candidate_submissions c WHERE c.id=CAST(a.entity_id AS UNSIGNED) AND c.vendor_id=?))
    OR (a.entity_type='project_assignment' AND EXISTS (SELECT 1 FROM project_assignments pa JOIN contractors c ON c.id=pa.contractor_id WHERE pa.id=CAST(a.entity_id AS UNSIGNED) AND c.vendor_id=?))
    OR (a.entity_type='timesheet' AND EXISTS (SELECT 1 FROM timesheets t JOIN contractors c ON c.id=t.contractor_id WHERE t.id=CAST(a.entity_id AS UNSIGNED) AND c.vendor_id=?))
    OR (a.entity_type='contractor_document' AND EXISTS (SELECT 1 FROM contractor_documents d JOIN contractors c ON c.id=d.contractor_id WHERE d.id=CAST(a.entity_id AS UNSIGNED) AND c.vendor_id=?))
    OR (a.entity_type='invoice' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id=CAST(a.entity_id AS UNSIGNED) AND i.vendor_id=?))
    OR (a.entity_type='payment' AND EXISTS (SELECT 1 FROM payments pay JOIN invoices i ON i.id=pay.invoice_id WHERE pay.id=CAST(a.entity_id AS UNSIGNED) AND i.vendor_id=?))
    OR (a.entity_type='rate_card' AND EXISTS (SELECT 1 FROM rate_cards rc WHERE rc.id=CAST(a.entity_id AS UNSIGNED) AND rc.vendor_id=?))
  )`;
  return page(`SELECT ${actorSelect} ${actorJoin} WHERE ${scope}`, Array(8).fill(vendorId), paging);
}

async function contractorIdForUser(userId) {
  const [[contractor]] = await pool.query("SELECT id FROM contractors WHERE user_id=?", [userId]);
  return contractor?.id || null;
}

function contractorActivity(contractorId, paging) {
  const scope = `(
    (a.entity_type='contractor' AND a.entity_id=?)
    OR (a.entity_type='timesheet' AND EXISTS (SELECT 1 FROM timesheets t WHERE t.id=CAST(a.entity_id AS UNSIGNED) AND t.contractor_id=?))
    OR (a.entity_type='project_assignment' AND EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.id=CAST(a.entity_id AS UNSIGNED) AND pa.contractor_id=?))
    OR (a.entity_type='candidate_submission' AND EXISTS (SELECT 1 FROM candidate_submissions c WHERE c.id=CAST(a.entity_id AS UNSIGNED) AND c.contractor_id=?))
    OR (a.entity_type='contractor_document' AND EXISTS (SELECT 1 FROM contractor_documents d WHERE d.id=CAST(a.entity_id AS UNSIGNED) AND d.contractor_id=?))
    OR (a.entity_type='contractor_unavailability' AND EXISTS (SELECT 1 FROM contractor_unavailability u2 WHERE u2.id=CAST(a.entity_id AS UNSIGNED) AND u2.contractor_id=?))
  )`;
  return page(`SELECT ${actorSelect} ${actorJoin} WHERE ${scope}`, Array(6).fill(contractorId), paging);
}

module.exports = { ownedProject, projectActivity, vendorActivity, contractorIdForUser, contractorActivity };
