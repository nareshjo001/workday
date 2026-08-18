const { ROLES, SELF_SIGNUP_ROLES } = require("../constants/roles");
const ApiError = require("../utils/ApiError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const COMPANY_NAME_MAX_LENGTH = 150;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : email;
}

/**
 * Validates + normalizes a signup payload.
 * Returns the sanitized fields on success, throws ApiError(400) otherwise.
 */
function validateSignup(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";

  if (!name) errors.push("Name is required.");
  else if (name.length > NAME_MAX_LENGTH)
    errors.push(`Name must be at most ${NAME_MAX_LENGTH} characters.`);

  if (!email) errors.push("Email is required.");
  else if (!EMAIL_REGEX.test(email)) errors.push("Email format is invalid.");

  if (!password) errors.push("Password is required.");
  else if (password.length < PASSWORD_MIN_LENGTH)
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);

  if (!role) {
    errors.push("Role is required.");
  } else if (role === ROLES.CONTRACTOR) {
    // Contractor accounts are provisioned by a Vendor
    // (POST /api/vendor/contractors), not self-registered — see
    // constants/roles.js. Called out separately from the generic "invalid
    // role" case below so the client gets an explanation, not a guess.
    errors.push(
      "Contractor accounts are created by a Vendor, not self-registered. Ask your Vendor to add you as a contractor."
    );
  } else if (!SELF_SIGNUP_ROLES.includes(role)) {
    errors.push(`Role must be one of: ${SELF_SIGNUP_ROLES.join(", ")}.`);
  }

  // PM signup associates the account with a client company (see
  // authService.signup / client_companies + project_managers,
  // migration 009). Vendor signup does not need this; Contractor
  // self-signup is disabled above, so it never reaches this branch.
  let companyName = "";
  if (role === ROLES.PM) {
    companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    if (!companyName) {
      errors.push("Company name is required for Project Manager accounts.");
    } else if (companyName.length > COMPANY_NAME_MAX_LENGTH) {
      errors.push(`Company name must be at most ${COMPANY_NAME_MAX_LENGTH} characters.`);
    }
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { name, email, password, role, companyName: role === ROLES.PM ? companyName : undefined };
}

/**
 * Validates + normalizes a login payload.
 */
function validateLogin(body = {}) {
  const errors = [];

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) errors.push("Email is required.");
  else if (!EMAIL_REGEX.test(email)) errors.push("Email format is invalid.");

  if (!password) errors.push("Password is required.");

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { email, password };
}

module.exports = {
  validateSignup,
  validateLogin,
  normalizeEmail,
  // Exported so other modules (e.g. Module 2's vendor-created contractor
  // accounts) validate emails/passwords against the exact same rules
  // instead of duplicating/drifting from them.
  EMAIL_REGEX,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
};
