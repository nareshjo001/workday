const ApiError = require("../utils/ApiError");
const {
  normalizeEmail,
  EMAIL_REGEX,
  NAME_MAX_LENGTH,
} = require("./authValidators");

// Match the hourly-rate column's DECIMAL(10,2) limit before writing to MySQL.
const MAX_HOURLY_RATE = 99999999.99;

const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE"];
const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

function parseHourlyRate(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function isValidRate(rate) {
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_HOURLY_RATE;
}

// Accept contractor fields while deriving vendor, user, and role identities server-side.
function validateCreateContractor(body = {}) {
  const errors = [];
  const allowed = process.env.NODE_ENV === "test" ? ["name", "email", "hourly_rate", "password"] : ["name", "email", "hourly_rate"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) errors.push("Unexpected field in request.");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const hourlyRateProvided =
    body.hourly_rate !== undefined && body.hourly_rate !== null && body.hourly_rate !== "";
  const hourlyRate = parseHourlyRate(body.hourly_rate);

  if (!name) errors.push("Name is required.");
  else if (name.length > NAME_MAX_LENGTH)
    errors.push(`Name must be at most ${NAME_MAX_LENGTH} characters.`);

  if (!email) errors.push("Email is required.");
  else if (!EMAIL_REGEX.test(email)) errors.push("Email format is invalid.");


  if (!hourlyRateProvided) errors.push("Hourly rate is required.");
  else if (!isValidRate(hourlyRate))
    errors.push("Hourly rate must be a valid non-negative number.");

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  // Allow explicit passwords only in legacy test fixtures; production contractors use invitations.
  return { name, email, hourlyRate: Math.round(hourlyRate * 100) / 100, testPassword: process.env.NODE_ENV === "test" && typeof body.password === "string" ? body.password : undefined };
}

// Update permitted contractor fields without accepting client-supplied ownership or identity changes.
function validateUpdateContractor(body = {}) {
  const errors = [];
  const result = {};

  const hasRate = Object.prototype.hasOwnProperty.call(body, "hourly_rate");
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasProfile = ["phone", "headline", "total_experience_years", "notes", "skills"].some((key) => Object.prototype.hasOwnProperty.call(body, key));

  if (!hasRate && !hasStatus && !hasProfile) {
    errors.push("Provide at least one contractor field.");
  }

  if (hasRate) {
    const hourlyRate = parseHourlyRate(body.hourly_rate);
    if (!isValidRate(hourlyRate)) {
      errors.push("Hourly rate must be a valid non-negative number.");
    } else {
      result.hourlyRate = Math.round(hourlyRate * 100) / 100;
    }
  }

  if (hasStatus) {
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!ALLOWED_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`);
    } else {
      result.status = status;
    }
  }
  for (const [key, target, max] of [["phone", "phone", 30], ["headline", "headline", 160], ["notes", "notes", 1000]]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) { const value = typeof body[key] === "string" ? body[key].trim() : ""; if (value.length > max) errors.push(`${key} must be at most ${max} characters.`); else result[target] = value || null; }
  }
  if (Object.prototype.hasOwnProperty.call(body, "total_experience_years")) { const value = body.total_experience_years === null || body.total_experience_years === "" ? null : Number(body.total_experience_years); if (value !== null && (!Number.isFinite(value) || value < 0 || value > 99.9)) errors.push("total_experience_years must be between 0 and 99.9."); else result.totalExperienceYears = value; }
  if (Object.prototype.hasOwnProperty.call(body, "skills")) { const seen = new Set(); let primary = 0; if (!Array.isArray(body.skills) || body.skills.length > 20) errors.push("skills must be an array with at most 20 entries."); else result.skills = body.skills.map((item) => { const code = typeof item?.code === "string" ? item.code.trim().toUpperCase() : ""; const proficiency = typeof item?.proficiency === "string" ? item.proficiency.trim().toUpperCase() : ""; const yearsExperience = Number(item?.years_experience); const isPrimary = item?.is_primary === true; if (!code || seen.has(code)) errors.push("Each skill code must be unique."); seen.add(code); if (!PROFICIENCIES.includes(proficiency)) errors.push("Skill proficiency is invalid."); if (!Number.isFinite(yearsExperience) || yearsExperience < 0 || yearsExperience > 99.9) errors.push("Skill years_experience must be between 0 and 99.9."); if (isPrimary) primary += 1; return { code, proficiency, yearsExperience, isPrimary }; }); if (body.skills.length && primary !== 1) errors.push("Exactly one skill must be primary when skills are provided."); }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return result;
}

module.exports = { validateCreateContractor, validateUpdateContractor };
