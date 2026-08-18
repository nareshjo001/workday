const ApiError = require("../utils/ApiError");

// Matches milestones.name VARCHAR(150).
const NAME_MAX_LENGTH = 150;

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validates the :projectId route param for
 * GET /api/pm/milestones/:projectId. Same small per-file
 * parsePositiveInt duplication every other validator module in this
 * codebase already uses (see pmProjectValidators/pmTimesheetValidators).
 */
function validateProjectIdParam(params = {}) {
  const projectId = parsePositiveInt(params.projectId);
  if (!projectId) {
    throw ApiError.badRequest("Validation failed", ["projectId must be a positive integer."]);
  }
  return projectId;
}

/**
 * Validates + normalizes the payload for POST /api/pm/milestones.
 * Returns { projectId, name, thresholdHours } on success, throws
 * ApiError(400) otherwise. Deliberately does NOT accept pm_id — ownership
 * of project_id is derived server-side from the authenticated PM's JWT
 * (see pmMilestoneService.createMilestone), same convention as
 * pmProjectValidators.validateCreateProject never accepting pm_id.
 *
 * PROJECT-LEVEL REDESIGN: no contractor_id anymore — a milestone is a
 * project-wide checkpoint, not tied to any one contractor (see
 * pmMilestoneService's own comment on why). The
 * threshold_hours <= project.expected_hours check needs the project row,
 * which this pure shape-only validator doesn't have access to — that
 * business-rule check lives in pmMilestoneService.createMilestone
 * instead, same division of responsibility as every other validator in
 * this codebase (shape here, ownership/business rules in the service).
 *
 * threshold_hours accepts up to 2 decimal places, matching
 * milestones.threshold_hours DECIMAL(7,2) — the same precision timesheets
 * uses for hours_logged.
 */
function validateCreateMilestone(body = {}) {
  const errors = [];

  const projectId = parsePositiveInt(body.project_id);
  if (!projectId) errors.push("project_id must be a positive integer.");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push("name is required.");
  else if (name.length > NAME_MAX_LENGTH) errors.push(`name must be at most ${NAME_MAX_LENGTH} characters.`);

  const thresholdHoursRaw = body.threshold_hours;
  const thresholdHours = Number(thresholdHoursRaw);
  if (
    thresholdHoursRaw === undefined ||
    thresholdHoursRaw === null ||
    thresholdHoursRaw === "" ||
    !Number.isFinite(thresholdHours) ||
    thresholdHours <= 0
  ) {
    errors.push("threshold_hours must be a positive number.");
  } else if (Math.round(thresholdHours * 100) !== thresholdHours * 100) {
    errors.push("threshold_hours may have at most 2 decimal places.");
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { projectId, name, thresholdHours };
}

module.exports = { validateCreateMilestone, validateProjectIdParam };
