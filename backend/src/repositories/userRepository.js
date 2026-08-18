const { pool } = require("../config/db");

/**
 * Database access for the `users` table.
 * Keeps SQL isolated from services/controllers. All queries are
 * parameterized — never interpolate user input into SQL strings.
 */

async function findByEmail(email) {
  const [rows] = await pool.query(
    "SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    "SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, role }) {
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [name, email, passwordHash, role]
  );
  return findById(result.insertId);
}

module.exports = { findByEmail, findById, createUser };
