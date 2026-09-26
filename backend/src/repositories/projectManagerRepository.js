const { pool } = require("../config/db");

// Associate each PM user with one client company.

async function create(conn, { userId, companyId, department }) {
  const runner = conn || pool;
  await runner.query(
    "INSERT INTO project_managers (user_id, company_id, department) VALUES (?, ?, ?)",
    [userId, companyId, department || null]
  );
}

// Resolve the PM's company from their authenticated user ID, never request-supplied company data.
async function findByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT pm.user_id, pm.company_id, pm.department, cc.name AS company_name
     FROM project_managers pm
     JOIN client_companies cc ON cc.id = pm.company_id
     WHERE pm.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { create, findByUserId };
