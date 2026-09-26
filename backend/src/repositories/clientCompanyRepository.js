const { pool } = require("../config/db");


function normalize(name) {
  return name.trim().toLowerCase();
}

// Find or create the normalized company atomically using LAST_INSERT_ID within the signup transaction.
async function findOrCreate(conn, name) {
  const runner = conn || pool;
  const normalizedName = normalize(name);
  const [result] = await runner.query(
    `INSERT INTO client_companies (name, normalized_name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [name.trim(), normalizedName]
  );
  return result.insertId;
}

// Reject duplicate companies at signup; joining an existing tenant requires an invitation.
async function createBootstrap(conn, name) {
  try {
    const [result] = await conn.query(
      "INSERT INTO client_companies (name, normalized_name) VALUES (?, ?)",
      [name.trim(), normalize(name)]
    );
    return result.insertId;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw require("../utils/ApiError").forbidden("An invitation is required to join an existing client company.");
    }
    throw error;
  }
}

async function findById(companyId) {
  const [rows] = await pool.query(
    "SELECT id, name, created_at FROM client_companies WHERE id = ? LIMIT 1",
    [companyId]
  );
  return rows[0] || null;
}

module.exports = { findOrCreate, createBootstrap, findById };
