const contractorRepository = require("../repositories/contractorRepository");
const skillRepository = require("../repositories/skillRepository");
const { pool } = require("../config/db");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");

// Read the authenticated contractor's profile.
async function getProfile(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  return { phone: contractor.phone || null, headline: contractor.headline || null, total_experience_years: contractor.total_experience_years === null ? null : Number(contractor.total_experience_years), notes: contractor.notes || null, skills: await skillRepository.listForContractor(contractor.id) };
}

// Update the authenticated profile without changing existing assignment requirements.
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
