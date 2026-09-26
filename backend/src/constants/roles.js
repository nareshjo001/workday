// Use these role constants for authorization checks.
const ROLES = Object.freeze({
  VENDOR: "VENDOR",
  CONTRACTOR: "CONTRACTOR",
  PM: "PM",
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

// Contractor accounts require vendor provisioning and cannot self-register.
const SELF_SIGNUP_ROLES = Object.freeze([ROLES.VENDOR, ROLES.PM]);

module.exports = { ROLES, ALL_ROLES, SELF_SIGNUP_ROLES };
