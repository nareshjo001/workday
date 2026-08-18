const { pool } = require("../config/db");
const userRepository = require("../repositories/userRepository");
const contractorRepository = require("../repositories/contractorRepository");
const { hashPassword } = require("../utils/password");
const ApiError = require("../utils/ApiError");

function toContractorView(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    hourly_rate: Number(row.hourly_rate),
    status: row.status,
    skill: row.skill || null,
  };
}

/**
 * Creates the contractor's user account + contractors record in a single
 * transaction, owned by `vendorId` (the authenticated vendor's users.id,
 * resolved from the JWT by the controller — never taken from the request
 * body).
 */
async function createContractor(vendorId, { name, email, password, hourlyRate }) {
  // Friendly pre-check so the common case returns a clean 409 without ever
  // opening a transaction. The UNIQUE constraint on users.email is still
  // the real guarantee — see the ER_DUP_ENTRY catch below — so a second
  // signup racing this check can't slip through as a partial write.
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { contractorId } = await contractorRepository.createUserAndContractor(conn, {
      name,
      email,
      passwordHash,
      vendorId,
      hourlyRate,
    });
    await conn.commit();

    return {
      id: contractorId,
      name,
      email,
      hourly_rate: hourlyRate,
      status: "ACTIVE",
    };
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY") {
      throw ApiError.conflict("An account with this email already exists.");
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Only ever returns contractors owned by `vendorId` — the WHERE clause
 * lives in the repository's SQL, not filtered afterward in JS. Optional
 * `skill` narrows to contractors with that primary skill, still scoped
 * to this vendor's own contractors in the same query — used by the
 * requirement-specific assignment picker (Module 3 revision spec section
 * 13) so a Vendor can never see another vendor's contractors regardless
 * of the skill filter.
 */
async function listContractors(vendorId, opts = {}) {
  const rows = await contractorRepository.listByVendor(vendorId, opts);
  return rows.map(toContractorView);
}

/**
 * Updates hourly_rate and/or status on a contractor, but only if it
 * belongs to `vendorId`. A contractor that doesn't exist and a contractor
 * that belongs to a different vendor are indistinguishable from the
 * outside — both come back as 404 — so this endpoint can't be used to
 * probe which contractor ids exist under other vendors.
 */
async function updateContractor(vendorId, contractorId, fields) {
  if (!Number.isInteger(contractorId) || contractorId <= 0) {
    throw ApiError.badRequest("Invalid contractor id.");
  }

  const updated = await contractorRepository.updateOwned(vendorId, contractorId, fields);
  if (!updated) {
    throw ApiError.notFound("Contractor not found.");
  }

  const contractor = await contractorRepository.findByVendorAndId(vendorId, contractorId);
  return toContractorView(contractor);
}

module.exports = { createContractor, listContractors, updateContractor };
