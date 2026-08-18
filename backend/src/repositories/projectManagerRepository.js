const { pool } = require("../config/db");

/**
 * Database access for the `project_managers` association table (see
 * migration 009). One row per PM user_id (PRIMARY KEY) — a PM belongs to
 * exactly one client company for this MVP.
 */

async function create(conn, { userId, companyId, department }) {
  const runner = conn || pool;
  await runner.query(
    "INSERT INTO project_managers (user_id, company_id, department) VALUES (?, ?, ?)",
    [userId, companyId, department || null]
  );
}

/**
 * The company a PM belongs to, joined in one query. Used wherever a PM's
 * company identity needs to be resolved from just their user id (e.g.
 * project creation deriving company_id server-side from the JWT — never
 * from the request body).
 */
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
