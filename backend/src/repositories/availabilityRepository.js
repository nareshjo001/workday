const { pool } = require("../config/db");

async function listForContractor(contractorId) {
  const [rows] = await pool.query(
    `SELECT id, start_date, end_date, reason, status, created_at, cancelled_at
     FROM contractor_unavailability WHERE contractor_id = ? ORDER BY start_date ASC, id ASC`,
    [contractorId]
  );
  return rows;
}

async function create(conn, contractorId, { startDate, endDate, reason }) {
  const [result] = await conn.query(
    `INSERT INTO contractor_unavailability (contractor_id, start_date, end_date, reason)
     VALUES (?, ?, ?, ?)`, [contractorId, startDate, endDate, reason]
  );
  return result.insertId;
}

async function lockOverlaps(conn, contractorId, startDate, endDate) {
  const [rows] = await conn.query(
    `SELECT id FROM contractor_unavailability
     WHERE contractor_id = ? AND status = 'ACTIVE' AND start_date <= ? AND end_date >= ? FOR UPDATE`,
    [contractorId, endDate, startDate]
  );
  return rows;
}

async function cancelOwned(conn, contractorId, availabilityId) {
  const [result] = await conn.query(
    `UPDATE contractor_unavailability SET status = 'CANCELLED', cancelled_at = NOW()
     WHERE id = ? AND contractor_id = ? AND status = 'ACTIVE'`, [availabilityId, contractorId]
  );
  return result.affectedRows > 0;
}

module.exports = { listForContractor, create, lockOverlaps, cancelOwned };
