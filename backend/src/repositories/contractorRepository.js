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
 * record for name/email. Never selects password_hash. Optionally scoped
 * to a single skill (`opts.skill`) — used by the requirement-specific
 * "assign a contractor" picker (Module 3 revision spec section 13) so the
 * Vendor only ever sees contractors compatible with the requirement they
 * clicked, enforced here in SQL rather than merely filtered in the UI.
 */
async function listByVendor(vendorId, opts = {}) {
  const params = [vendorId];
  let sql = `SELECT c.id, c.hourly_rate, c.status, c.skill, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.vendor_id = ?`;
  if (opts.skill) {
    sql += ` AND c.skill = ?`;
    params.push(opts.skill);
  }
  sql += ` ORDER BY c.created_at DESC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * A single contractor, but ONLY if it belongs to the given vendor — the
 * ownership check is baked into the WHERE clause, not applied afterward.
 */
async function findByVendorAndId(vendorId, contractorId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.hourly_rate, c.status, c.skill, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.id = ? AND c.vendor_id = ?
     LIMIT 1`,
    [contractorId, vendorId]
  );
  return rows[0] || null;
}

/**
 * Contractors eligible for a specific vendor+skill assignment: belongs to
 * this vendor, ACTIVE status, skill matches, AND not already assigned to
 * ANY project (new vendor-centric workflow rule — one contractor, one
 * project, ever; see migration 011). The "not assigned anywhere" filter
 * is a LEFT JOIN ... IS NULL against project_assignments rather than a
 * NOT IN subquery — functionally equivalent, but avoids re-scanning the
 * assignments table once per contractor row.
 *
 * This is a READ used to populate the assignment picker UI — it is NOT
 * the concurrency guarantee itself (two vendors could both see the same
 * "eligible" contractor a moment before one of them assigns it away). The
 * real guarantee is the row lock + UNIQUE(contractor_id) constraint
 * enforced inside vendorAssignmentService's transaction at assign time.
 */
async function listEligibleForVendorAndSkill(vendorId, skill) {
  const [rows] = await pool.query(
    `SELECT c.id, c.hourly_rate, c.status, c.skill, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN project_assignments pa ON pa.contractor_id = c.id
     WHERE c.vendor_id = ?
       AND c.status = 'ACTIVE'
       AND c.skill = ?
       AND pa.id IS NULL
     ORDER BY u.name ASC`,
    [vendorId, skill]
  );
  return rows;
}

/**
 * Transaction-scoped, row-locked variant of findByVendorAndId — used
 * inside vendorAssignmentService's assignment transaction so that once a
 * contractor row has been read there, no other concurrent transaction
 * can concurrently read-and-assign the SAME contractor until this one
 * commits or rolls back. Must run on `conn` inside an open transaction.
 */
async function findByVendorAndIdForUpdate(conn, vendorId, contractorId) {
  const [rows] = await conn.query(
    `SELECT c.id, c.hourly_rate, c.status, c.skill, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.id = ? AND c.vendor_id = ?
     LIMIT 1
     FOR UPDATE`,
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

/**
 * Resolves a contractor's own `contractors.id` from their `users.id`
 * (i.e. `req.user.userId` off their JWT). Added for Module 3's
 * GET /api/contractor/projects: project_assignments.contractor_id refers
 * to contractors.id, not users.id, so the contractor-facing endpoint has
 * to bridge from "who is logged in" to "which contractor row is theirs"
 * before it can look up assignments — same derive-identity-from-JWT
 * pattern as vendor_id/pm_id, just one extra hop because a contractor's
 * own id isn't the id their assignments are keyed on.
 */
async function findByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT id, vendor_id, hourly_rate, status, skill FROM contractors WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Sets a contractor's own primary skill, scoped by `WHERE user_id = ?` —
 * the same derive-identity-from-JWT pattern as every other ownership
 * check in this file, just keyed on the contractor's own users.id
 * instead of a vendor's. There is no path through this function that
 * lets one contractor's request touch another contractor's row: the
 * caller (contractorProfileService) always passes the id straight off
 * `req.user.userId`, never anything from the request body.
 */
async function updateSkillByUserId(userId, skill) {
  const [result] = await pool.query(`UPDATE contractors SET skill = ? WHERE user_id = ?`, [
    skill,
    userId,
  ]);
  return result.affectedRows > 0;
}

module.exports = {
  createUserAndContractor,
  listByVendor,
  findByVendorAndId,
  listEligibleForVendorAndSkill,
  findByVendorAndIdForUpdate,
  updateOwned,
  findByUserId,
  updateSkillByUserId,
};
