import React from "react";

export const NOTIFICATION_CATEGORIES = Object.freeze({
  COMPLIANCE: "COMPLIANCE",
  INVOICE: "INVOICE",
  STAFFING: "STAFFING",
  TIMESHEET: "TIMESHEET",
  PAYMENT: "PAYMENT",
  UNKNOWN: "UNKNOWN",
});

export function ComplianceIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

export function InvoiceIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function StaffingIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export function TimesheetIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}

export function PaymentIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7" y1="15" x2="10" y2="15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

export function CheckCheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L7 17l-5-5m16-5l-7.5 7.5L9 13" />
    </svg>
  );
}

export function SettingsIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export const NOTIFICATION_THEMES = Object.freeze({
  [NOTIFICATION_CATEGORIES.COMPLIANCE]: Object.freeze({
    category: NOTIFICATION_CATEGORIES.COMPLIANCE,
    label: "Compliance",
    Icon: ComplianceIcon,
    bg: "#f0fdf4",
    text: "#0d9488",
    border: "#99f6e4",
  }),
  [NOTIFICATION_CATEGORIES.INVOICE]: Object.freeze({
    category: NOTIFICATION_CATEGORIES.INVOICE,
    label: "Invoice",
    Icon: InvoiceIcon,
    bg: "#eff6ff",
    text: "#2563eb",
    border: "#bfdbfe",
  }),
  [NOTIFICATION_CATEGORIES.STAFFING]: Object.freeze({
    category: NOTIFICATION_CATEGORIES.STAFFING,
    label: "Staffing",
    Icon: StaffingIcon,
    bg: "#f5f3ff",
    text: "#7c3aed",
    border: "#ddd6fe",
  }),
  [NOTIFICATION_CATEGORIES.TIMESHEET]: Object.freeze({
    category: NOTIFICATION_CATEGORIES.TIMESHEET,
    label: "Timesheet",
    Icon: TimesheetIcon,
    bg: "#f5f3ff",
    text: "#7c3aed",
    border: "#ddd6fe",
  }),
  [NOTIFICATION_CATEGORIES.PAYMENT]: Object.freeze({
    category: NOTIFICATION_CATEGORIES.PAYMENT,
    label: "Payment",
    Icon: PaymentIcon,
    bg: "#ecfdf5",
    text: "#059669",
    border: "#a7f3d0",
  }),
  [NOTIFICATION_CATEGORIES.UNKNOWN]: Object.freeze({
    category: NOTIFICATION_CATEGORIES.UNKNOWN,
    label: "Notification",
    Icon: BellIcon,
    bg: "#f8fafc",
    text: "#475569",
    border: "#e2e8f0",
  }),
});

// Resolve categories from event and entity types, never notification message text.
export function resolveNotificationCategory(notification) {
  if (!notification) return NOTIFICATION_CATEGORIES.UNKNOWN;
  const event = String(notification.event_type || "").toUpperCase();
  const entity = String(notification.entity_type || "").toLowerCase();

  if (event === "DOCUMENT_EXPIRING" || entity === "contractor_document") {
    return NOTIFICATION_CATEGORIES.COMPLIANCE;
  }
  if (
    event.startsWith("INVOICE_") ||
    event === "PAYMENT_DUE_SOON" ||
    event === "MILESTONE_MET" ||
    event === "BILLING_ELIGIBLE" ||
    entity === "invoice" ||
    entity === "milestone"
  ) {
    return NOTIFICATION_CATEGORIES.INVOICE;
  }
  if (
    event.startsWith("CANDIDATE_") ||
    event.startsWith("ASSIGNMENT_") ||
    entity === "candidate_submission" ||
    entity === "project_assignment"
  ) {
    return NOTIFICATION_CATEGORIES.STAFFING;
  }
  if (event.startsWith("TIMESHEET_") || entity === "timesheet") {
    return NOTIFICATION_CATEGORIES.TIMESHEET;
  }
  if (event.startsWith("PAYMENT_") || entity === "payment") {
    return NOTIFICATION_CATEGORIES.PAYMENT;
  }

  return NOTIFICATION_CATEGORIES.UNKNOWN;
}

