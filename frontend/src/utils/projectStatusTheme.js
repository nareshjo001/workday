/**
 * Centralized semantic status theme resolver for Project cards and badges.
 * Normalizes status strings (trimming, case-insensitivity, delimiter handling)
 * and maps them to deterministic semantic color palettes and formatted labels.
 *
 * Supported semantic statuses:
 * - PENDING: Amber/warm yellow
 * - ACTIVE / OPEN: Emerald (or blue)
 * - COMPLETED / FILLED / FULLY_STAFFED / STAFFED: Emerald
 * - ON_HOLD: Orange
 * - CANCELLED: Muted red / Rose
 * - REJECTED / BLOCKED: Red
 * - DRAFT: Slate
 * - Unknown: Neutral slate fallback
 */

const STATUS_CONFIGS = {
  PENDING: {
    key: "PENDING",
    defaultLabel: "Pending",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
    dotClass: "bg-amber-500",
  },
  PENDING_STAFFING: {
    key: "PENDING",
    defaultLabel: "Pending Staffing",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
    dotClass: "bg-amber-500",
  },
  ACTIVE: {
    key: "ACTIVE",
    defaultLabel: "Active",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  IN_PROGRESS: {
    key: "ACTIVE",
    defaultLabel: "In Progress",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  OPEN: {
    key: "ACTIVE",
    defaultLabel: "Open",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  FULLY_STAFFED: {
    key: "COMPLETED",
    defaultLabel: "Fully Staffed",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  STAFFED: {
    key: "COMPLETED",
    defaultLabel: "Staffed",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  COMPLETED: {
    key: "COMPLETED",
    defaultLabel: "Completed",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  FILLED: {
    key: "COMPLETED",
    defaultLabel: "Filled",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  ON_HOLD: {
    key: "ON_HOLD",
    defaultLabel: "On Hold",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200/80",
    dotClass: "bg-orange-500",
  },
  CANCELLED: {
    key: "CANCELLED",
    defaultLabel: "Cancelled",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200/80",
    dotClass: "bg-rose-500",
  },
  CANCELED: {
    key: "CANCELLED",
    defaultLabel: "Cancelled",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200/80",
    dotClass: "bg-rose-500",
  },
  REJECTED: {
    key: "REJECTED",
    defaultLabel: "Rejected",
    badgeClass: "bg-red-50 text-red-800 border-red-200/80",
    dotClass: "bg-red-500",
  },
  BLOCKED: {
    key: "REJECTED",
    defaultLabel: "Blocked",
    badgeClass: "bg-red-50 text-red-800 border-red-200/80",
    dotClass: "bg-red-500",
  },
  DRAFT: {
    key: "DRAFT",
    defaultLabel: "Draft",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-500",
  },
};

function formatFallbackLabel(raw) {
  if (!raw) return "Unknown";
  return raw
    .trim()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function resolveProjectStatusTheme(status) {
  if (!status || typeof status !== "string") {
    return {
      key: "UNKNOWN",
      normalizedKey: "UNKNOWN",
      label: "Unknown",
      badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
      dotClass: "bg-slate-400",
    };
  }

  const normalized = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const config = STATUS_CONFIGS[normalized];

  if (config) {
    return {
      key: config.key,
      normalizedKey: normalized,
      label: config.defaultLabel,
      badgeClass: config.badgeClass,
      dotClass: config.dotClass,
    };
  }

  return {
    key: "UNKNOWN",
    normalizedKey: normalized,
    label: formatFallbackLabel(status),
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  };
}
