const { pool } = require("../config/db");
const userRepository = require("../repositories/userRepository");
const contractorRepository = require("../repositories/contractorRepository");
const skillRepository = require("../repositories/skillRepository");
const { hashPassword } = require("../utils/password");
const ApiError = require("../utils/ApiError");
const crypto = require("crypto");
const authService = require("./authService");
const auditService = require("./auditService");
const { pageResult } = require("../utils/listQuery");

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

// Create the authenticated vendor's contractor and user records in one transaction.
async function createContractor(vendorId, { name, email, hourlyRate, testPassword }, auditActor) {
  // Pre-check email uniqueness for a friendly error; the database constraint prevents concurrent duplicates.
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  // Placeholder cannot be used as a known credential; contractor chooses the real password via invitation.
  const passwordHash = await hashPassword(testPassword || crypto.randomBytes(48).toString("base64url"));

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
    if (auditActor) {
      await auditService.write(conn, auditActor, "CONTRACTOR_CREATED", "contractor", contractorId, null, {
        name, email, hourly_rate: hourlyRate, status: "ACTIVE",
      });
    }
    await conn.commit();

    const contractor = {
      id: contractorId,
      name,
      email,
      hourly_rate: hourlyRate,
      status: "ACTIVE",
    };
    // Delivery happens after the identity transaction commits. If it fails, resend can safely replace the prior token.
    await authService.issueAction(email, "CONTRACTOR_INVITATION");
    return contractor;
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

// Apply skill filters within the authenticated vendor's ownership scope.
async function listContractors(vendorId, opts = {}) {
  const rows = await contractorRepository.listByVendor(vendorId, opts);
  return rows.map(toContractorView);
}

async function listContractorsPage(vendorId, query) {
  const { rows, total } = await contractorRepository.listPageByVendor(vendorId, query);
  return pageResult(rows.map(toContractorView), total, query);
}

// Return the same 404 for missing and foreign contractors when updating vendor-owned fields.
async function updateContractor(vendorId, contractorId, fields, auditActor) {
  if (!Number.isInteger(contractorId) || contractorId <= 0) {
    throw ApiError.badRequest("Invalid contractor id.");
  }

  const conn = await pool.getConnection();
  let contractor;
  try {
    await conn.beginTransaction();
    const before = await contractorRepository.findByVendorAndIdForUpdate(conn, vendorId, contractorId);
    if (!before) throw ApiError.notFound("Contractor not found.");
    if (fields.skills) {
      const resolved = await Promise.all(fields.skills.map(async (skill) => ({ ...skill, skillId: (await skillRepository.findActiveByCode(skill.code, conn))?.id })));
      if (resolved.some((skill) => !skill.skillId)) throw ApiError.badRequest("One or more skills are unknown or inactive.");
      await skillRepository.replaceForContractor(conn, contractorId, resolved);
    }
    const updated = await contractorRepository.updateOwned(vendorId, contractorId, fields, conn);
    if (!updated) throw ApiError.notFound("Contractor not found.");
    contractor = await contractorRepository.findByVendorAndId(vendorId, contractorId, conn);
    if (auditActor) {
      await auditService.write(conn, auditActor, "CONTRACTOR_UPDATED", "contractor", contractorId, {
        hourly_rate: Number(before.hourly_rate), status: before.status,
      }, {
        hourly_rate: Number(contractor.hourly_rate), status: contractor.status,
      });
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  return toContractorView(contractor);
}

async function resendInvitation(vendorId, contractorId) {
  if (!Number.isInteger(contractorId) || contractorId <= 0) throw ApiError.badRequest("Invalid contractor id.");
  const recipient = await contractorRepository.findInvitationRecipientByVendorAndId(vendorId, contractorId);
  if (!recipient) throw ApiError.notFound("Contractor not found.");
  await authService.issueActionForUser(recipient, "CONTRACTOR_INVITATION");
}

module.exports = { createContractor, listContractors, listContractorsPage, updateContractor, resendInvitation };
