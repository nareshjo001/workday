const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');

const PROJECT_STATUSES = new Set(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);

const positive = (value, field) => { if (value == null || value === '') return null; const number = Number(value); if (!Number.isInteger(number) || number < 1) throw ApiError.badRequest(`${field} must be a positive integer.`); return number; };
const iso = (value, field) => { if (!value) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw ApiError.badRequest(`${field} must be YYYY-MM-DD.`); return String(value); };
function filters(query = {}) {
  const status = query.status ? String(query.status).toUpperCase() : null;
  if (status && !PROJECT_STATUSES.has(status)) throw ApiError.badRequest('Unsupported project status.');
  return { clientId: positive(query.clientId, 'clientId'), projectId: positive(query.projectId, 'projectId'), skillId: positive(query.skillId, 'skillId'), status, startDate: iso(query.startDate, 'startDate'), endDate: iso(query.endDate, 'endDate') };
}
function scoped(role, userId, f, alias = 'p') {
  const where = []; const values = [];
  if (role === 'VENDOR') { where.push(`EXISTS (SELECT 1 FROM project_assignments scope_pa JOIN contractors scope_c ON scope_c.id=scope_pa.contractor_id WHERE scope_pa.project_id=${alias}.id AND scope_c.vendor_id=?)`); values.push(userId); }
  else if (role === 'PM') { where.push(`${alias}.pm_id=?`); values.push(userId); }
  else { where.push(`EXISTS (SELECT 1 FROM project_assignments scope_pa JOIN contractors scope_c ON scope_c.id=scope_pa.contractor_id WHERE scope_pa.project_id=${alias}.id AND scope_c.user_id=?)`); values.push(userId); }
  if (f.projectId) { where.push(`${alias}.id=?`); values.push(f.projectId); }
  if (f.clientId) { where.push(`pm.company_id=?`); values.push(f.clientId); }
  if (f.skillId) { where.push(`EXISTS (SELECT 1 FROM project_requirements scope_pr WHERE scope_pr.project_id=${alias}.id AND scope_pr.skill_id=?)`); values.push(f.skillId); }
  if (f.status) { where.push(`${alias}.status=?`); values.push(f.status); }
  return { where: where.join(' AND '), values };
}
async function dashboard(role, userId, rawQuery) {
  const f = filters(rawQuery); const scope = scoped(role, userId, f);
  const [[projects]] = await pool.query(`SELECT COUNT(DISTINCT p.id) projects, COUNT(DISTINCT pm.company_id) connected_clients, COALESCE(SUM(p.budget),0) budget, COALESCE(SUM(p.expected_hours),0) planned_hours, COALESCE(SUM(CASE WHEN p.status='ACTIVE' THEN 1 ELSE 0 END),0) active_projects, COALESCE(SUM(CASE WHEN p.status='COMPLETED' THEN 1 ELSE 0 END),0) completed_projects FROM projects p JOIN project_managers pm ON pm.user_id=p.pm_id WHERE ${scope.where}`, scope.values);
  const [[hours]] = await pool.query(`SELECT COALESCE(SUM(CASE WHEN t.status='APPROVED' THEN t.hours_logged ELSE 0 END),0) approved_hours, COALESCE(SUM(CASE WHEN t.status='SUBMITTED' THEN t.hours_logged ELSE 0 END),0) submitted_hours, COALESCE(SUM(CASE WHEN t.status='SUBMITTED' THEN 1 ELSE 0 END),0) pending_timesheet_reviews, COALESCE(SUM(CASE WHEN t.status='REJECTED' THEN 1 ELSE 0 END),0) rejected_timesheets FROM timesheets t JOIN projects p ON p.id=t.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE ${scope.where} ${f.startDate ? 'AND t.work_date>=?' : ''} ${f.endDate ? 'AND t.work_date<=?' : ''}`, [...scope.values, ...(f.startDate ? [f.startDate] : []), ...(f.endDate ? [f.endDate] : [])]);
  const [[staffing]] = await pool.query(`SELECT COALESCE(SUM(CASE WHEN pr.status='OPEN' THEN 1 ELSE 0 END),0) open_requirements, COUNT(DISTINCT CASE WHEN pa.status='ACTIVE' THEN pa.contractor_id END) active_contractors, COUNT(DISTINCT CASE WHEN pa.start_date>CURDATE() THEN pa.contractor_id END) upcoming_contractors, COALESCE(SUM(pa.allocated_hours),0) allocated_hours FROM projects p JOIN project_managers pm ON pm.user_id=p.pm_id LEFT JOIN project_requirements pr ON pr.project_id=p.id LEFT JOIN project_assignments pa ON pa.project_id=p.id WHERE ${scope.where}`, scope.values);
  let vendorHeadlineKpis = null;
  if (role === 'VENDOR') {
    const [[row]] = await pool.query(`SELECT COUNT(DISTINCT CASE WHEN p.status='ACTIVE' AND pa.status='ACTIVE' THEN p.id END) active_projects, COUNT(DISTINCT CASE WHEN p.status='ACTIVE' AND pa.status='ACTIVE' THEN pa.contractor_id END) active_contractors FROM projects p JOIN project_managers pm ON pm.user_id=p.pm_id JOIN project_assignments pa ON pa.project_id=p.id JOIN contractors c ON c.id=pa.contractor_id WHERE ${scope.where} AND c.vendor_id=?`, [...scope.values, userId]);
    vendorHeadlineKpis = { active_projects: Number(row.active_projects), active_contractors: Number(row.active_contractors) };
  }
  const [[candidates]] = await pool.query(`SELECT COUNT(*) submissions, COALESCE(SUM(cs.status='SUBMITTED'),0) pending_reviews, COALESCE(SUM(cs.status='ACCEPTED'),0) accepted, COALESCE(SUM(cs.status='REJECTED'),0) rejected, COALESCE(SUM(cs.status='SUBMITTED' AND cs.submitted_at < DATE_SUB(NOW(),INTERVAL 3 DAY)),0) sla_breaches FROM candidate_submissions cs JOIN projects p ON p.id=cs.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE ${scope.where}`, scope.values);
  const vendorInvoice = role === 'VENDOR' ? ' AND i.vendor_id=?' : '';
  const vendorInvoiceValues = role === 'VENDOR' ? [userId] : [];
  const [[finance]] = await pool.query(`SELECT
    COALESCE(SUM(CASE WHEN i.status='SUBMITTED' THEN i.total_amount ELSE 0 END),0) submitted_invoice_amount,
    COALESCE(SUM(CASE WHEN i.status='APPROVED' THEN i.total_amount ELSE 0 END),0) approved_invoice_amount,
    COALESCE(SUM(CASE WHEN i.status='SUBMITTED' THEN 1 ELSE 0 END),0) pending_invoice_reviews,
    COALESCE(SUM(CASE WHEN i.status='APPROVED' THEN i.total_amount-COALESCE(pay.paid_amount,0) ELSE 0 END),0) outstanding_amount,
    COALESCE(SUM(CASE WHEN i.status='APPROVED' AND i.due_date<CURDATE() THEN i.total_amount-COALESCE(pay.paid_amount,0) ELSE 0 END),0) overdue_amount,
    COALESCE(SUM(COALESCE(pay.paid_amount,0)),0) paid_amount,
    COALESCE(SUM(CASE WHEN i.status IN ('APPROVED','AUTO_APPROVED') THEN i.total_amount ELSE 0 END),0) approved_earnings_amount
    FROM invoices i JOIN projects p ON p.id=i.project_id JOIN project_managers pm ON pm.user_id=p.pm_id LEFT JOIN (SELECT invoice_id,SUM(amount) paid_amount FROM payments GROUP BY invoice_id) pay ON pay.invoice_id=i.id WHERE ${scope.where}${vendorInvoice}`, [...scope.values, ...vendorInvoiceValues]);
  const vendorBilling = role === 'VENDOR' ? ' JOIN contractors billing_c ON billing_c.id=b.contractor_id AND billing_c.vendor_id=?' : '';
  const [[billable]] = await pool.query(`SELECT COALESCE(SUM(b.billing_amount),0) billable_uninvoiced_amount FROM milestone_billings b JOIN milestones m ON m.id=b.milestone_id JOIN projects p ON p.id=m.project_id JOIN project_managers pm ON pm.user_id=p.pm_id${vendorBilling} LEFT JOIN invoice_items ii ON ii.milestone_billing_id=b.id WHERE ${scope.where} AND ii.id IS NULL`, role === 'VENDOR' ? [userId, ...scope.values] : scope.values);
  const [[compliance]] = await pool.query(`SELECT COUNT(DISTINCT d.id) expiring_documents FROM contractor_documents d JOIN project_assignments pa ON pa.contractor_id=d.contractor_id JOIN projects p ON p.id=pa.project_id JOIN project_managers pm ON pm.user_id=p.pm_id ${role === 'VENDOR' ? 'JOIN contractors doc_c ON doc_c.id=d.contractor_id' : ''} WHERE ${scope.where} ${role === 'VENDOR' ? 'AND doc_c.vendor_id=?' : ''} AND d.status='VERIFIED' AND d.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 30 DAY)`, role === 'VENDOR' ? [...scope.values, userId] : scope.values);
  let margin = null;
  if (role === 'VENDOR') {
    const marginSql = `FROM milestone_billings b JOIN milestones m ON m.id=b.milestone_id JOIN projects p ON p.id=m.project_id JOIN project_managers pm ON pm.user_id=p.pm_id JOIN project_assignments pa ON pa.project_id=p.id AND pa.contractor_id=b.contractor_id JOIN contractors c ON c.id=b.contractor_id WHERE ${scope.where} AND c.vendor_id=?`;
    const [[row]] = await pool.query(`SELECT COALESCE(SUM(b.approved_hours*(pa.bill_rate_snapshot-pa.cost_rate_snapshot)),0) margin_amount, COALESCE(SUM(b.approved_hours*pa.bill_rate_snapshot),0) bill_revenue ${marginSql}`, [...scope.values, userId]);
    const [byProject] = await pool.query(`SELECT p.id,p.name,COALESCE(SUM(b.approved_hours*(pa.bill_rate_snapshot-pa.cost_rate_snapshot)),0) margin_amount ${marginSql} GROUP BY p.id,p.name`, [...scope.values, userId]);
    const [byClient] = await pool.query(`SELECT pm.company_id,COALESCE(SUM(b.approved_hours*(pa.bill_rate_snapshot-pa.cost_rate_snapshot)),0) margin_amount ${marginSql} GROUP BY pm.company_id`, [...scope.values, userId]);
    const [bySkill] = await pool.query(`SELECT pr.skill_id,COALESCE(SUM(b.approved_hours*(pa.bill_rate_snapshot-pa.cost_rate_snapshot)),0) margin_amount FROM milestone_billings b JOIN milestones m ON m.id=b.milestone_id JOIN projects p ON p.id=m.project_id JOIN project_managers pm ON pm.user_id=p.pm_id JOIN project_assignments pa ON pa.project_id=p.id AND pa.contractor_id=b.contractor_id JOIN contractors c ON c.id=b.contractor_id JOIN project_requirements pr ON pr.id=pa.requirement_id WHERE ${scope.where} AND c.vendor_id=? GROUP BY pr.skill_id`, [...scope.values, userId]);
    margin = { amount: Number(row.margin_amount), percentage: Number(row.bill_revenue) ? Number((Number(row.margin_amount) / Number(row.bill_revenue) * 100).toFixed(2)) : null, by_client: byClient.map((x) => ({ ...x, margin_amount: Number(x.margin_amount) })), by_project: byProject.map((x) => ({ ...x, margin_amount: Number(x.margin_amount) })), by_skill: bySkill.map((x) => ({ ...x, margin_amount: Number(x.margin_amount) })) };
  }
  const financeMetrics = Object.fromEntries(Object.entries(finance).map(([k,v])=>[k,Number(v)]));
  if (role !== 'VENDOR') delete financeMetrics.approved_earnings_amount;
  return { filters: f, workforce: { ...Object.fromEntries(Object.entries(staffing).map(([k,v])=>[k,Number(v)])), ...(vendorHeadlineKpis ? { active_contractors: vendorHeadlineKpis.active_contractors } : {}), connected_clients:Number(projects.connected_clients) }, candidates: Object.fromEntries(Object.entries(candidates).map(([k,v])=>[k,Number(v)])), time: Object.fromEntries(Object.entries(hours).map(([k,v])=>[k,Number(v)])), compliance: { expiring_documents:Number(compliance.expiring_documents) }, financial: { ...financeMetrics, billable_uninvoiced_amount:Number(billable.billable_uninvoiced_amount), budget:Number(projects.budget), planned_hours:Number(projects.planned_hours), active_projects:vendorHeadlineKpis ? vendorHeadlineKpis.active_projects : Number(projects.active_projects), completed_projects:Number(projects.completed_projects), margin }, };
}
module.exports = { dashboard, filters, scoped };
