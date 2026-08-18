const ApiError = require("../utils/ApiError");
const { SKILLS } = require("../constants/skills");

/**
 * Validates the payload for PATCH /api/contractor/profile. Returns
 * { skill } on success, throws ApiError(400) otherwise. Deliberately does
 * NOT accept contractor_id/user_id — the acting contractor is always
 * derived server-side from the authenticated JWT (see
 * contractorProfileService.updateSkill).
 */
function validateUpdateProfile(body = {}) {
  const errors = [];

  const skill = typeof body.skill === "string" ? body.skill.trim().toUpperCase() : "";

  if (!skill) errors.push("Skill is required.");
  else if (!SKILLS.includes(skill)) errors.push(`Skill must be one of: ${SKILLS.join(", ")}.`);

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { skill };
}

module.exports = { validateUpdateProfile };
