const ApiError = require("../utils/ApiError");
const {
  normalizeEmail,
  EMAIL_REGEX,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} = require("./authValidators");

// Matches the DECIMAL(10,2) capacity of contractors.hourly_rate — reject
// out-of-range values here with a clean 400 instead of letting MySQL
// truncate/reject the insert.
const MAX_HOURLY_RATE = 99999999.99;

const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE"];

function parseHourlyRate(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function isValidRate(rate) {
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_HOURLY_RATE;
}

/**
 * Validates + normalizes the payload for POST /api/vendor/contractors.
 * Returns { name, email, password, hourlyRate } on success, throws
 * ApiError(400) otherwise. Deliberately does NOT accept vendor_id/user_id/
 * role from the request — those are always derived server-side.
 */
function validateCreateContractor(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const hourlyRateProvided =
    body.hourly_rate !== undefined && body.hourly_rate !== null && body.hourly_rate !== "";
  const hourlyRate = parseHourlyRate(body.hourly_rate);

  if (!name) errors.push("Name is required.");
  else if (name.length > NAME_MAX_LENGTH)
    errors.push(`Name must be at most ${NAME_MAX_LENGTH} characters.`);

  if (!email) errors.push("Email is required.");
  else if (!EMAIL_REGEX.test(email)) errors.push("Email format is invalid.");

  if (!password) errors.push("Password is required.");
  else if (password.length < PASSWORD_MIN_LENGTH)
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);

  if (!hourlyRateProvided) errors.push("Hourly rate is required.");
  else if (!isValidRate(hourlyRate))
    errors.push("Hourly rate must be a valid non-negative number.");

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { name, email, password, hourlyRate: Math.round(hourlyRate * 100) / 100 };
}

/**
 * Validates + normalizes the payload for PATCH /api/vendor/contractors/:id.
 * Only hourly_rate and/or status are ever read from the body — anything
 * else the client sends (user_id, vendor_id, role, ...) is ignored, not
 * just rejected, so there is no path through this function that can smuggle
 * an identity/ownership field into the update.
 */
function validateUpdateContractor(body = {}) {
  const errors = [];
  const result = {};

  const hasRate = Object.prototype.hasOwnProperty.call(body, "hourly_rate");
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

  if (!hasRate && !hasStatus) {
    errors.push("Provide at least one of hourly_rate or status.");
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

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return result;
}

module.exports = { validateCreateContractor, validateUpdateContractor };
