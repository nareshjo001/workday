const ApiError = require("../utils/ApiError");
const { SKILLS } = require("../constants/skills");

// Matches projects.name / company_name VARCHAR(150).
const NAME_MAX_LENGTH = 150;
// Use ISO calendar dates consistently with native date inputs and MySQL dateStrings.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

// Return today's ISO date for calendar-date comparisons.
function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

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

// Validate project fields while deriving PM and company ownership server-side.
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
        // ISO calendar dates preserve chronological order under string comparison.
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

  // Require positive project capacity with at most two decimal places.
  const expectedHoursRaw = body.expected_hours;
  const expectedHours = Number(expectedHoursRaw);
  if (
    expectedHoursRaw === undefined ||
    expectedHoursRaw === null ||
    expectedHoursRaw === "" ||
    !Number.isFinite(expectedHours) ||
    expectedHours <= 0
  ) {
    errors.push("expected_hours must be a positive number.");
  } else if (Math.round(expectedHours * 100) !== expectedHours * 100) {
    errors.push("expected_hours may have at most 2 decimal places.");
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { name, description, startDate, endDate, expectedHours, requirements };
}

function validateProjectIdParam(params = {}) {
  const n = Number(params.id);
  if (!Number.isInteger(n) || n <= 0) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return n;
}

// Validate positive allocation amounts to two decimals; enforce ownership and remaining capacity in the service.
function validateUpdateAllocation(params = {}, body = {}) {
  const errors = [];

  const projectId = parsePositiveInt(params.projectId);
  const contractorId = parsePositiveInt(params.contractorId);
  if (!projectId) errors.push("projectId must be a positive integer.");
  if (!contractorId) errors.push("contractorId must be a positive integer.");

  const raw = body.allocated_hours;
  const allocatedHours = Number(raw);
  if (raw === undefined || raw === null || raw === "" || !Number.isFinite(allocatedHours) || allocatedHours <= 0) {
    errors.push("allocated_hours must be a positive number.");
  } else if (Math.round(allocatedHours * 100) !== allocatedHours * 100) {
    errors.push("allocated_hours may have at most 2 decimal places.");
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { projectId, contractorId, allocatedHours };
}

function validateUpdateProject(body = {}) {
  const allowed = ["name", "description", "start_date", "end_date", "expected_hours", "budget", "currency", "max_hours_per_day", "max_hours_per_week", "allow_weekend", "backdate_limit_days", "candidate_response_sla_hours", "status"];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) throw ApiError.badRequest("Validation failed", ["Provide supported project fields."]);
  const result = {};
  if ("name" in body) { if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > NAME_MAX_LENGTH) throw ApiError.badRequest("Validation failed", ["name is invalid."]); result.name = body.name.trim(); }
  if ("description" in body) { if (body.description !== null && typeof body.description !== "string") throw ApiError.badRequest("Validation failed", ["description is invalid."]); result.description = body.description?.trim() || null; }
  if ("start_date" in body) { if (!isValidDateString(body.start_date)) throw ApiError.badRequest("Validation failed", ["start_date is invalid."]); result.startDate = body.start_date; }
  if ("end_date" in body) { if (body.end_date !== null && body.end_date !== "" && !isValidDateString(body.end_date)) throw ApiError.badRequest("Validation failed", ["end_date is invalid."]); result.endDate = body.end_date || null; }
  for (const [input, key, nullable, integer] of [["expected_hours", "expectedHours", false, false], ["budget", "budget", true, false], ["max_hours_per_day", "maxHoursPerDay", true, false], ["max_hours_per_week", "maxHoursPerWeek", true, false], ["backdate_limit_days", "backdateLimitDays", true, true], ["candidate_response_sla_hours", "candidateResponseSlaHours", false, true]]) {
    if (!(input in body)) continue;
    const value = body[input] === null || body[input] === "" ? null : Number(body[input]);
    if ((!nullable && value === null) || (value !== null && (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value)) || (!integer && Math.round(value * 100) !== value * 100))) || (input === "candidate_response_sla_hours" && value > 8760)) throw ApiError.badRequest("Validation failed", [`${input} is invalid.`]);
    result[key] = value;
  }
  if ("currency" in body) { const value = String(body.currency || "").trim().toUpperCase(); if (value && !/^[A-Z]{3}$/.test(value)) throw ApiError.badRequest("Validation failed", ["currency must be a 3-letter code."]); result.currency = value || null; }
  if ("allow_weekend" in body) { if (typeof body.allow_weekend !== "boolean") throw ApiError.badRequest("Validation failed", ["allow_weekend must be boolean."]); result.allowWeekend = body.allow_weekend ? 1 : 0; }
  if ("status" in body) { const value = String(body.status || "").toUpperCase(); if (!["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].includes(value)) throw ApiError.badRequest("Validation failed", ["status is invalid."]); result.status = value; }
  return result;
}
function validateUpdateRequirement(body={}) { const result={}; if("required_count" in body){const n=Number(body.required_count);if(!Number.isInteger(n)||n<1)throw ApiError.badRequest("Validation failed",["required_count must be a positive integer."]);result.requiredCount=n;} if("description" in body){if(body.description!==null&&typeof body.description!=="string")throw ApiError.badRequest("Validation failed",["description is invalid."]);result.description=body.description?.trim().slice(0,500)||null;} if("status" in body){const value=String(body.status||"").toUpperCase();if(!["OPEN","CLOSED"].includes(value))throw ApiError.badRequest("Validation failed",["status is invalid."]);result.status=value;} if(!Object.keys(result).length)throw ApiError.badRequest("Validation failed",["Provide supported requirement fields."]);return result; }

function validateReleaseContractor(params = {}, body = {}) {
  const projectId = parsePositiveInt(params.projectId);
  const contractorId = parsePositiveInt(params.contractorId);
  const actualEndDate = body.actual_end_date;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const errors = [];
  if (!projectId) errors.push("projectId must be a positive integer.");
  if (!contractorId) errors.push("contractorId must be a positive integer.");
  if (!isValidDateString(actualEndDate)) errors.push("actual_end_date must be a valid YYYY-MM-DD date.");
  if (!reason || reason.length > 500) errors.push("reason is required and must be 500 characters or fewer.");
  if (errors.length) throw ApiError.badRequest("Validation failed", errors);
  return { projectId, contractorId, actualEndDate, reason };
}

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { validateCreateProject, validateProjectIdParam, validateUpdateAllocation, validateUpdateProject, validateUpdateRequirement, validateReleaseContractor };
