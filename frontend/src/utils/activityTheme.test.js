import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CATEGORIES,
  CATEGORY_THEMES,
  filterMeaningfulDetails,
  formatActivityTimestamp,
  getActivityTheme,
  getStatusSemanticClass,
  isMeaninglessChange,
  resolveCategory,
} from "./activityTheme";

describe("activityTheme", () => {
  it("resolves all invoice events to INVOICE theme and same icon", () => {
    const invoiceEvents = [
      "INVOICE_DRAFT_CREATED",
      "INVOICE_DRAFT_UPDATED",
      "INVOICE_SUBMITTED",
      "INVOICE_APPROVED",
      "INVOICE_REJECTED",
      "INVOICE_REVISED",
      "INVOICE_CANCELLED",
      "INVOICE_ITEM_ADDED",
      "INVOICE_ITEM_REMOVED",
    ];

    for (const event of invoiceEvents) {
      expect(resolveCategory({ event, entity: { type: "INVOICE", id: "1" } })).toBe(ACTIVITY_CATEGORIES.INVOICE);
      const theme = getActivityTheme({ event, entity: { type: "INVOICE", id: "1" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.INVOICE);
      expect(theme.Icon).toBe(CATEGORY_THEMES.INVOICE.Icon);
      expect(theme.bg).toBe(CATEGORY_THEMES.INVOICE.bg);
      expect(theme.text).toBe(CATEGORY_THEMES.INVOICE.text);
    }
  });

  it("resolves payment activities to PAYMENT theme", () => {
    const theme = getActivityTheme({ event: "PAYMENT_RECORDED", entity: { type: "PAYMENT", id: "2" } });
    expect(theme.category).toBe(ACTIVITY_CATEGORIES.PAYMENT);
    expect(theme.Icon).toBe(CATEGORY_THEMES.PAYMENT.Icon);
    expect(theme.text).toBe("#059669");
  });

  it("resolves timesheet activities to TIMESHEET theme", () => {
    const timesheetEvents = [
      "TIMESHEET_DRAFT_SAVED",
      "TIMESHEET_SUBMITTED",
      "TIMESHEET_RESUBMITTED",
      "TIMESHEET_REVIEWED",
      "TIMESHEET_APPROVED",
      "TIMESHEET_REJECTED",
    ];
    for (const event of timesheetEvents) {
      const theme = getActivityTheme({ event, entity: { type: "TIMESHEET", id: "3" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.TIMESHEET);
      expect(theme.Icon).toBe(CATEGORY_THEMES.TIMESHEET.Icon);
      expect(theme.text).toBe("#7c3aed");
    }
  });

  it("resolves assignment and candidate activities to ASSIGNMENT theme", () => {
    const assignmentEvents = [
      "ASSIGNMENT_CREATED",
      "ASSIGNMENT_RELEASED",
      "ASSIGNMENT_ALLOCATION_CHANGED",
      "CANDIDATE_SUBMITTED",
      "CANDIDATE_ACCEPTED",
      "CANDIDATE_REJECTED",
      "CANDIDATE_WITHDRAWN",
    ];
    for (const event of assignmentEvents) {
      const theme = getActivityTheme({ event, entity: { type: "PROJECT_ASSIGNMENT", id: "4" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.ASSIGNMENT);
      expect(theme.Icon).toBe(CATEGORY_THEMES.ASSIGNMENT.Icon);
      expect(theme.text).toBe("#d97706");
    }
  });

  it("resolves project and milestone activities to PROJECT theme", () => {
    const projectEvents = [
      "PROJECT_CREATED",
      "PROJECT_UPDATED",
      "PROJECT_COMPLETED",
      "PROJECT_REQUIREMENT_UPDATED",
      "MILESTONE_CREATED",
      "MILESTONE_UPDATED",
      "MILESTONE_MET",
      "PROJECT_VENDOR_GRANTED",
      "PROJECT_VENDOR_REVOKED",
      "VENDOR_CLIENT_CONNECTED",
      "VENDOR_CLIENT_REVOKED",
    ];
    for (const event of projectEvents) {
      const theme = getActivityTheme({ event, entity: { type: "PROJECT", id: "5" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.PROJECT);
      expect(theme.Icon).toBe(CATEGORY_THEMES.PROJECT.Icon);
      expect(theme.text).toBe("#4f46e5");
    }
  });

  it("resolves contractor document events to COMPLIANCE theme", () => {
    const complianceEvents = [
      "CONTRACTOR_DOCUMENT_UPLOADED",
      "CONTRACTOR_DOCUMENT_REVIEWED",
      "CONTRACTOR_DOCUMENT_APPROVED",
      "CONTRACTOR_DOCUMENT_REJECTED",
    ];
    for (const event of complianceEvents) {
      const theme = getActivityTheme({ event, entity: { type: "CONTRACTOR_DOCUMENT", id: "6" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.COMPLIANCE);
      expect(theme.Icon).toBe(CATEGORY_THEMES.COMPLIANCE.Icon);
      expect(theme.text).toBe("#0d9488");
    }
  });

  it("resolves rate card events to RATE_CARD theme", () => {
    const rateCardEvents = ["RATE_CARD_CREATED", "RATE_CARD_UPDATED"];
    for (const event of rateCardEvents) {
      const theme = getActivityTheme({ event, entity: { type: "RATE_CARD", id: "7" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.RATE_CARD);
      expect(theme.Icon).toBe(CATEGORY_THEMES.RATE_CARD.Icon);
      expect(theme.text).toBe("#0284c7");
    }
  });

  it("resolves contractor profile events to CONTRACTOR theme", () => {
    const contractorEvents = [
      "CONTRACTOR_CREATED",
      "CONTRACTOR_UPDATED",
      "CONTRACTOR_PROFILE_UPDATED",
      "CONTRACTOR_SKILL_UPDATED",
    ];
    for (const event of contractorEvents) {
      const theme = getActivityTheme({ event, entity: { type: "CONTRACTOR", id: "8" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.CONTRACTOR);
      expect(theme.Icon).toBe(CATEGORY_THEMES.CONTRACTOR.Icon);
      expect(theme.text).toBe("#c026d3");
    }
  });

  it("safely falls back to neutral UNKNOWN theme for unknown and legacy events without errors", () => {
    const unknownEvents = [
      "LEGACY_BUSINESS_EVENT",
      "UNKNOWN_CUSTOM_EVENT",
      "FUTURE_SYSTEM_INTEGRATION_TRIGGERED",
      null,
      undefined,
      "",
    ];

    for (const event of unknownEvents) {
      const theme = getActivityTheme({ event, entity: { type: "UNKNOWN_ENTITY", id: "9" } });
      expect(theme.category).toBe(ACTIVITY_CATEGORIES.UNKNOWN);
      expect(theme.Icon).toBe(CATEGORY_THEMES.UNKNOWN.Icon);
      expect(theme.text).toBe("#475569");
      expect(theme.bg).toBe("#f1f5f9");
    }
  });

  it("contains zero emojis across all category labels and theme definitions", () => {
    const emojiRegex = /\p{Extended_Pictographic}/u;
    for (const theme of Object.values(CATEGORY_THEMES)) {
      expect(emojiRegex.test(theme.label)).toBe(false);
      expect(emojiRegex.test(theme.category)).toBe(false);
    }
  });

  it("formats activity timestamp into clean 2-line date and time", () => {
    const ts = formatActivityTimestamp("2026-09-14T12:42:00.000Z");
    expect(ts.date).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}\s\d{4}$/);
    expect(ts.time).toMatch(/^\d{1,2}:\d{2}\s(?:AM|PM)$/);

    const empty = formatActivityTimestamp(null);
    expect(empty.date).toBe("—");
    expect(empty.time).toBe("");
  });

  it("correctly identifies and suppresses meaningless change lines (e.g. 40.00 -> 40)", () => {
    expect(isMeaninglessChange("40.00 → 40")).toBe(true);
    expect(isMeaninglessChange("40 → 40")).toBe(true);
    expect(isMeaninglessChange("0.00 → 0")).toBe(true);
    expect(isMeaninglessChange("true → true")).toBe(true);
    expect(isMeaninglessChange("null → —")).toBe(true);

    expect(isMeaninglessChange("DRAFT → SUBMITTED")).toBe(false);
    expect(isMeaninglessChange("SUBMITTED → APPROVED")).toBe(false);
    expect(isMeaninglessChange("40 → 35")).toBe(false);
    expect(isMeaninglessChange(8)).toBe(false);
  });

  it("filters details array removing meaningless changes while keeping legitimate details", () => {
    const details = [
      { label: "Status", value: "DRAFT → SUBMITTED" },
      { label: "Allocated hours", value: "40.00 → 40" },
      { label: "Hours", value: 8 },
      { label: "Empty detail", value: null },
    ];

    const filtered = filterMeaningfulDetails(details);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toEqual({ label: "Status", value: "DRAFT → SUBMITTED" });
    expect(filtered[1]).toEqual({ label: "Hours", value: 8 });
  });

  it("applies semantic text classes for status values", () => {
    expect(getStatusSemanticClass("APPROVED")).toContain("text-emerald-600");
    expect(getStatusSemanticClass("REJECTED")).toContain("text-rose-600");
    expect(getStatusSemanticClass("SUBMITTED")).toContain("text-blue-600");
    expect(getStatusSemanticClass("OTHER")).toContain("text-slate-900");
  });

  it("is completely deterministic: identical category always returns identical theme regardless of content or id", () => {
    const act1 = { id: 101, event: "INVOICE_SUBMITTED", title: "Invoice submitted", summary: "First" };
    const act2 = { id: 999, event: "INVOICE_REJECTED", title: "Invoice rejected", summary: "Second" };

    const theme1 = getActivityTheme(act1);
    const theme2 = getActivityTheme(act2);

    expect(theme1).toBe(theme2);
    expect(theme1.Icon).toBe(theme2.Icon);
    expect(theme1.bg).toBe(theme2.bg);
    expect(theme1.text).toBe(theme2.text);
  });
});
