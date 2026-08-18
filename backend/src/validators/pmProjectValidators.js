const ApiError = require("../utils/ApiError");
const { SKILLS } = require("../constants/skills");

// Matches projects.name / company_name VARCHAR(150).
const NAME_MAX_LENGTH = 150;
// ISO date string, e.g. "2026-08-20" — matches what the frontend sends
// from a native <input type="date">, and what MySQL returns given
// config/db.js's dateStrings:true pool option (no timezone conversion to
// reason about on either side).
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

/**
 * "Today" as a YYYY-MM-DD string, compared lexicographically against
 * ISO date strings the same way startDate/endDate are compared against
 * each other below — no Date object math needed either side.
 */
function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validates one { skill, required_count } entry. Returns
 * { skill, requiredCount } or pushes error messages onto `errors`.
 */
function validateRequirementEntry(entry, index, errors, seenSkills) {
  if (typeof entry !== "object" || entry === null) {
    errors.push(`requirements[${index}] must be an object.`);
    return null;
  }

  const skill = typeof entry.skill === "string" ? entry.skill.trim().toUpperCase() : "";
  const requiredCountRaw = entry.required_count;
  const requiredCount = Number(requiredCountRaw);

  if (!skill || !SKILLS.includes(skill)) {
    errors.push(`requirements[${index}].skill must be one of: ${SKILLS.join(", ")}.`);
  } else if (seenSkills.has(skill)) {
    errors.push(`Duplicate staffing requirement for skill "${skill}" — each skill may appear at most once.`);
  }

  if (!Number.isInteger(requiredCount) || requiredCount <= 0) {
    errors.push(`requirements[${index}].required_count must be a positive integer.`);
  }

  if (skill && SKILLS.includes(skill)) seenSkills.add(skill);

  if (errors.length > 0) return null;
  return { skill, requiredCount };
}

/**
 * Validates + normalizes the payload for POST /api/pm/projects. Returns
 * { name, description, startDate, endDate, requirements } on success,
 * throws ApiError(400) otherwise. Deliberately does NOT accept pm_id —
 * that's always derived server-side from the authenticated PM's JWT.
 *
 * company_name is NO LONGER accepted here (vendor-centric workflow
 * revision) — a project's client company is now derived from the
 * creating PM's own project_managers/client_companies link (set at PM
 * signup), not typed per-project. See projectRepository.create /
 * pmProjectService.createProject.
 *
 * Module 3 revision additions: requirements (at least one staffing line,
 * no duplicate skills, positive counts). Dates must not be in the past
 * for a NEW project — this only applies at creation time; existing
 * projects are never silently modified.
 */
function validateCreateProject(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" && body.description.trim() !== ""
      ? body.description.trim()
      : null;
  const startDate = typeof body.start_date === "string" ? body.start_date.trim() : "";
  const endDateProvided =
    body.end_date !== undefined && body.end_date !== null && body.end_date !== "";
  const endDate = endDateProvided && typeof body.end_date === "string" ? body.end_date.trim() : null;

  if (!name) errors.push("Name is required.");
  else if (name.length > NAME_MAX_LENGTH)
    errors.push(`Name must be at most ${NAME_MAX_LENGTH} characters.`);

  const today = todayDateString();

  if (!startDate) errors.push("Start date is required.");
  else if (!isValidDateString(startDate)) errors.push("Start date must be a valid date (YYYY-MM-DD).");
  else if (startDate < today) errors.push("Start date cannot be in the past.");

  if (endDateProvided) {
    if (!isValidDateString(endDate)) {
      errors.push("End date must be a valid date (YYYY-MM-DD).");
    } else {
      if (endDate < today) errors.push("End date cannot be in the past.");
      if (isValidDateString(startDate) && endDate < startDate) {
        // ISO YYYY-MM-DD strings compare correctly with plain string
        // comparison — no need to parse into Date objects for this check.
        errors.push("End date cannot be before start date.");
      }
    }
  }

  const requirementsInput = Array.isArray(body.requirements) ? body.requirements : null;
  const requirements = [];
  if (!requirementsInput || requirementsInput.length === 0) {
    errors.push("At least one staffing requirement is required.");
  } else {
    const seenSkills = new Set();
    requirementsInput.forEach((entry, index) => {
      const validated = validateRequirementEntry(entry, index, errors, seenSkills);
      if (validated) requirements.push(validated);
    });
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { name, description, startDate, endDate, requirements };
}

module.exports = { validateCreateProject };
