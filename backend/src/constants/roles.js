/**
 * Centralized role definitions for the Vendor Management System.
 * All role checks/comparisons across the codebase must reference these
 * constants rather than hardcoding role strings.
 */
const ROLES = Object.freeze({
  VENDOR: "VENDOR",
  CONTRACTOR: "CONTRACTOR",
  PM: "PM",
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

/**
 * Roles a user may pick for themselves via POST /api/auth/signup.
 * CONTRACTOR is deliberately excluded: for MVP, a Contractor account is
 * only ever created by a Vendor (POST /api/vendor/contractors) — see
 * validators/authValidators.js. ALL_ROLES is still used everywhere a role
 * needs to be recognized as valid (e.g. authorizeRoles), just not for
 * self-signup.
 */
const SELF_SIGNUP_ROLES = Object.freeze([ROLES.VENDOR, ROLES.PM]);

module.exports = { ROLES, ALL_ROLES, SELF_SIGNUP_ROLES };
