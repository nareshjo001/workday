import React from "react";

/**
 * Activity category enum / constant tokens
 */
export const ACTIVITY_CATEGORIES = Object.freeze({
  INVOICE: "INVOICE",
  PAYMENT: "PAYMENT",
  TIMESHEET: "TIMESHEET",
  ASSIGNMENT: "ASSIGNMENT",
  PROJECT: "PROJECT",
  COMPLIANCE: "COMPLIANCE",
  RATE_CARD: "RATE_CARD",
  CONTRACTOR: "CONTRACTOR",
  UNKNOWN: "UNKNOWN",
});

/**
 * Category-specific SVG icons.
 * Strict enterprise requirement: NO emojis, NO unicode pictograms.
 * Same category = same SVG every time.
 */
export function InvoiceCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function PaymentCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20M7 15h2" />
    </svg>
  );
}

export function TimesheetCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}

export function AssignmentCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function ProjectCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18M8 4v4m8-4v4" />
    </svg>
  );
}

export function ComplianceCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export function RateCardCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a2 2 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V5a2 2 0 012-2z" />
    </svg>
  );
}

export function ContractorCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20v-1a6 6 0 0112 0v1" />
    </svg>
  );
}

export function UnknownCategoryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

/**
 * Static, deterministic category themes.
 * Strict rule: Every category has ONE fixed presentation contract.
 */
export const CATEGORY_THEMES = Object.freeze({
  [ACTIVITY_CATEGORIES.INVOICE]: Object.freeze({
    category: ACTIVITY_CATEGORIES.INVOICE,
    label: "Invoice",
    Icon: InvoiceCategoryIcon,
    bg: "#eff6ff",
    text: "#2563eb",
    border: "#bfdbfe",
    bgClass: "bg-blue-50",
    textClass: "text-blue-600",
    borderClass: "border-blue-100",
  }),
  [ACTIVITY_CATEGORIES.PAYMENT]: Object.freeze({
    category: ACTIVITY_CATEGORIES.PAYMENT,
    label: "Payment",
    Icon: PaymentCategoryIcon,
    bg: "#ecfdf5",
    text: "#059669",
    border: "#a7f3d0",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-600",
    borderClass: "border-emerald-100",
  }),
  [ACTIVITY_CATEGORIES.TIMESHEET]: Object.freeze({
    category: ACTIVITY_CATEGORIES.TIMESHEET,
    label: "Timesheet",
    Icon: TimesheetCategoryIcon,
    bg: "#f5f3ff",
    text: "#7c3aed",
    border: "#ddd6fe",
    bgClass: "bg-violet-50",
    textClass: "text-violet-600",
    borderClass: "border-violet-100",
  }),
  [ACTIVITY_CATEGORIES.ASSIGNMENT]: Object.freeze({
    category: ACTIVITY_CATEGORIES.ASSIGNMENT,
    label: "Assignment",
    Icon: AssignmentCategoryIcon,
    bg: "#fffbeb",
    text: "#d97706",
    border: "#fde68a",
    bgClass: "bg-amber-50",
    textClass: "text-amber-600",
    borderClass: "border-amber-100",
  }),
  [ACTIVITY_CATEGORIES.PROJECT]: Object.freeze({
    category: ACTIVITY_CATEGORIES.PROJECT,
    label: "Project",
    Icon: ProjectCategoryIcon,
    bg: "#eef2ff",
    text: "#4f46e5",
    border: "#c7d2fe",
    bgClass: "bg-indigo-50",
    textClass: "text-indigo-600",
    borderClass: "border-indigo-100",
  }),
  [ACTIVITY_CATEGORIES.COMPLIANCE]: Object.freeze({
    category: ACTIVITY_CATEGORIES.COMPLIANCE,
    label: "Compliance",
    Icon: ComplianceCategoryIcon,
    bg: "#f0fdfa",
    text: "#0d9488",
    border: "#99f6e4",
    bgClass: "bg-teal-50",
    textClass: "text-teal-600",
    borderClass: "border-teal-100",
  }),
  [ACTIVITY_CATEGORIES.RATE_CARD]: Object.freeze({
    category: ACTIVITY_CATEGORIES.RATE_CARD,
    label: "Rate card",
    Icon: RateCardCategoryIcon,
    bg: "#f0f9ff",
    text: "#0284c7",
    border: "#bae6fd",
    bgClass: "bg-sky-50",
    textClass: "text-sky-600",
    borderClass: "border-sky-100",
  }),
  [ACTIVITY_CATEGORIES.CONTRACTOR]: Object.freeze({
    category: ACTIVITY_CATEGORIES.CONTRACTOR,
    label: "Contractor",
    Icon: ContractorCategoryIcon,
    bg: "#fdf4ff",
    text: "#c026d3",
    border: "#f5d0fe",
    bgClass: "bg-fuchsia-50",
    textClass: "text-fuchsia-600",
    borderClass: "border-fuchsia-100",
  }),
  [ACTIVITY_CATEGORIES.UNKNOWN]: Object.freeze({
    category: ACTIVITY_CATEGORIES.UNKNOWN,
    label: "Activity",
    Icon: UnknownCategoryIcon,
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
    bgClass: "bg-slate-100",
    textClass: "text-slate-600",
    borderClass: "border-slate-200",
  }),
});

