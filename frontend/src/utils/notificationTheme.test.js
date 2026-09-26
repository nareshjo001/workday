import { describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_THEMES,
  formatNotificationTimestamp,
  formatSkill,
  formatPaymentMethod,
  formatHours,
  formatCurrencyAmount,
  getNotificationTheme,
  getOutcomeStatus,
  getNotificationContent,
  resolveNotificationCategory,
  resolveNotificationDestination,
} from "./notificationTheme";

describe("notificationTheme", () => {
  it("resolves compliance events to COMPLIANCE category and theme", () => {
    const n = { event_type: "DOCUMENT_EXPIRING", entity_type: "contractor_document" };
    expect(resolveNotificationCategory(n)).toBe(NOTIFICATION_CATEGORIES.COMPLIANCE);
    const theme = getNotificationTheme(n);
    expect(theme).toBe(NOTIFICATION_THEMES.COMPLIANCE);
    expect(theme.category).toBe(NOTIFICATION_CATEGORIES.COMPLIANCE);
    expect(theme.label).toBe("Compliance");
    expect(theme.text).toBe("#0d9488");
  });

  it("resolves invoice events to INVOICE category and same theme", () => {
    const events = ["INVOICE_APPROVED", "INVOICE_REJECTED", "INVOICE_SUBMITTED"];
    for (const event_type of events) {
      const n = { event_type, entity_type: "invoice" };
      expect(resolveNotificationCategory(n)).toBe(NOTIFICATION_CATEGORIES.INVOICE);
      const theme = getNotificationTheme(n);
      expect(theme.category).toBe(NOTIFICATION_CATEGORIES.INVOICE);
      expect(theme.label).toBe("Invoice");
      expect(theme.text).toBe("#2563eb");
    }
  });

  it("resolves candidate and staffing events to STAFFING category", () => {
    const events = ["CANDIDATE_ACCEPTED", "CANDIDATE_REJECTED", "CANDIDATE_SUBMITTED", "ASSIGNMENT_CREATED"];
    for (const event_type of events) {
      const n = { event_type, entity_type: "candidate_submission" };
      expect(resolveNotificationCategory(n)).toBe(NOTIFICATION_CATEGORIES.STAFFING);
      const theme = getNotificationTheme(n);
      expect(theme.category).toBe(NOTIFICATION_CATEGORIES.STAFFING);
      expect(theme.label).toBe("Staffing");
    }
  });

  it("resolves unknown event types to neutral UNKNOWN fallback", () => {
    const n = { event_type: "CUSTOM_FUTURE_EVENT", entity_type: "custom" };
    expect(resolveNotificationCategory(n)).toBe(NOTIFICATION_CATEGORIES.UNKNOWN);
    const theme = getNotificationTheme(n);
    expect(theme.category).toBe(NOTIFICATION_CATEGORIES.UNKNOWN);
    expect(theme.label).toBe("Notification");
    expect(theme.text).toBe("#475569");
  });

  it("uses primary deep_link when valid for role", () => {
    const n = {
      event_type: "DOCUMENT_EXPIRING",
      deep_link: "/vendor/compliance",
    };
    expect(resolveNotificationDestination(n, "vendor")).toBe("/vendor/compliance");

    const n2 = {
      event_type: "INVOICE_APPROVED",
      deep_link: "/vendor/invoices",
    };
    expect(resolveNotificationDestination(n2, "vendor")).toBe("/vendor/invoices");
  });

  it("falls back deterministically when deep_link is missing or malformed for Vendor", () => {
    expect(resolveNotificationDestination({ event_type: "DOCUMENT_EXPIRING" }, "vendor")).toBe("/vendor/compliance");
    expect(resolveNotificationDestination({ event_type: "INVOICE_APPROVED" }, "vendor")).toBe("/vendor/invoices");
    expect(resolveNotificationDestination({ event_type: "INVOICE_REJECTED" }, "vendor")).toBe("/vendor/invoices");
    expect(resolveNotificationDestination({ event_type: "CANDIDATE_ACCEPTED" }, "vendor")).toBe("/vendor/staffing-pipeline");
    expect(resolveNotificationDestination({ event_type: "CANDIDATE_REJECTED" }, "vendor")).toBe("/vendor/staffing-pipeline");

    expect(
      resolveNotificationDestination({ event_type: "INVOICE_APPROVED", deep_link: "/pm/invoices" }, "vendor")
    ).toBe("/vendor/invoices");

    expect(resolveNotificationDestination({ event_type: "FUTURE_EVENT" }, "vendor")).toBe("/vendor/notifications");
  });

  it("extracts secondary status without mutating category theme", () => {
    expect(getOutcomeStatus({ event_type: "INVOICE_APPROVED" })?.label).toBe("Approved");
    expect(getOutcomeStatus({ event_type: "INVOICE_REJECTED" })?.label).toBe("Rejected");
    expect(getOutcomeStatus({ event_type: "CANDIDATE_ACCEPTED" })?.label).toBe("Accepted");
    expect(getOutcomeStatus({ event_type: "DOCUMENT_EXPIRING" })?.label).toBe("Expiring soon");
    expect(getOutcomeStatus({ event_type: "GENERIC_INFO" })).toBeNull();
  });

  it("formats timestamps cleanly into date and time without seconds", () => {
    const ts = "2026-09-11T17:20:29.000Z";
    const formatted = formatNotificationTimestamp(ts);
    expect(formatted.date).toBe("Sep 11 2026");
    expect(formatted.time).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
    expect((formatted.time.match(/:/g) || []).length).toBe(1);
  });

  it("derives compact 3-line content for compliance notifications with context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00.000Z"));

    const n = {
      event_type: "DOCUMENT_EXPIRING",
      entity_type: "contractor_document",
      message: "A required document needs attention soon.",
      context: {
        document_id: 7,
        contractor_id: 5,
        contractor_name: "Avery Frontend",
        document_type: "TAX",
        expiry_date: "2026-09-25",
        status: "VERIFIED",
      },
    };
    try {
      const content = getNotificationContent(n);
      expect(content.title).toBe("Compliance document expiring soon");
      expect(content.contextLine).toBe("Avery Frontend · Tax Document");
      expect(content.detailLine).toContain("Expires Sep 25, 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("gracefully falls back to notification message when context is missing", () => {
    const n = {
      event_type: "DOCUMENT_EXPIRING",
      entity_type: "contractor_document",
      message: "A required document needs attention soon.",
      context: null,
    };
    const content = getNotificationContent(n);
    expect(content.title).toBe("A required document needs attention soon.");
    expect(content.contextLine).toBeNull();
    expect(content.detailLine).toBeNull();
  });

  it("appends contractor and document params when resolving compliance destination", () => {
    const n = {
      event_type: "DOCUMENT_EXPIRING",
      entity_type: "contractor_document",
      deep_link: "/vendor/compliance",
      context: {
        contractor_id: 5,
        document_id: 7,
      },
    };
    expect(resolveNotificationDestination(n, "vendor")).toBe("/vendor/compliance?contractor=5&document=7");
  });

  describe("formatters", () => {
    it("formats skills cleanly into title case labels", () => {
      expect(formatSkill("FRONTEND")).toBe("Frontend");
      expect(formatSkill("BACKEND")).toBe("Backend");
      expect(formatSkill("QA")).toBe("QA");
      expect(formatSkill("DEVOPS")).toBe("DevOps");
      expect(formatSkill("DATA")).toBe("Data");
      expect(formatSkill(null)).toBeNull();
    });

    it("formats payment methods cleanly into human-readable labels", () => {
      expect(formatPaymentMethod("BANK_TRANSFER")).toBe("Bank transfer");
      expect(formatPaymentMethod("CREDIT_CARD")).toBe("Credit card");
      expect(formatPaymentMethod("CHECK")).toBe("Check");
      expect(formatPaymentMethod("ACH")).toBe("ACH");
      expect(formatPaymentMethod(null)).toBeNull();
    });

    it("formats hours cleanly without trailing zeroes", () => {
      expect(formatHours(5)).toBe("5h");
      expect(formatHours("5.00")).toBe("5h");
      expect(formatHours("7.50")).toBe("7.5h");
      expect(formatHours(null)).toBeNull();
    });

    it("formats currency amounts cleanly with two decimal places", () => {
      expect(formatCurrencyAmount(1250, "USD")).toBe("USD 1,250.00");
      expect(formatCurrencyAmount("750.5", "USD")).toBe("USD 750.50");
      expect(formatCurrencyAmount(null)).toBeNull();
    });
  });

  describe("content derivation for all supported event types", () => {
    it("formats invoice notifications cleanly", () => {
      const baseInvoiceContext = {
        invoice_number: "INV-2026-0001",
        project_name: "Atlas Modernization",
        total_amount: 1250,
        currency: "USD",
      };

      const submitted = getNotificationContent({
        event_type: "INVOICE_SUBMITTED",
        entity_type: "invoice",
        context: baseInvoiceContext,
      });
      expect(submitted.title).toBe("Invoice submitted");
      expect(submitted.contextLine).toBe("Atlas Modernization · INV-2026-0001");
      expect(submitted.detailLine).toBe("USD 1,250.00");

      const approved = getNotificationContent({
        event_type: "INVOICE_APPROVED",
        entity_type: "invoice",
        context: baseInvoiceContext,
      });
      expect(approved.title).toBe("Invoice approved");
      expect(approved.contextLine).toBe("Atlas Modernization · INV-2026-0001");
      expect(approved.detailLine).toBe("USD 1,250.00");

      const rejected = getNotificationContent({
        event_type: "INVOICE_REJECTED",
        entity_type: "invoice",
        context: baseInvoiceContext,
      });
      expect(rejected.title).toBe("Invoice rejected");
      expect(rejected.contextLine).toBe("Atlas Modernization · INV-2026-0001");
      expect(rejected.detailLine).toBe("USD 1,250.00");

      const paid = getNotificationContent({
        event_type: "INVOICE_PAID",
        entity_type: "invoice",
        context: baseInvoiceContext,
      });
      expect(paid.title).toBe("Invoice paid");

      const overdue = getNotificationContent({
        event_type: "INVOICE_OVERDUE",
        entity_type: "invoice",
        context: baseInvoiceContext,
      });
      expect(overdue.title).toBe("Invoice overdue");

      const dueSoon = getNotificationContent({
        event_type: "PAYMENT_DUE_SOON",
        entity_type: "invoice",
        context: baseInvoiceContext,
      });
      expect(dueSoon.title).toBe("Payment due soon");
    });

    it("formats payment recorded notifications cleanly", () => {
      const paymentNotification = {
        event_type: "PAYMENT_RECORDED",
        entity_type: "payment",
        context: {
          invoice_number: "INV-2026-0001",
          project_name: "Atlas Modernization",
          amount: 750,
          currency: "USD",
          method: "BANK_TRANSFER",
        },
      };
      const content = getNotificationContent(paymentNotification);
      expect(content.title).toBe("Payment recorded");
      expect(content.contextLine).toBe("INV-2026-0001 · Atlas Modernization");
      expect(content.detailLine).toBe("USD 750.00 · Bank transfer");
    });

    it("formats candidate submission notifications cleanly", () => {
      const candidateContext = {
        contractor_name: "Harper Backend",
        project_name: "Atlas Migration",
        skill: "BACKEND",
      };

      const submitted = getNotificationContent({
        event_type: "CANDIDATE_SUBMITTED",
        entity_type: "candidate_submission",
        context: candidateContext,
      });
      expect(submitted.title).toBe("Candidate submitted");
      expect(submitted.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(submitted.detailLine).toBe("Backend");

      const accepted = getNotificationContent({
        event_type: "CANDIDATE_ACCEPTED",
        entity_type: "candidate_submission",
        context: candidateContext,
      });
      expect(accepted.title).toBe("Candidate accepted");
      expect(accepted.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(accepted.detailLine).toBe("Backend");

      const rejected = getNotificationContent({
        event_type: "CANDIDATE_REJECTED",
        entity_type: "candidate_submission",
        context: candidateContext,
      });
      expect(rejected.title).toBe("Candidate rejected");
      expect(rejected.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(rejected.detailLine).toBe("Backend");
    });

    it("formats project assignment notifications cleanly", () => {
      const assignmentContext = {
        contractor_name: "Harper Backend",
        project_name: "Atlas Migration",
        status: "ACTIVE",
      };

      const created = getNotificationContent({
        event_type: "ASSIGNMENT_CREATED",
        entity_type: "project_assignment",
        context: assignmentContext,
      });
      expect(created.title).toBe("Assignment created");
      expect(created.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(created.detailLine).toBe("Active");

      const released = getNotificationContent({
        event_type: "ASSIGNMENT_RELEASED",
        entity_type: "project_assignment",
        context: assignmentContext,
      });
      expect(released.title).toBe("Assignment released");
      expect(released.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(released.detailLine).toBe("Released");
    });

    it("formats timesheet notifications cleanly", () => {
      const timesheetContext = {
        contractor_name: "Harper Backend",
        project_name: "Atlas Migration",
        hours_logged: 5,
        work_date: "2026-09-14",
      };

      const submitted = getNotificationContent({
        event_type: "TIMESHEET_SUBMITTED",
        entity_type: "timesheet",
        context: timesheetContext,
      });
      expect(submitted.title).toBe("Timesheet submitted");
      expect(submitted.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(submitted.detailLine).toBe("5h submitted");

      const approved = getNotificationContent({
        event_type: "TIMESHEET_APPROVED",
        entity_type: "timesheet",
        context: timesheetContext,
      });
      expect(approved.title).toBe("Timesheet approved");
      expect(approved.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(approved.detailLine).toBe("5h approved");

      const rejected = getNotificationContent({
        event_type: "TIMESHEET_REJECTED",
        entity_type: "timesheet",
        context: timesheetContext,
      });
      expect(rejected.title).toBe("Timesheet rejected");
      expect(rejected.contextLine).toBe("Harper Backend · Atlas Migration");
      expect(rejected.detailLine).toBe("5h rejected");
    });

    it("formats milestone notifications cleanly", () => {
      const milestoneContext = {
        milestone_name: "Warranty Milestone",
        project_name: "Atlas Migration",
        threshold_hours: 5,
      };

      const reached = getNotificationContent({
        event_type: "MILESTONE_MET",
        entity_type: "milestone",
        context: milestoneContext,
      });
      expect(reached.title).toBe("Milestone reached");
      expect(reached.contextLine).toBe("Warranty Milestone · Atlas Migration");
      expect(reached.detailLine).toBe("5h threshold reached");

      const eligible = getNotificationContent({
        event_type: "BILLING_ELIGIBLE",
        entity_type: "milestone",
        context: {
          milestone_name: "Warranty Milestone",
          project_name: "Atlas Migration",
        },
      });
      expect(eligible.title).toBe("Billing eligible");
      expect(eligible.contextLine).toBe("Warranty Milestone · Atlas Migration");
      expect(eligible.detailLine).toBe("Ready for billing");
    });

    it("handles partial context gracefully without printing undefined", () => {
      const partialInvoice = {
        event_type: "INVOICE_APPROVED",
        entity_type: "invoice",
        context: {
          invoice_number: "INV-9999",
        },
      };
      const content = getNotificationContent(partialInvoice);
      expect(content.title).toBe("Invoice approved");
      expect(content.contextLine).toBe("INV-9999");
      expect(content.contextLine).not.toContain("undefined");
      expect(content.detailLine).toBeNull();
    });
  });
});
