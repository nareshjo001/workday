const { pool } = require("../config/db");

/**
 * Database access for the `users` table.
 * Keeps SQL isolated from services/controllers. All queries are
 * parameterized — never interpolate user input into SQL strings.
 */

async function findByEmail(email) {
  const [rows] = await pool.query(
    "SELECT id, name, email, password_hash, role, failed_login_count, locked_until, created_at FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function findById(id, conn) {
  const runner = conn || pool;
  const [rows] = await runner.query(
    "SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

/**
 * `conn` is optional (defaults to the pool) so callers that need to
 * create a user as part of a larger transaction — e.g. PM signup, which
 * also creates/links a client_companies row in the same transaction, see
 * authService.signup — can pass a checked-out, already-begun connection
 * and have this insert participate in it.
 */
async function createUser({ name, email, passwordHash, role }, conn) {
  const runner = conn || pool;
  const [result] = await runner.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [name, email, passwordHash, role]
  );
  return findById(result.insertId, conn);
}

async function setPassword(conn, userId, passwordHash) {
  await conn.query("UPDATE users SET password_hash=?, password_set_at=NOW(), failed_login_count=0, locked_until=NULL WHERE id=?", [passwordHash, userId]);
}

async function recordLoginFailure(conn, userId, maxFailures, lockoutMinutes) {
  await conn.query("UPDATE users SET failed_login_count=failed_login_count+1, locked_until=IF(failed_login_count+1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until) WHERE id=?", [maxFailures, lockoutMinutes, userId]);
}

async function listVendors() {
  const [rows] = await pool.query(
    "SELECT id, name, email FROM users WHERE role = 'VENDOR' ORDER BY name ASC, id ASC"
  );
  return rows;
}

async function isVendor(userId, conn = pool) {
  const [rows] = await conn.query("SELECT 1 FROM users WHERE id = ? AND role = 'VENDOR' LIMIT 1", [userId]);
  return Boolean(rows[0]);
}

async function clearLoginFailures(conn, userId) {
  await conn.query("UPDATE users SET failed_login_count=0, locked_until=NULL WHERE id=?", [userId]);
}

module.exports = { findByEmail, findById, createUser, setPassword, recordLoginFailure, clearLoginFailures, listVendors, isVendor };
