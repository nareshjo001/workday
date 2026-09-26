const ApiError = require("../utils/ApiError");

const ALLOWED_STATUSES = ["APPROVED", "REJECTED"];

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateTimesheetIdParam(params = {}) {
  const timesheetId = parsePositiveInt(params.id);
  if (!timesheetId) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return timesheetId;
}

// Accept only approval or rejection; derive reviewer identity and timestamps server-side.
function validateReviewTimesheet(body = {}) {
  const errors = [];

  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (!status) {
    errors.push("status is required.");
  } else if (!ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(", ")}.`);
  }

  const rejectionReason = body.rejectionReason === undefined ? null : String(body.rejectionReason).trim();
  if (status === "REJECTED" && !rejectionReason) errors.push("rejectionReason is required when rejecting a timesheet.");
  if (rejectionReason && rejectionReason.length > 1000) errors.push("rejectionReason must be at most 1000 characters.");
  if (errors.length > 0) throw ApiError.badRequest("Validation failed", errors);
  return { status, rejectionReason: rejectionReason || null };
}

function validateBulkReviewTimesheets(body = {}) {
  const { status, rejectionReason } = validateReviewTimesheet(body);
  const rawIds = Array.isArray(body.timesheetIds) ? body.timesheetIds : [];
  const ids = rawIds.map(parsePositiveInt);
  if (!ids.length || ids.some((id) => !id)) {
    throw ApiError.badRequest("Validation failed", ["timesheetIds must be a non-empty list of positive integers."]);
  }
  return { timesheetIds: [...new Set(ids)].sort((a, b) => a - b), status, rejectionReason };
}

module.exports = { validateTimesheetIdParam, validateReviewTimesheet, validateBulkReviewTimesheets };
