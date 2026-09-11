const { pool } = require("../config/db");

async function getContext(vendorId, contractorId, projectId, requirementId) {
  const [rows] = await pool.query(
    `SELECT c.id AS contractor_id, c.hourly_rate AS contractor_cost_rate, u.name AS contractor_name,
            p.id AS project_id, p.name AS project_name, p.currency AS project_currency,
            pm.company_id AS client_company_id, pr.id AS requirement_id, COALESCE(s.code, pr.skill) AS skill,
            pr.skill_id
       FROM contractors c
       JOIN users u ON u.id=c.user_id
       JOIN projects p ON p.id=?
       JOIN project_managers pm ON pm.user_id=p.pm_id
       JOIN project_requirements pr ON pr.id=? AND pr.project_id=p.id
       LEFT JOIN skills s ON s.id=pr.skill_id
      WHERE c.id=? AND c.vendor_id=?
      LIMIT 1`,
    [projectId, requirementId, contractorId, vendorId]
  );
  return rows[0] || null;
}

async function getApplicableRateCard(vendorId, context) {
  const [rows] = await pool.query(
    `SELECT id, bill_rate, cost_rate, currency
       FROM rate_cards
      WHERE vendor_id=? AND client_company_id=? AND skill_id=? AND status='ACTIVE'
        AND effective_from<=CURDATE() AND (effective_to IS NULL OR effective_to>=CURDATE())
      ORDER BY effective_from DESC LIMIT 1`,
    [vendorId, context.client_company_id, context.skill_id]
  );
  return rows[0] || null;
}

async function listComparableSnapshots(vendorId, skillId, currency, clientCompanyId = null) {
  const params = [vendorId, skillId, currency];
  let clientFilter = "";
  if (clientCompanyId !== null) { clientFilter = " AND pm.company_id=?"; params.push(clientCompanyId); }
  const [rows] = await pool.query(
    `SELECT pa.bill_rate_snapshot AS bill_rate
       FROM project_assignments pa
       JOIN contractors c ON c.id=pa.contractor_id
       JOIN project_requirements pr ON pr.id=pa.requirement_id
       JOIN projects p ON p.id=pa.project_id
       JOIN project_managers pm ON pm.user_id=p.pm_id
      WHERE c.vendor_id=? AND pr.skill_id=? AND pa.currency=?
        AND pa.bill_rate_snapshot IS NOT NULL AND pa.bill_rate_snapshot>0${clientFilter}
      ORDER BY pa.id ASC`,
    params
  );
  return rows.map((row) => Number(row.bill_rate));
}

module.exports = { getContext, getApplicableRateCard, listComparableSnapshots };
