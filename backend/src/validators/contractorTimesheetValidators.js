const ApiError = require("../utils/ApiError");

// Cap each daily log at 24 hours regardless of the database column's larger numeric capacity.
const MAX_HOURS_PER_DAY = 24;

// Use ISO calendar dates consistently with native date inputs and MySQL dateStrings.
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

// Validate positive daily hours to two decimal places for both creation and editing.
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

// Validate editable fields only; the service enforces identity, project dates, and lifecycle rules.
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

  const description = body.description === undefined ? null : String(body.description).trim();
  if (description && description.length > 1000) errors.push("description must be at most 1000 characters.");
  if (errors.length > 0) throw ApiError.badRequest("Validation failed", errors);
  return { projectId, workDate: workDateRaw, hoursLogged, description: description || null };
}

function validateTimesheetIdParam(params = {}) {
  const timesheetId = parsePositiveInt(params.id);
  if (!timesheetId) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return timesheetId;
}

// Accept editable log fields without allowing project, owner, or review metadata changes.
function validateEditTimesheet(body = {}) {
  const errors = [];

  const workDateRaw = typeof body.workDate === "string" ? body.workDate.trim() : "";
  if (!workDateRaw) {
    errors.push("workDate is required.");
  } else if (!isValidDateString(workDateRaw)) {
    errors.push("workDate must be a valid date (YYYY-MM-DD).");
  }

  const hoursLogged = parseAndValidateHours(body.hoursLogged, errors);

  const description = body.description === undefined ? null : String(body.description).trim();
  if (description && description.length > 1000) errors.push("description must be at most 1000 characters.");
  if (errors.length > 0) throw ApiError.badRequest("Validation failed", errors);
  return { workDate: workDateRaw, hoursLogged, description: description || null };
}

module.exports = {
  validateSubmitTimesheet,
  validateTimesheetIdParam,
  validateEditTimesheet,
  MAX_HOURS_PER_DAY,
};
