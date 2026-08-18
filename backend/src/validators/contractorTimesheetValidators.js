const ApiError = require("../utils/ApiError");

// Matches timesheets.hours_logged DECIMAL(5,2) capacity, further capped
// to the business rule "at most 24 hours in a single day" (a calendar
// day cannot hold more work than that) — the DB column could technically
// hold up to 999.99 (and legacy pre-revision rows do, see migration
// 013's comments), but this is the real-world ceiling enforced for every
// NEW daily submission or edit. There is deliberately no weekly cap
// anymore — a contractor may log every day of a week at up to 24 hours
// each; the weekly total shown in the UI is just a sum of whatever daily
// rows exist, never itself validated against a limit.
const MAX_HOURS_PER_DAY = 24;

// ISO date string, e.g. "2026-08-17" — matches what a native
// <input type="date"> sends, and what MySQL returns given
// config/db.js's dateStrings:true pool option. Same pattern as
// pmProjectValidators.DATE_REGEX.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * hoursLogged must be a finite number, > 0, <= MAX_HOURS_PER_DAY, with at
 * most 2 decimal places (matching DECIMAL(5,2)). Accepts a JS number or a
 * numeric string the same way vendorContractorValidators.parseHourlyRate
 * does for hourly_rate. Shared by both validateSubmitTimesheet and
 * validateEditTimesheet below — the rule is identical for a first
 * submission and a resubmitted edit, so it lives in exactly one place.
 * Pushes onto the caller's `errors` array and returns the normalized
 * value, or null if invalid (callers only use the returned value once
 * `errors` is confirmed empty).
 */
function parseAndValidateHours(value, errors) {
  const raw = typeof value === "number" || typeof value === "string" ? value : NaN;
  if (typeof raw === "string" && raw.trim() === "") {
    errors.push("hoursLogged must be a valid number.");
    return null;
  }
  const hoursLogged = Number(raw);

  if (!Number.isFinite(hoursLogged)) {
    errors.push("hoursLogged must be a valid number.");
    return null;
  }
  if (hoursLogged <= 0) {
    errors.push("hoursLogged must be greater than 0.");
    return null;
  }
  if (hoursLogged > MAX_HOURS_PER_DAY) {
    errors.push(`hoursLogged cannot exceed ${MAX_HOURS_PER_DAY} hours per day.`);
    return null;
  }
  if (Math.round(hoursLogged * 100) !== hoursLogged * 100) {
    errors.push("hoursLogged may have at most 2 decimal places.");
    return null;
  }
  return Math.round(hoursLogged * 100) / 100;
}

/**
 * Validates + normalizes the payload for POST /api/contractor/timesheets.
 * Returns { projectId, workDate, hoursLogged } on success, throws
 * ApiError(400) otherwise.
 *
 * This function only checks SHAPE (is workDate a real calendar date in
 * the right format? is hoursLogged a valid in-range number?) — it does
 * NOT know whether workDate falls inside the target project's
 * start/end dates or whether it's in the future, because that requires
 * data (the project row, "today") this pure validator doesn't have
 * access to. That range enforcement is the security boundary the spec
 * calls out explicitly, and it lives entirely in
 * contractorTimesheetService (assertWorkDateWithinProject), which fetches
 * the project itself — see that file's comments. Keeping it there
 * instead of duplicating a second "is it in the future" check here also
 * means validateEditTimesheet's identical range requirement is enforced
 * by that exact same function, not a second, potentially-drifting copy.
 *
 * Deliberately does NOT read/accept status, reviewed_by, reviewed_at, or
 * contractor_id from the body — those fields are simply never looked at
 * here, so there is no path through this function that lets a client
 * smuggle a server-controlled field into the request. contractorId is
 * resolved server-side from the JWT by the caller
 * (contractorTimesheetService), never from this payload.
 */
function validateSubmitTimesheet(body = {}) {
  const errors = [];

  const projectId = parsePositiveInt(body.projectId);
  if (!projectId) errors.push("projectId is required and must be a positive integer.");

  const workDateRaw = typeof body.workDate === "string" ? body.workDate.trim() : "";
  if (!workDateRaw) {
    errors.push("workDate is required.");
  } else if (!isValidDateString(workDateRaw)) {
    errors.push("workDate must be a valid date (YYYY-MM-DD).");
  }

  const hoursLogged = parseAndValidateHours(body.hoursLogged, errors);

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { projectId, workDate: workDateRaw, hoursLogged };
}

/**
 * Validates the :id route param shared by
 * PATCH /api/contractor/timesheets/:id. A small, deliberate duplicate of
 * pmTimesheetValidators.validateTimesheetIdParam rather than a shared
 * import — the two live in different role-scoped validator modules
 * (contractor vs. PM) and this is a five-line pure function, the same
 * "small duplication over a cross-role coupling" tradeoff this codebase
 * already makes for parsePositiveInt itself (redefined per validator
 * file rather than centralized).
 */
function validateTimesheetIdParam(params = {}) {
  const timesheetId = parsePositiveInt(params.id);
  if (!timesheetId) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return timesheetId;
}

/**
 * Validates + normalizes the payload for
 * PATCH /api/contractor/timesheets/:id (editing one of the contractor's
 * own REJECTED daily logs). Returns { workDate, hoursLogged } on success,
 * throws ApiError(400) otherwise. Same shape-only scope as
 * validateSubmitTimesheet above — no projectId here (a contractor can
 * never move an existing log to a different project through this
 * endpoint; project_id is immutable, see contractorTimesheetService), and
 * no status/reviewed_by/reviewed_at (always server-derived: this endpoint
 * always resets to PENDING and clears the review fields, never accepts
 * them from the client).
 */
function validateEditTimesheet(body = {}) {
  const errors = [];

  const workDateRaw = typeof body.workDate === "string" ? body.workDate.trim() : "";
  if (!workDateRaw) {
    errors.push("workDate is required.");
  } else if (!isValidDateString(workDateRaw)) {
    errors.push("workDate must be a valid date (YYYY-MM-DD).");
  }

  const hoursLogged = parseAndValidateHours(body.hoursLogged, errors);

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { workDate: workDateRaw, hoursLogged };
}

module.exports = {
  validateSubmitTimesheet,
  validateTimesheetIdParam,
  validateEditTimesheet,
  MAX_HOURS_PER_DAY,
};