/**
 * Authoritative mapping from event action codes to category.
 */
const EVENT_CATEGORY_MAP = Object.freeze({
  // Invoice events
  INVOICE_DRAFT_CREATED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_DRAFT_UPDATED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_SUBMITTED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_APPROVED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_REJECTED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_REVISED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_CANCELLED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_ITEM_ADDED: ACTIVITY_CATEGORIES.INVOICE,
  INVOICE_ITEM_REMOVED: ACTIVITY_CATEGORIES.INVOICE,

  // Payment events
  PAYMENT_RECORDED: ACTIVITY_CATEGORIES.PAYMENT,

  // Timesheet events
  TIMESHEET_DRAFT_SAVED: ACTIVITY_CATEGORIES.TIMESHEET,
  TIMESHEET_SUBMITTED: ACTIVITY_CATEGORIES.TIMESHEET,
  TIMESHEET_RESUBMITTED: ACTIVITY_CATEGORIES.TIMESHEET,
  TIMESHEET_REVIEWED: ACTIVITY_CATEGORIES.TIMESHEET,
  TIMESHEET_APPROVED: ACTIVITY_CATEGORIES.TIMESHEET,
  TIMESHEET_REJECTED: ACTIVITY_CATEGORIES.TIMESHEET,

  // Assignment and Candidate events
  ASSIGNMENT_CREATED: ACTIVITY_CATEGORIES.ASSIGNMENT,
  ASSIGNMENT_RELEASED: ACTIVITY_CATEGORIES.ASSIGNMENT,
  ASSIGNMENT_ALLOCATION_CHANGED: ACTIVITY_CATEGORIES.ASSIGNMENT,
  CANDIDATE_SUBMITTED: ACTIVITY_CATEGORIES.ASSIGNMENT,
  CANDIDATE_ACCEPTED: ACTIVITY_CATEGORIES.ASSIGNMENT,
  CANDIDATE_REJECTED: ACTIVITY_CATEGORIES.ASSIGNMENT,
  CANDIDATE_WITHDRAWN: ACTIVITY_CATEGORIES.ASSIGNMENT,

  // Project and Milestone events
  PROJECT_CREATED: ACTIVITY_CATEGORIES.PROJECT,
  PROJECT_UPDATED: ACTIVITY_CATEGORIES.PROJECT,
  PROJECT_COMPLETED: ACTIVITY_CATEGORIES.PROJECT,
  PROJECT_REQUIREMENT_UPDATED: ACTIVITY_CATEGORIES.PROJECT,
  MILESTONE_CREATED: ACTIVITY_CATEGORIES.PROJECT,
  MILESTONE_UPDATED: ACTIVITY_CATEGORIES.PROJECT,
  MILESTONE_MET: ACTIVITY_CATEGORIES.PROJECT,
  PROJECT_VENDOR_GRANTED: ACTIVITY_CATEGORIES.PROJECT,
  PROJECT_VENDOR_REVOKED: ACTIVITY_CATEGORIES.PROJECT,
  VENDOR_CLIENT_CONNECTED: ACTIVITY_CATEGORIES.PROJECT,
  VENDOR_CLIENT_REVOKED: ACTIVITY_CATEGORIES.PROJECT,

  // Compliance & Document events
  CONTRACTOR_DOCUMENT_UPLOADED: ACTIVITY_CATEGORIES.COMPLIANCE,
  CONTRACTOR_DOCUMENT_REVIEWED: ACTIVITY_CATEGORIES.COMPLIANCE,
  CONTRACTOR_DOCUMENT_APPROVED: ACTIVITY_CATEGORIES.COMPLIANCE,
  CONTRACTOR_DOCUMENT_REJECTED: ACTIVITY_CATEGORIES.COMPLIANCE,

  // Rate card events
  RATE_CARD_CREATED: ACTIVITY_CATEGORIES.RATE_CARD,
  RATE_CARD_UPDATED: ACTIVITY_CATEGORIES.RATE_CARD,

  // Contractor events
  CONTRACTOR_CREATED: ACTIVITY_CATEGORIES.CONTRACTOR,
  CONTRACTOR_UPDATED: ACTIVITY_CATEGORIES.CONTRACTOR,
  CONTRACTOR_PROFILE_UPDATED: ACTIVITY_CATEGORIES.CONTRACTOR,
  CONTRACTOR_SKILL_UPDATED: ACTIVITY_CATEGORIES.CONTRACTOR,
});

