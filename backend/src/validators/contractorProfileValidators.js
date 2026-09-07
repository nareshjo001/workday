const ApiError = require("../utils/ApiError");
const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

/**
 * Validates the payload for PATCH /api/contractor/profile. Returns
 * { skill } on success, throws ApiError(400) otherwise. Deliberately does
 * NOT accept contractor_id/user_id — the acting contractor is always
 * derived server-side from the authenticated JWT (see
 * contractorProfileService.updateSkill).
 */
function validateUpdateProfile(body = {}) {
  const errors = [];
  const allowed = ["phone", "headline", "total_experience_years", "skills", "skill"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) errors.push("Unexpected field in request.");
  const result = {};
  for (const [key, max] of [["phone", 30], ["headline", 160]]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = typeof body[key] === "string" ? body[key].trim() : "";
      if (value.length > max) errors.push(`${key} must be at most ${max} characters.`); else result[key] = value || null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "total_experience_years")) {
    const value = body.total_experience_years === null || body.total_experience_years === "" ? null : Number(body.total_experience_years);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 99.9)) errors.push("total_experience_years must be between 0 and 99.9."); else result.totalExperienceYears = value;
  }
  if (Object.prototype.hasOwnProperty.call(body, "skills")) {
    if (!Array.isArray(body.skills) || body.skills.length > 20) errors.push("skills must be an array with at most 20 entries.");
    else {
      const seen = new Set(); let primaryCount = 0;
      result.skills = body.skills.map((item) => {
        const code = typeof item?.code === "string" ? item.code.trim().toUpperCase() : "";
        const proficiency = typeof item?.proficiency === "string" ? item.proficiency.trim().toUpperCase() : "";
        const yearsExperience = Number(item?.years_experience);
        const isPrimary = item?.is_primary === true;
        if (!code || seen.has(code)) errors.push("Each skill code must be unique."); seen.add(code);
        if (!PROFICIENCIES.includes(proficiency)) errors.push(`Skill proficiency must be one of: ${PROFICIENCIES.join(", ")}.`);
        if (!Number.isFinite(yearsExperience) || yearsExperience < 0 || yearsExperience > 99.9) errors.push("Skill years_experience must be between 0 and 99.9.");
        if (isPrimary) primaryCount += 1;
        return { code, proficiency, yearsExperience: Math.round(yearsExperience * 10) / 10, isPrimary };
      });
      if (result.skills.length && primaryCount !== 1) errors.push("Exactly one skill must be primary when skills are provided.");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "skill")) {
    const code = typeof body.skill === "string" ? body.skill.trim().toUpperCase() : "";
    if (!code) errors.push("skill is required.");
    else result.skills = [{ code, proficiency: "INTERMEDIATE", yearsExperience: 0, isPrimary: true }];
  }
  if (!Object.keys(result).length) errors.push("Provide at least one profile field.");

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return result;
}

module.exports = { validateUpdateProfile, PROFICIENCIES };
