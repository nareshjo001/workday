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

module.exports = { ROLES, ALL_ROLES };
