// Keep frontend role constants aligned with the backend.
export const ROLES = Object.freeze({
  VENDOR: "VENDOR",
  CONTRACTOR: "CONTRACTOR",
  PM: "PM",
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

// Offer only server-permitted signup roles; contractors require vendor provisioning.
export const SELF_SIGNUP_ROLES = Object.freeze([ROLES.VENDOR, ROLES.PM]);

export const ROLE_HOME_PATH = Object.freeze({
  [ROLES.VENDOR]: "/vendor",
  [ROLES.CONTRACTOR]: "/contractor",
  [ROLES.PM]: "/pm",
});

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
