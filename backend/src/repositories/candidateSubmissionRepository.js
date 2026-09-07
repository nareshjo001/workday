const { pool } = require("../config/db");

async function existsOpen(conn, projectId, requirementId, contractorId) {
  const [rows] = await conn.query("SELECT id FROM candidate_submissions WHERE project_id=? AND requirement_id=? AND contractor_id=? AND status IN ('SUBMITTED','SHORTLISTED') FOR UPDATE", [projectId, requirementId, contractorId]);
  return rows[0] || null;
}
async function create(conn, payload) {
  const [result] = await conn.query("INSERT INTO candidate_submissions (project_id,requirement_id,contractor_id,vendor_id,proposed_start_date,proposed_end_date) VALUES (?,?,?,?,?,?)", [payload.projectId,payload.requirementId,payload.contractorId,payload.vendorId,payload.startDate,payload.endDate]);
  return result.insertId;
}
async function listForVendor(vendorId) {
  const [rows] = await pool.query("SELECT cs.*, p.name AS project_name, pr.skill, u.name AS contractor_name FROM candidate_submissions cs JOIN projects p ON p.id=cs.project_id JOIN project_requirements pr ON pr.id=cs.requirement_id JOIN contractors c ON c.id=cs.contractor_id JOIN users u ON u.id=c.user_id WHERE cs.vendor_id=? ORDER BY cs.submitted_at DESC", [vendorId]); return rows;
}
async function listForPm(pmId) {
  const [rows] = await pool.query("SELECT cs.*, p.name AS project_name, pr.skill, u.name AS contractor_name, vu.name AS vendor_name FROM candidate_submissions cs JOIN projects p ON p.id=cs.project_id JOIN project_requirements pr ON pr.id=cs.requirement_id JOIN contractors c ON c.id=cs.contractor_id JOIN users u ON u.id=c.user_id JOIN users vu ON vu.id=cs.vendor_id WHERE p.pm_id=? ORDER BY FIELD(cs.status,'SUBMITTED','SHORTLISTED','ACCEPTED','REJECTED','WITHDRAWN'), cs.submitted_at ASC", [pmId]); return rows;
}
async function lockById(conn, id) { const [rows]=await conn.query("SELECT * FROM candidate_submissions WHERE id=? FOR UPDATE",[id]); return rows[0]||null; }
async function transition(conn,id,status,reviewedBy,reason=null){const [r]=await conn.query("UPDATE candidate_submissions SET status=?, reviewed_at=NOW(), reviewed_by=?, review_reason=? WHERE id=?",[status,reviewedBy,reason,id]);return r.affectedRows>0;}
async function withdraw(conn,id,vendorId){const [r]=await conn.query("UPDATE candidate_submissions SET status='WITHDRAWN', reviewed_at=NOW() WHERE id=? AND vendor_id=? AND status IN ('SUBMITTED','SHORTLISTED')",[id,vendorId]);return r.affectedRows>0;}
module.exports = { existsOpen, create, listForVendor, listForPm, lockById, transition, withdraw };
