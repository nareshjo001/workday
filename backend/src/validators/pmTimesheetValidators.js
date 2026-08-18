const ApiError = require("../utils/ApiError");

const ALLOWED_STATUSES = ["APPROVED", "REJECTED"];

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validates the :id route param for PATCH /api/pm/timesheets/:id.
 * Returns the parsed timesheet id, throws ApiError(400) otherwise.
 */
function validateTimesheetIdParam(params = {}) {
  const timesheetId = parsePositiveInt(params.id);
  if (!timesheetId) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return timesheetId;
}

/**
 * Validates the payload for PATCH /api/pm/timesheets/:id. Returns
 * { status } on success, throws ApiError(400) otherwise. Only APPROVED
 * or REJECTED are ever accepted — a client cannot set a timesheet back
 * to PENDING, or to anything else, through this endpoint (spec section
 * 6). Deliberately does NOT accept reviewed_by/reviewed_at from the
 * body — those are always derived server-side (see
 * pmTimesheetService.reviewTimesheet).
 */
function validateReviewTimesheet(body = {}) {
  const errors = [];

  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (!status) {
    errors.push("status is required.");
  } else if (!ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(", ")}.`);
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { status };
}

module.exports = { validateTimesheetIdParam, validateReviewTimesheet };