/**
 * Entity type fallback map
 */
const ENTITY_CATEGORY_MAP = Object.freeze({
  INVOICE: ACTIVITY_CATEGORIES.INVOICE,
  PAYMENT: ACTIVITY_CATEGORIES.PAYMENT,
  TIMESHEET: ACTIVITY_CATEGORIES.TIMESHEET,
  PROJECT_ASSIGNMENT: ACTIVITY_CATEGORIES.ASSIGNMENT,
  CANDIDATE_SUBMISSION: ACTIVITY_CATEGORIES.ASSIGNMENT,
  PROJECT: ACTIVITY_CATEGORIES.PROJECT,
  PROJECT_REQUIREMENT: ACTIVITY_CATEGORIES.PROJECT,
  MILESTONE: ACTIVITY_CATEGORIES.PROJECT,
  CONTRACTOR_DOCUMENT: ACTIVITY_CATEGORIES.COMPLIANCE,
  RATE_CARD: ACTIVITY_CATEGORIES.RATE_CARD,
  CONTRACTOR: ACTIVITY_CATEGORIES.CONTRACTOR,
  CONTRACTOR_UNAVAILABILITY: ACTIVITY_CATEGORIES.CONTRACTOR,
});

/**
 * Resolves the activity category from authoritative event or entity type.
 * @param {object} activity
 * @returns {string} One of ACTIVITY_CATEGORIES values
 */
export function resolveCategory(activity) {
  if (!activity) return ACTIVITY_CATEGORIES.UNKNOWN;

  // 1. Authoritative event code
  const eventKey = String(activity.event || activity.action || "").trim().toUpperCase();
  if (eventKey && Object.prototype.hasOwnProperty.call(EVENT_CATEGORY_MAP, eventKey)) {
    return EVENT_CATEGORY_MAP[eventKey];
  }

  // 2. Keyword check on event string
  if (eventKey.startsWith("INVOICE_")) return ACTIVITY_CATEGORIES.INVOICE;
  if (eventKey.startsWith("PAYMENT_")) return ACTIVITY_CATEGORIES.PAYMENT;
  if (eventKey.startsWith("TIMESHEET_")) return ACTIVITY_CATEGORIES.TIMESHEET;
  if (eventKey.startsWith("ASSIGNMENT_") || eventKey.startsWith("CANDIDATE_")) return ACTIVITY_CATEGORIES.ASSIGNMENT;
  if (eventKey.startsWith("PROJECT_") || eventKey.startsWith("MILESTONE_")) return ACTIVITY_CATEGORIES.PROJECT;
  if (eventKey.includes("DOCUMENT_")) return ACTIVITY_CATEGORIES.COMPLIANCE;
  if (eventKey.startsWith("RATE_CARD_")) return ACTIVITY_CATEGORIES.RATE_CARD;
  if (eventKey.startsWith("CONTRACTOR_")) return ACTIVITY_CATEGORIES.CONTRACTOR;

  // 3. Fallback to entity type
  const entityType = String(activity.entity?.type || activity.entity_type || "").trim().toUpperCase();
  if (entityType && Object.prototype.hasOwnProperty.call(ENTITY_CATEGORY_MAP, entityType)) {
    return ENTITY_CATEGORY_MAP[entityType];
  }

  return ACTIVITY_CATEGORIES.UNKNOWN;
}

