const { pool } = require("../config/db");

// Scope vendor operations by vendor_id; internal unscoped lookups require trusted callers.

// Create the user and vendor-owned contractor in the same transaction.
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

// Filter skill matches within the owning vendor's scope and omit password hashes.
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

async function listPageByVendor(vendorId, query) {
  const where = ["c.vendor_id = ?"];
  const params = [vendorId];
  if (query.filters.skill) { where.push("EXISTS (SELECT 1 FROM contractor_skills cs INNER JOIN skills s ON s.id = cs.skill_id WHERE cs.contractor_id = c.id AND s.code = ? AND s.is_active = 1)"); params.push(query.filters.skill); }
  if (query.filters.status) { where.push("c.status = ?"); params.push(query.filters.status); }
  if (query.filters.search) {
    where.push("(u.name LIKE ? OR u.email LIKE ?)");
    const term = `%${query.filters.search}%`; params.push(term, term);
  }
  const sql = `FROM contractors c INNER JOIN users u ON u.id = c.user_id WHERE ${where.join(" AND ")}`;
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total ${sql}`, params);
  const [rows] = await pool.query(
    `SELECT c.id, c.hourly_rate, c.status, c.skill, u.name, u.email ${sql} ORDER BY ${query.sortColumn} ${query.order}, c.id ${query.order} LIMIT ? OFFSET ?`,
    [...params, query.pageSize, query.offset]
  );
  return { rows, total: Number(count.total) };
}

// Enforce vendor ownership in the query predicate.
async function findByVendorAndId(vendorId, contractorId, conn) {
  const runner = conn || pool;
  const [rows] = await runner.query(
    `SELECT c.id, c.hourly_rate, c.status, c.skill, u.id AS user_id, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.id = ? AND c.vendor_id = ?
     LIMIT 1`,
    [contractorId, vendorId]
  );
  return rows[0] || null;
}

async function findInvitationRecipientByVendorAndId(vendorId, contractorId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM contractors c INNER JOIN users u ON u.id = c.user_id
     WHERE c.id = ? AND c.vendor_id = ? LIMIT 1`,
    [contractorId, vendorId]
  );
  return rows[0] || null;
}

