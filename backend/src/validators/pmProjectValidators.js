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

  // Project hours/allocation redesign: total hours capacity for the
  // WHOLE project (every contractor combined) — required, positive,
  // non-zero, at most 2 decimal places (matches projects.expected_hours
  // DECIMAL(9,2), same precision convention as timesheets.hours_logged /
  // milestones.threshold_hours). There is deliberately no project-edit
  // endpoint here that would let this value be lowered below already-
  // allocated hours after staffing begins — expected_hours is only ever
  // set at creation time in this MVP (see STEP2_STEP3_PLAN.md: no
  // unnecessary edit endpoint was added since nothing in the spec's
  // required workflow needs one).
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

/**
 * Validates the :id route param for GET /api/pm/projects/:id/contractors
 * (Module 5 addition). Same parsePositiveInt-based pattern as
 * pmTimesheetValidators.validateTimesheetIdParam.
 */
function validateProjectIdParam(params = {}) {
  const n = Number(params.id);
  if (!Number.isInteger(n) || n <= 0) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return n;
}

/**
 * Validates the URL params + body for
 * PATCH /api/pm/projects/:projectId/contractors/:contractorId/allocation —
 * MVP fix 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"). Returns { projectId, contractorId, allocatedHours } on
 * success, throws ApiError(400) otherwise.
 *
 * allocatedHours must be a finite, POSITIVE number (no zero, no negative —
 * per the fix's explicit requirement) with at most 2 decimal places,
 * matching project_assignments.allocated_hours DECIMAL(9,2) — the same
 * precision/positivity rule the old Vendor-side allocatedHours parser
 * used before this fix moved allocation ownership to the PM (see
 * vendorAssignmentValidators, which no longer parses this field at all).
 * Business-rule checks that need DB state — the contractor must actually
 * be assigned to this project, the new value can't be lowered below hours
 * already approved for them, and the project-wide total can't exceed
 * expected_hours — all live in pmProjectService.updateContractorAllocation,
 * not here (shape here, business rules in the service, same division of
 * responsibility as every other validator in this codebase).
 */
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
  const allowed = ["name", "description", "start_date", "end_date", "expected_hours", "budget", "currency", "max_hours_per_day", "max_hours_per_week", "allow_weekend", "backdate_limit_days", "status"];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) throw ApiError.badRequest("Validation failed", ["Provide supported project fields."]);
  const result = {};
  if ("name" in body) { if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > NAME_MAX_LENGTH) throw ApiError.badRequest("Validation failed", ["name is invalid."]); result.name = body.name.trim(); }
  if ("description" in body) { if (body.description !== null && typeof body.description !== "string") throw ApiError.badRequest("Validation failed", ["description is invalid."]); result.description = body.description?.trim() || null; }
  if ("start_date" in body) { if (!isValidDateString(body.start_date)) throw ApiError.badRequest("Validation failed", ["start_date is invalid."]); result.startDate = body.start_date; }
  if ("end_date" in body) { if (body.end_date !== null && body.end_date !== "" && !isValidDateString(body.end_date)) throw ApiError.badRequest("Validation failed", ["end_date is invalid."]); result.endDate = body.end_date || null; }
  for (const [input, key, nullable, integer] of [["expected_hours", "expectedHours", false, false], ["budget", "budget", true, false], ["max_hours_per_day", "maxHoursPerDay", true, false], ["max_hours_per_week", "maxHoursPerWeek", true, false], ["backdate_limit_days", "backdateLimitDays", true, true]]) {
    if (!(input in body)) continue;
    const value = body[input] === null || body[input] === "" ? null : Number(body[input]);
    if ((!nullable && value === null) || (value !== null && (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value)) || (!integer && Math.round(value * 100) !== value * 100)))) throw ApiError.badRequest("Validation failed", [`${input} is invalid.`]);
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

// Shared with validateProjectIdParam's inline check above — small,
// deliberate duplication of the parsePositiveInt pattern every validator
// file in this codebase already keeps its own copy of.
function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { validateCreateProject, validateProjectIdParam, validateUpdateAllocation, validateUpdateProject, validateUpdateRequirement, validateReleaseContractor };
