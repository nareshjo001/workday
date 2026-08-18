/**
 * Centralized role definitions — mirrors backend/src/constants/roles.js.
 * Never hardcode role strings elsewhere in the frontend.
 */
export const ROLES = Object.freeze({
  VENDOR: "VENDOR",
  CONTRACTOR: "CONTRACTOR",
  PM: "PM",
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

/**
 * Roles selectable on the signup form. CONTRACTOR is deliberately
 * excluded — for MVP, a Contractor account is only ever created by a
 * Vendor (see VendorContractorsPage), never self-registered. Mirrors
 * backend/src/constants/roles.js's SELF_SIGNUP_ROLES, which is the
 * actual enforcement point; this just keeps the UI from offering an
 * option the backend will reject.
 */
export const SELF_SIGNUP_ROLES = Object.freeze([ROLES.VENDOR, ROLES.PM]);

/** Where each role lands after login. */
export const ROLE_HOME_PATH = Object.freeze({
  [ROLES.VENDOR]: "/vendor",
  [ROLES.CONTRACTOR]: "/contractor",
  [ROLES.PM]: "/pm",
});

/** Display copy for role selection UI (signup). */
export const ROLE_META = Object.freeze({
  [ROLES.VENDOR]: {
    label: "Vendor",
    description: "Manage your workforce and contractors",
  },
  [ROLES.CONTRACTOR]: {
    label: "Contractor",
    description: "Track your timesheets and assignments",
  },
  [ROLES.PM]: {
    label: "Project Manager",
    description: "Manage client projects and approvals",
  },
});
