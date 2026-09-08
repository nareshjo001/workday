const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
async function history(vendorId, contractorId) {
  const [rows] = await pool.query(`SELECT pa.id assignment_id,pa.project_id,p.name project_name,pm.company_id client_company_id,pa.requirement_id,pa.start_date,pa.planned_last_working_date,pa.actual_end_date,pa.release_reason,pa.released_at,pa.status,pa.allocated_hours,pa.bill_rate_snapshot,pa.cost_rate_snapshot,pa.currency,
    (SELECT COALESCE(SUM(t.hours_logged),0) FROM timesheets t WHERE t.project_id=pa.project_id AND t.contractor_id=pa.contractor_id AND t.status='APPROVED') approved_hours,
    (SELECT COALESCE(SUM(mb.billing_amount),0) FROM milestone_billings mb JOIN milestones m ON m.id=mb.milestone_id WHERE m.project_id=pa.project_id AND mb.contractor_id=pa.contractor_id) billed_amount,
    (SELECT COALESCE(SUM(pay.amount),0) FROM payments pay JOIN invoices i ON i.id=pay.invoice_id WHERE i.project_id=pa.project_id AND i.contractor_id=pa.contractor_id AND i.vendor_id=c.vendor_id) paid_amount
    FROM project_assignments pa JOIN contractors c ON c.id=pa.contractor_id JOIN projects p ON p.id=pa.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE pa.contractor_id=? AND c.vendor_id=? ORDER BY pa.released_at DESC,pa.start_date DESC`,[contractorId,vendorId]);
  if(!rows.length){const [[owned]]=await pool.query('SELECT id FROM contractors WHERE id=? AND vendor_id=?',[contractorId,vendorId]);if(!owned)throw ApiError.notFound('Contractor not found.');}
  return rows.map((r)=>({...r,allocated_hours:Number(r.allocated_hours||0),bill_rate_snapshot:r.bill_rate_snapshot==null?null:Number(r.bill_rate_snapshot),cost_rate_snapshot:r.cost_rate_snapshot==null?null:Number(r.cost_rate_snapshot),approved_hours:Number(r.approved_hours),billed_amount:Number(r.billed_amount),paid_amount:Number(r.paid_amount)}));
}
module.exports={history};
