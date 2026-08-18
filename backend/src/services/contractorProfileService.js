const contractorRepository = require("../repositories/contractorRepository");
const ApiError = require("../utils/ApiError");

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
  return { skill: contractor.skill || null };
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
async function updateSkill(userId, skill) {
  const updated = await contractorRepository.updateSkillByUserId(userId, skill);
  if (!updated) {
    // Should be unreachable for a real CONTRACTOR-role JWT — Module 2's
    // creation transaction always inserts the contractors row alongside
    // the users row — but guard anyway rather than silently succeeding
    // on nothing.
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  return { skill };
}

module.exports = { getProfile, updateSkill };