export function getNotificationTheme(notification) {
  const category = resolveNotificationCategory(notification);
  return NOTIFICATION_THEMES[category] || NOTIFICATION_THEMES.UNKNOWN;
}

// Derive outcome badges without changing the category icon or base theme.
export function getOutcomeStatus(notification) {
  if (!notification) return null;
  const event = String(notification.event_type || "").toUpperCase();

  if (event.includes("APPROVED") || event.includes("ACCEPTED")) {
    return {
      label: event.includes("ACCEPTED") ? "Accepted" : "Approved",
      colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    };
  }
  if (event.includes("REJECTED")) {
    return {
      label: "Rejected",
      colorClass: "text-rose-700 bg-rose-50 border-rose-200",
    };
  }
  if (event.includes("EXPIRING")) {
    return {
      label: "Expiring soon",
      colorClass: "text-amber-700 bg-amber-50 border-amber-200",
    };
  }
  if (event.includes("OVERDUE")) {
    return {
      label: "Overdue",
      colorClass: "text-rose-700 bg-rose-50 border-rose-200",
    };
  }
  return null;
}

export function formatDocumentType(docType) {
  if (!docType) return "Document";
  const str = String(docType).toUpperCase();
  if (str === "IDENTITY") return "Identity Document";
  if (str === "TAX") return "Tax Document";
  if (str === "QUALIFICATION") return "Qualification Document";
  return str.charAt(0) + str.slice(1).toLowerCase().replaceAll("_", " ") + " Document";
}

export function formatSkill(skill) {
  if (!skill) return null;
  const s = String(skill).toUpperCase().trim();
  switch (s) {
    case "FRONTEND": return "Frontend";
    case "BACKEND": return "Backend";
    case "QA": return "QA";
    case "DEVOPS": return "DevOps";
    case "DATA": return "Data";
    default:
      return s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");
  }
}

export function formatPaymentMethod(method) {
  if (!method) return null;
  const m = String(method).toUpperCase().trim();
  switch (m) {
    case "BANK_TRANSFER": return "Bank transfer";
    case "CREDIT_CARD": return "Credit card";
    case "CHECK": return "Check";
    case "ACH": return "ACH";
    case "WIRE": return "Wire transfer";
    case "MANUAL": return "Manual";
    default:
      return m.charAt(0) + m.slice(1).toLowerCase().replaceAll("_", " ");
  }
}

export function formatHours(hours) {
  if (hours == null || hours === "") return null;
  const num = Number(hours);
  if (Number.isNaN(num)) return `${hours}h`;
  return `${Number(num.toFixed(2))}h`;
}

