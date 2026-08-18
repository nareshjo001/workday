const { pool } = require("../config/db");

/**
 * Database access for the `contractors` table (and the `users` row each
 * contractor is linked to). Keeps SQL isolated from services/controllers,
 * same convention as userRepository.js. All queries are parameterized —
 * never interpolate user input into SQL strings.
 *
 * Every read/write here that a Vendor can trigger is scoped by vendor_id.
 * There is no function in this file that lets a caller fetch or mutate a
 * contractor without supplying the owning vendor's id — that scoping is
 * the actual security boundary, not anything in the frontend.
 */

/**
 * Creates the CONTRACTOR user row and the contractors row that links it to
 * the vendor, using the transaction-scoped connection the caller opened
 * (see vendorContractorService.createContractor). Both inserts succeed or
 * neither does — the caller commits/rolls back.
 */
async function createUserAndContractor(conn, { name, email, passwordHash, vendorId, hourlyRate }) {
  const [userResult] = await conn.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'CONTRACTOR')",
    [name, email, passwordHash]
  );
  const userId = userResult.insertId;

  const [contractorResult] = await conn.query(
    "INSERT INTO contractors (user_id, vendor_id, hourly_rate, status) VALUES (?, ?, ?, 'ACTIVE')",
    [userId, vendorId, hourlyRate]
  );

  return { contractorId: contractorResult.insertId, userId };
}

/**
 * All contractors belonging to the given vendor, joined with their user
 * record for name/email. Never selects password_hash.
 */
async function listByVendor(vendorId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.hourly_rate, c.status, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.vendor_id = ?
     ORDER BY c.created_at DESC`,
    [vendorId]
  );
  return rows;
}

/**
 * A single contractor, but ONLY if it belongs to the given vendor — the
 * ownership check is baked into the WHERE clause, not applied afterward.
 */
async function findByVendorAndId(vendorId, contractorId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.hourly_rate, c.status, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.id = ? AND c.vendor_id = ?
     LIMIT 1`,
    [contractorId, vendorId]
  );
  return rows[0] || null;
}

/**
 * Updates only the given fields (hourly_rate and/or status), scoped to
 * `WHERE id = ? AND vendor_id = ?`. If the contractor doesn't exist, or
 * exists but belongs to a different vendor, affectedRows is 0 and nothing
 * is changed — the caller (service layer) turns that into a 404.
 */
async function updateOwned(vendorId, contractorId, fields) {
  const setClauses = [];
  const values = [];

  if (fields.hourlyRate !== undefined) {
    setClauses.push("hourly_rate = ?");
    values.push(fields.hourlyRate);
  }
  if (fields.status !== undefined) {
    setClauses.push("status = ?");
    values.push(fields.status);
  }

  // Should be unreachable — the validator requires at least one field —
  // but guard anyway rather than emitting `SET WHERE ...`.
  if (setClauses.length === 0) return false;

  values.push(contractorId, vendorId);

  const [result] = await pool.query(
    `UPDATE contractors SET ${setClauses.join(", ")} WHERE id = ? AND vendor_id = ?`,
    values
  );
  return result.affectedRows > 0;
}

module.exports = { createUserAndContractor, listByVendor, findByVendorAndId, updateOwned };