/**
 * Returns the deterministic presentation theme for an activity item.
 * @param {object} activity
 * @returns {typeof CATEGORY_THEMES[keyof typeof CATEGORY_THEMES]}
 */
export function getActivityTheme(activity) {
  const category = resolveCategory(activity);
  return CATEGORY_THEMES[category] || CATEGORY_THEMES[ACTIVITY_CATEGORIES.UNKNOWN];
}

/**
 * Formats occurred_at timestamp into clean 2-line desktop format:
 * Date: Sep 14 2026
 * Time: 12:42 PM
 * @param {string|Date} value
 * @returns {{ date: string, time: string }}
 */
export function formatActivityTimestamp(value) {
  if (!value) return { date: "—", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return { date: String(value), time: "" };

  const dateStr = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).replace(/,/g, ""); // "Sep 14 2026"

  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }); // "12:42 PM"

  return { date: dateStr, time: timeStr };
}

/**
 * Checks if a transition value like "40.00 → 40" is semantically meaningless.
 * Requirement 13:
 * "If old/new values are semantically equal after normalization, do NOT show a fake change."
 * @param {any} val
 * @returns {boolean}
 */
export function isMeaninglessChange(val) {
  if (val === null || val === undefined) return false;
  const str = String(val);
  if (!str.includes(" → ")) return false;
  const [fromRaw, toRaw] = str.split(" → ");
  if (fromRaw === undefined || toRaw === undefined) return false;

  const from = fromRaw.trim();
  const to = toRaw.trim();

  // Exact string match
  if (from === to) return true;

  // Numeric equivalence (e.g. 40.00 vs 40, 0.00 vs 0)
  const numFrom = Number(from);
  const numTo = Number(to);
  if (!Number.isNaN(numFrom) && !Number.isNaN(numTo) && numFrom === numTo) {
    return true;
  }

  // Null/empty normalization
  if ((from === "null" || from === "—" || from === "") && (to === "null" || to === "—" || to === "")) {
    return true;
  }

  return false;
}

/**
 * Filters and sanitizes activity details, suppressing meaningless transitions.
 * @param {Array<{ label: string, value: any }>} details
 * @returns {Array<{ label: string, value: any }>}
 */
export function filterMeaningfulDetails(details) {
  if (!Array.isArray(details)) return [];
  return details.filter((d) => {
    if (!d || d.value === null || d.value === undefined || d.value === "") return false;
    if (isMeaninglessChange(d.value)) return false;
    return true;
  });
}

/**
 * Semantic text color helper for status transitions.
 * @param {string} statusText
 * @returns {string} Tailwind text color class
 */
export function getStatusSemanticClass(statusText) {
  const upper = String(statusText || "").trim().toUpperCase();
  if (["APPROVED", "ACTIVE", "COMPLETED", "PAID"].includes(upper)) {
    return "text-emerald-600 font-semibold";
  }
  if (["REJECTED", "CANCELLED", "WITHDRAWN", "OVERDUE"].includes(upper)) {
    return "text-rose-600 font-semibold";
  }
  if (["SUBMITTED", "PENDING", "PARTIALLY_PAID", "RESUBMITTED"].includes(upper)) {
    return "text-blue-600 font-semibold";
  }
  return "text-slate-900 font-medium";
}

export default getActivityTheme;