export function formatCurrencyAmount(amount, currency = "USD") {
  if (amount == null || amount === "") return null;
  const num = Number(amount);
  if (Number.isNaN(num)) return `${currency || "USD"} ${amount}`;
  return `${currency || "USD"} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Compare document expiry against the current UTC date.
export function formatExpiryDetails(expiryDate) {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return { isExpired: false, text: `Expires ${expiryDate}` };

  const formattedDate = exp.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  const diffDays = Math.round((expUtc - todayUtc) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const pastDays = Math.abs(diffDays);
    return {
      isExpired: true,
      text: `Expired ${formattedDate} (${pastDays} day${pastDays === 1 ? "" : "s"} ago)`,
    };
  }
  if (diffDays === 0) {
    return {
      isExpired: false,
      text: "Expires today",
    };
  }
  return {
    isExpired: false,
    text: `Expires ${formattedDate} · ${diffDays} day${diffDays === 1 ? "" : "s"} remaining`,
  };
}

// Build notification content from a headline, entity context, and one useful detail.
export function getNotificationContent(notification) {
  if (!notification) {
    return { title: "", contextLine: null, detailLine: null };
  }

  const context = notification.context;
  const event = String(notification.event_type || "").toUpperCase();
  const entity = String(notification.entity_type || "").toLowerCase();

  // If no structured context, fall back gracefully to notification message
  if (!context || Object.keys(context).length === 0) {
    return {
      title: notification.message || "Notification",
      contextLine: null,
      detailLine: null,
    };
  }

  if (event === "DOCUMENT_EXPIRING" || entity === "contractor_document") {
    if (context.contractor_name || context.document_type || context.expiry_date) {
      const expiry = formatExpiryDetails(context.expiry_date);
      const isExpired = expiry?.isExpired || false;
      const title = isExpired ? "Compliance document expired" : "Compliance document expiring soon";

      const parts = [];
      if (context.contractor_name) parts.push(context.contractor_name);
      if (context.document_type) parts.push(formatDocumentType(context.document_type));
      const contextLine = parts.length > 0 ? parts.join(" · ") : null;
      const detailLine = expiry ? expiry.text : null;

      return { title, contextLine, detailLine };
    }
  }

  if (event.startsWith("INVOICE_") || event === "PAYMENT_DUE_SOON" || entity === "invoice") {
    let title;
    switch (event) {
      case "INVOICE_SUBMITTED":
        title = "Invoice submitted";
        break;
      case "INVOICE_APPROVED":
        title = "Invoice approved";
        break;
      case "INVOICE_REJECTED":
        title = "Invoice rejected";
        break;
      case "INVOICE_PAID":
        title = "Invoice paid";
        break;
      case "INVOICE_OVERDUE":
        title = "Invoice overdue";
        break;
      case "PAYMENT_DUE_SOON":
        title = "Payment due soon";
        break;
      default:
        title = notification.message || "Invoice update";
        break;
    }

    const parts = [];
    if (context.project_name) parts.push(context.project_name);
    if (context.invoice_number) parts.push(context.invoice_number);
    const contextLine = parts.length > 0 ? parts.join(" · ") : null;

    const detailLine = context.total_amount != null
      ? formatCurrencyAmount(context.total_amount, context.currency)
      : null;

    return { title, contextLine, detailLine };
  }

  if (event.startsWith("PAYMENT_") || entity === "payment") {
    const title = event === "PAYMENT_RECORDED" ? "Payment recorded" : notification.message || "Payment update";
    const parts = [];
    if (context.invoice_number) parts.push(context.invoice_number);
    if (context.project_name) parts.push(context.project_name);
    const contextLine = parts.length > 0 ? parts.join(" · ") : null;

    const detailParts = [];
    if (context.amount != null) {
      detailParts.push(formatCurrencyAmount(context.amount, context.currency));
    }
    const methodStr = formatPaymentMethod(context.method || context.payment_method);
    if (methodStr) {
      detailParts.push(methodStr);
    }
    const detailLine = detailParts.length > 0 ? detailParts.join(" · ") : null;

    return { title, contextLine, detailLine };
  }

  if (event.startsWith("CANDIDATE_") || entity === "candidate_submission") {
    let title;
    switch (event) {
      case "CANDIDATE_SUBMITTED":
        title = "Candidate submitted";
        break;
      case "CANDIDATE_ACCEPTED":
        title = "Candidate accepted";
        break;
      case "CANDIDATE_REJECTED":
        title = "Candidate rejected";
        break;
      default:
        title = notification.message || "Candidate update";
        break;
    }

    const parts = [];
    if (context.contractor_name) parts.push(context.contractor_name);
    if (context.project_name) parts.push(context.project_name);
    const contextLine = parts.length > 0 ? parts.join(" · ") : null;
    const detailLine = formatSkill(context.skill);

    return { title, contextLine, detailLine };
  }

  if (event.startsWith("ASSIGNMENT_") || entity === "project_assignment") {
    const title = event === "ASSIGNMENT_RELEASED" ? "Assignment released" : "Assignment created";
    const parts = [];
    if (context.contractor_name) parts.push(context.contractor_name);
    if (context.project_name) parts.push(context.project_name);
    const contextLine = parts.length > 0 ? parts.join(" · ") : null;
    const detailLine = event === "ASSIGNMENT_RELEASED" ? "Released" : "Active";

    return { title, contextLine, detailLine };
  }

  if (event.startsWith("TIMESHEET_") || entity === "timesheet") {
    let title;
    let actionWord;
    switch (event) {
      case "TIMESHEET_SUBMITTED":
        title = "Timesheet submitted";
        actionWord = "submitted";
        break;
      case "TIMESHEET_APPROVED":
        title = "Timesheet approved";
        actionWord = "approved";
        break;
      case "TIMESHEET_REJECTED":
        title = "Timesheet rejected";
        actionWord = "rejected";
        break;
      default:
        title = notification.message || "Timesheet update";
        actionWord = "logged";
        break;
    }

    const parts = [];
    if (context.contractor_name) parts.push(context.contractor_name);
    if (context.project_name) parts.push(context.project_name);
    const contextLine = parts.length > 0 ? parts.join(" · ") : null;

    let detailLine = null;
    const hrs = formatHours(context.hours_logged);
    if (hrs) {
      detailLine = `${hrs} ${actionWord}`;
    }

    return { title, contextLine, detailLine };
  }

  if (event === "MILESTONE_MET" || event === "BILLING_ELIGIBLE" || entity === "milestone") {
    const title = event === "BILLING_ELIGIBLE" ? "Billing eligible" : "Milestone reached";
    const parts = [];
    if (context.milestone_name) parts.push(context.milestone_name);
    if (context.project_name) parts.push(context.project_name);
    const contextLine = parts.length > 0 ? parts.join(" · ") : null;

    const hrs = formatHours(context.threshold_hours);
    const detailLine = hrs ? `${hrs} threshold reached` : "Ready for billing";

    return { title, contextLine, detailLine };
  }

  return {
    title: notification.message || "Notification",
    contextLine: null,
    detailLine: null,
  };
}

// Prefer role-valid server deep links, then fall back to event or entity destinations.
export function resolveNotificationDestination(notification, role = "vendor") {
  const deepLink = notification?.deep_link;
  const rolePrefix = `/${role}/`;

  if (typeof deepLink === "string" && deepLink.startsWith(rolePrefix)) {
    if (
      role === "vendor" &&
      notification?.context?.contractor_id &&
      deepLink.startsWith("/vendor/compliance") &&
      !deepLink.includes("contractor=")
    ) {
      const docParam = notification.context.document_id ? `&document=${notification.context.document_id}` : "";
      return `/vendor/compliance?contractor=${notification.context.contractor_id}${docParam}`;
    }
    return deepLink;
  }

  const category = resolveNotificationCategory(notification);

  if (role === "vendor") {
    switch (category) {
      case NOTIFICATION_CATEGORIES.COMPLIANCE: {
        const contractorId = notification?.context?.contractor_id;
        const documentId = notification?.context?.document_id || notification?.entity_id;
        if (contractorId) {
          return `/vendor/compliance?contractor=${contractorId}${documentId ? `&document=${documentId}` : ""}`;
        }
        return "/vendor/compliance";
      }
      case NOTIFICATION_CATEGORIES.INVOICE:
      case NOTIFICATION_CATEGORIES.PAYMENT:
        return "/vendor/invoices";
      case NOTIFICATION_CATEGORIES.STAFFING:
        return "/vendor/staffing-pipeline";
      default:
        return "/vendor/notifications";
    }
  }

  if (role === "pm") {
    switch (category) {
      case NOTIFICATION_CATEGORIES.INVOICE:
      case NOTIFICATION_CATEGORIES.PAYMENT:
        return "/pm/invoices";
      case NOTIFICATION_CATEGORIES.STAFFING:
        return "/pm/staffing-pipeline";
      case NOTIFICATION_CATEGORIES.TIMESHEET:
        return "/pm/timesheets";
      default:
        return "/pm/notifications";
    }
  }

  if (role === "contractor") {
    switch (category) {
      case NOTIFICATION_CATEGORIES.TIMESHEET:
        return "/contractor/timesheets";
      case NOTIFICATION_CATEGORIES.STAFFING:
        return "/contractor/projects";
      default:
        return "/contractor/notifications";
    }
  }

  return `/${role}/notifications`;
}

// Format notification timestamps as separate date and time labels without seconds.
export function formatNotificationTimestamp(value) {
  if (!value) return { date: "—", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: String(value), time: "" };

  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).replace(/,/g, "");

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { date, time };
}

const notificationTheme = {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_THEMES,
  resolveNotificationCategory,
  getNotificationTheme,
  getOutcomeStatus,
  getNotificationContent,
  formatDocumentType,
  formatSkill,
  formatPaymentMethod,
  formatHours,
  formatCurrencyAmount,
  formatExpiryDetails,
  resolveNotificationDestination,
  formatNotificationTimestamp,
};

export default notificationTheme;
