const contractorRepository = require("../repositories/contractorRepository");
const skillRepository = require("../repositories/skillRepository");
const { pool } = require("../config/db");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");

/**
 * The authenticated contractor's own profile — currently just their
 * skill, but returned as an object (not a bare string) so the shape can
 * grow without a breaking change. `userId` is req.user.userId off the
 * JWT, same identity source as updateSkill below.
 */
async function getProfile(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  return { phone: contractor.phone || null, headline: contractor.headline || null, total_experience_years: contractor.total_experience_years === null ? null : Number(contractor.total_experience_years), notes: contractor.notes || null, skills: await skillRepository.listForContractor(contractor.id) };
}

/**
 * Sets the authenticated contractor's own primary skill. `userId` is
 * req.user.userId off the JWT — this is the ONLY identity this function
 * ever acts on; there is no parameter that lets a contractor's request
 * touch a different contractor's row. Per Module 3 revision spec section
 * 31, changing a skill only affects FUTURE assignments — existing
 * project_assignments rows keep pointing at the requirement they were
 * originally locked to (see migration 008 / assignmentRepository), so
 * this function never needs to touch project_assignments at all.
 */
async function updateProfile(userId, fields, auditActor) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const contractor = await contractorRepository.findByUserIdForUpdate(conn, userId);
    if (!contractor) throw ApiError.notFound("Contractor record not found for this account.");
    const before = { phone: contractor.phone || null, headline: contractor.headline || null, total_experience_years: contractor.total_experience_years === null ? null : Number(contractor.total_experience_years), skills: await skillRepository.listForContractor(contractor.id, conn) };
    if (fields.skills) {
      const resolved = await Promise.all(fields.skills.map(async (skill) => ({ ...skill, skillId: (await skillRepository.findActiveByCode(skill.code, conn))?.id })));
      if (resolved.some((skill) => !skill.skillId)) throw ApiError.badRequest("One or more skills are unknown or inactive.");
      await skillRepository.replaceForContractor(conn, contractor.id, resolved);
    }
    await contractorRepository.updateProfileById(conn, contractor.id, fields);
    const after = { phone: fields.phone === undefined ? before.phone : fields.phone, headline: fields.headline === undefined ? before.headline : fields.headline, total_experience_years: fields.totalExperienceYears === undefined ? before.total_experience_years : fields.totalExperienceYears, skills: await skillRepository.listForContractor(contractor.id, conn) };
    if (auditActor) await auditService.write(conn, auditActor, "CONTRACTOR_PROFILE_UPDATED", "contractor", contractor.id, before, after);
    await conn.commit();
    return after;
  } catch (err) { await conn.rollback().catch(() => {}); throw err; } finally { conn.release(); }
}

module.exports = { getProfile, updateProfile };
