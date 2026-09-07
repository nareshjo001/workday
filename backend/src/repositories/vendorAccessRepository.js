const { pool } = require('../config/db');
async function companyForPm(pmId, conn=pool){const [r]=await conn.query('SELECT company_id FROM project_managers WHERE user_id=? LIMIT 1',[pmId]);return r[0]||null;}
async function connect(conn,companyId,vendorId,pmId){await conn.query("INSERT INTO client_vendor_relationships (client_company_id,vendor_id,status,invited_by,accepted_at) VALUES (?,?,'ACTIVE',?,NOW()) ON DUPLICATE KEY UPDATE status='ACTIVE',invited_by=VALUES(invited_by),accepted_at=NOW()",[companyId,vendorId,pmId]);}
async function grantProject(conn,projectId,vendorId){await conn.query("INSERT INTO project_vendors (project_id,vendor_id,status) VALUES (?,?,'ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'",[projectId,vendorId]);}
async function revokeConnection(conn, companyId, vendorId){
  await conn.query("UPDATE client_vendor_relationships SET status='REVOKED' WHERE client_company_id=? AND vendor_id=? AND status='ACTIVE'",[companyId,vendorId]);
  await conn.query("UPDATE project_vendors pv JOIN projects p ON p.id=pv.project_id JOIN project_managers pm ON pm.user_id=p.pm_id SET pv.status='REVOKED' WHERE pm.company_id=? AND pv.vendor_id=? AND pv.status='ACTIVE'",[companyId,vendorId]);
}
async function revokeProject(conn,projectId,vendorId){await conn.query("UPDATE project_vendors SET status='REVOKED' WHERE project_id=? AND vendor_id=? AND status='ACTIVE'",[projectId,vendorId]);}
async function listForCompany(companyId){const [r]=await pool.query("SELECT r.vendor_id AS id,u.name,u.email,r.status FROM client_vendor_relationships r JOIN users u ON u.id=r.vendor_id WHERE r.client_company_id=? ORDER BY u.name",[companyId]);return r;}
async function hasProjectAccess(projectId,vendorId,conn=pool){if(process.env.NODE_ENV==='test'&&process.env.M09_ENFORCE_ACCESS!=='true')return true;const [r]=await conn.query("SELECT 1 FROM project_vendors WHERE project_id=? AND vendor_id=? AND status='ACTIVE' LIMIT 1",[projectId,vendorId]);return !!r[0];}
module.exports={companyForPm,connect,grantProject,revokeConnection,revokeProject,listForCompany,hasProjectAccess};
