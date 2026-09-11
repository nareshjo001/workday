const { pool } = require("../config/db");

async function projectForPm(projectId, pmId) {
  const [rows] = await pool.query("SELECT id, name, status FROM projects WHERE id=? AND pm_id=? LIMIT 1", [projectId, pmId]);
  return rows[0] || null;
}

async function metrics(projectId) {
  const [timesheets, requirements, candidates, assignments, documents, invoices] = await Promise.all([
    pool.query("SELECT status, COUNT(*) count, COALESCE(SUM(hours_logged),0) hours, MIN(submitted_at) oldest FROM timesheets WHERE project_id=? GROUP BY status", [projectId]),
    pool.query("SELECT COALESCE(SUM(required_count>assigned_count),0) open_requirements, COALESCE(SUM(GREATEST(required_count-assigned_count,0)),0) remaining_slots FROM (SELECT pr.id,pr.required_count,COUNT(pa.id) assigned_count FROM project_requirements pr LEFT JOIN project_assignments pa ON pa.requirement_id=pr.id AND pa.status='ACTIVE' WHERE pr.project_id=? GROUP BY pr.id,pr.required_count) x", [projectId]),
    pool.query("SELECT COUNT(*) count, MIN(submitted_at) oldest FROM candidate_submissions WHERE project_id=? AND status='SUBMITTED'", [projectId]),
    pool.query("SELECT u.name contractor_name, pa.end_date, DATEDIFF(pa.end_date,CURDATE()) days_remaining FROM project_assignments pa JOIN contractors c ON c.id=pa.contractor_id JOIN users u ON u.id=c.user_id WHERE pa.project_id=? AND pa.status='ACTIVE' AND pa.end_date IS NOT NULL AND pa.end_date<=DATE_ADD(CURDATE(),INTERVAL 14 DAY) ORDER BY pa.end_date ASC,pa.id ASC", [projectId]),
    pool.query("SELECT COUNT(DISTINCT d.id) count, MIN(d.expiry_date) nearest_expiry FROM contractor_documents d JOIN project_assignments pa ON pa.contractor_id=d.contractor_id AND pa.project_id=? AND pa.status='ACTIVE' WHERE d.status='VERIFIED' AND d.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 30 DAY)", [projectId]),
    pool.query("SELECT currency, COUNT(*) count, COALESCE(SUM(total_amount),0) total, MIN(submitted_at) oldest FROM invoices WHERE project_id=? AND status='SUBMITTED' GROUP BY currency", [projectId]),
  ]);
  return { timesheets: timesheets[0], requirements: requirements[0][0], candidates: candidates[0][0], assignments: assignments[0], documents: documents[0][0], invoices: invoices[0] };
}

module.exports = { projectForPm, metrics };