// Exclude overlapping active assignments and unavailability; assignment-time locks enforce concurrency.
async function listEligibleForVendorAndSkill(vendorId, skill, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT DISTINCT c.id, c.hourly_rate, c.status, primary_skill.code AS skill, u.name, u.email
     FROM contractors c
     INNER JOIN users u ON u.id = c.user_id
     INNER JOIN contractor_skills cs ON cs.contractor_id = c.id
     INNER JOIN skills matched_skill ON matched_skill.id = cs.skill_id AND matched_skill.code = ? AND matched_skill.is_active = 1
     LEFT JOIN contractor_skills primary_cs ON primary_cs.contractor_id = c.id AND primary_cs.is_primary = 1
     LEFT JOIN skills primary_skill ON primary_skill.id = primary_cs.skill_id
     LEFT JOIN project_assignments pa ON pa.contractor_id = c.id
       AND pa.status = 'ACTIVE'
       AND pa.start_date <= COALESCE(?, '9999-12-31')
       AND COALESCE(pa.end_date, '9999-12-31') >= ?
     LEFT JOIN contractor_unavailability cu ON cu.contractor_id = c.id
       AND cu.status = 'ACTIVE'
       AND cu.start_date <= COALESCE(?, '9999-12-31')
       AND cu.end_date >= ?
     WHERE c.vendor_id = ?
       AND c.status = 'ACTIVE'
       AND pa.id IS NULL
       AND cu.id IS NULL
     ORDER BY u.name ASC`,
    [skill, endDate, startDate, endDate, startDate, vendorId]
  );
  return rows;
}

async function hasActiveSkillForContractor(conn, contractorId, skillCode) {
  const [rows] = await conn.query(`SELECT 1 FROM contractor_skills cs INNER JOIN skills s ON s.id = cs.skill_id
    WHERE cs.contractor_id = ? AND s.code = ? AND s.is_active = 1 LIMIT 1`, [contractorId, skillCode]);
  return Boolean(rows[0]);
}

// Lock the vendor-owned contractor inside the assignment transaction.
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

// Return no update for missing or foreign contractors so callers can use the same 404 response.
async function updateOwned(vendorId, contractorId, fields, conn) {
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
  if (fields.phone !== undefined) { setClauses.push("phone = ?"); values.push(fields.phone); }
  if (fields.headline !== undefined) { setClauses.push("headline = ?"); values.push(fields.headline); }
  if (fields.totalExperienceYears !== undefined) { setClauses.push("total_experience_years = ?"); values.push(fields.totalExperienceYears); }
  if (fields.notes !== undefined) { setClauses.push("notes = ?"); values.push(fields.notes); }

  // Avoid generating an UPDATE with an empty SET clause.
  if (setClauses.length === 0) return false;

  values.push(contractorId, vendorId);

  const runner = conn || pool;
  const [result] = await runner.query(
    `UPDATE contractors SET ${setClauses.join(", ")} WHERE id = ? AND vendor_id = ?`,
    values
  );
  return result.affectedRows > 0;
}

// Resolve the authenticated user ID to the contractor ID used by assignments.
async function findByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT id, vendor_id, hourly_rate, status, skill, phone, headline, total_experience_years, notes FROM contractors WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function findByUserIdForUpdate(conn, userId) {
  const [rows] = await conn.query(
    `SELECT id, vendor_id, hourly_rate, status, skill, phone, headline, total_experience_years, notes FROM contractors WHERE user_id = ? LIMIT 1 FOR UPDATE`,
    [userId]
  );
  return rows[0] || null;
}

async function updateProfileById(conn, contractorId, fields) {
  const clauses = []; const values = [];
  if (fields.phone !== undefined) { clauses.push("phone = ?"); values.push(fields.phone); }
  if (fields.headline !== undefined) { clauses.push("headline = ?"); values.push(fields.headline); }
  if (fields.totalExperienceYears !== undefined) { clauses.push("total_experience_years = ?"); values.push(fields.totalExperienceYears); }
  if (!clauses.length) return;
  values.push(contractorId);
  await conn.query(`UPDATE contractors SET ${clauses.join(", ")} WHERE id = ?`, values);
}

// Update only the authenticated contractor's primary skill.
async function updateSkillByUserId(userId, skill) {
  const [result] = await pool.query(`UPDATE contractors SET skill = ? WHERE user_id = ?`, [
    skill,
    userId,
  ]);
  return result.affectedRows > 0;
}

// Internal unscoped lookup for trusted contractor IDs; HTTP callers must enforce ownership separately.
async function findById(contractorId) {
  const [rows] = await pool.query(
    `SELECT id, vendor_id, hourly_rate, status, skill FROM contractors WHERE id = ? LIMIT 1`,
    [contractorId]
  );
  return rows[0] || null;
}

// Lock the contractor rate for a consistent billing snapshot within the caller's transaction.
async function findByIdForUpdate(conn, contractorId) {
  const [rows] = await conn.query(
    `SELECT id, vendor_id, hourly_rate, status, skill FROM contractors WHERE id = ? LIMIT 1 FOR UPDATE`,
    [contractorId]
  );
  return rows[0] || null;
}

module.exports = {
  createUserAndContractor,
  listByVendor,
  listPageByVendor,
  findByVendorAndId,
  findInvitationRecipientByVendorAndId,
  listEligibleForVendorAndSkill,
  hasActiveSkillForContractor,
  findByVendorAndIdForUpdate,
  updateOwned,
  findByUserId,
  findByUserIdForUpdate,
  updateProfileById,
  updateSkillByUserId,
  findById,
  findByIdForUpdate,
};
