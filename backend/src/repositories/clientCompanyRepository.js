const { pool } = require("../config/db");

/**
 * Database access for the `client_companies` table (see migration 009).
 * SQL lives only here, same convention as every other repository.
 */

function normalize(name) {
  return name.trim().toLowerCase();
}

/**
 * Atomic find-or-create by (case/whitespace-insensitive) name. Uses the
 * INSERT ... ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id) idiom against
 * the UNIQUE(normalized_name) constraint so two concurrent signups for
 * "Acme" never race a separate SELECT-then-INSERT into two rows — the
 * database itself is the single source of truth for "does this company
 * already exist", not an application-level check. Always called within
 * the signup transaction (conn), never against the bare pool, so it
 * rolls back cleanly if anything later in signup fails.
 */
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

async function findById(companyId) {
  const [rows] = await pool.query(
    "SELECT id, name, created_at FROM client_companies WHERE id = ? LIMIT 1",
    [companyId]
  );
  return rows[0] || null;
}

module.exports = { findOrCreate, findById };
