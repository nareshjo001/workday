import { describe, it, expect } from "vitest";
import { resolveProjectStatusTheme } from "./projectStatusTheme";

describe("projectStatusTheme", () => {
  it("normalizes PENDING variants to amber theme", () => {
    const variants = ["pending", "PENDING", " Pending ", "pending_staffing"];
    for (const v of variants) {
      const res = resolveProjectStatusTheme(v);
      expect(res.key).toBe("PENDING");
      expect(res.badgeClass).toContain("bg-amber-50");
      expect(res.badgeClass).toContain("text-amber-800");
      expect(res.dotClass).toBe("bg-amber-500");
      expect(res.label).toMatch(/Pending/i);
    }
  });

  it("normalizes ACTIVE and OPEN to emerald theme", () => {
    const active = resolveProjectStatusTheme("ACTIVE");
    expect(active.key).toBe("ACTIVE");
    expect(active.badgeClass).toContain("bg-emerald-50");
    expect(active.dotClass).toBe("bg-emerald-500");
    expect(active.label).toBe("Active");

    const open = resolveProjectStatusTheme("open");
    expect(open.key).toBe("ACTIVE");
    expect(open.label).toBe("Open");

    const inProgress = resolveProjectStatusTheme("IN_PROGRESS");
    expect(inProgress.key).toBe("ACTIVE");
    expect(inProgress.badgeClass).toContain("bg-emerald-50");
    expect(inProgress.dotClass).toBe("bg-emerald-500");
    expect(inProgress.label).toBe("In Progress");
  });

  it("normalizes COMPLETED, FILLED, FULLY_STAFFED to emerald theme", () => {
    const fullyStaffed = resolveProjectStatusTheme("FULLY_STAFFED");
    expect(fullyStaffed.key).toBe("COMPLETED");
    expect(fullyStaffed.label).toBe("Fully Staffed");
    expect(fullyStaffed.badgeClass).toContain("bg-emerald-50");

    const completed = resolveProjectStatusTheme("completed");
    expect(completed.key).toBe("COMPLETED");
    expect(completed.label).toBe("Completed");

    const filled = resolveProjectStatusTheme("FILLED");
    expect(filled.key).toBe("COMPLETED");
    expect(filled.label).toBe("Filled");
  });

  it("normalizes ON_HOLD to orange theme", () => {
    const onHold = resolveProjectStatusTheme("ON_HOLD");
    expect(onHold.key).toBe("ON_HOLD");
    expect(onHold.badgeClass).toContain("bg-orange-50");
    expect(onHold.badgeClass).toContain("text-orange-800");
    expect(onHold.dotClass).toBe("bg-orange-500");
    expect(onHold.label).toBe("On Hold");

    const onHoldSpaced = resolveProjectStatusTheme("On Hold");
    expect(onHoldSpaced.key).toBe("ON_HOLD");
    expect(onHoldSpaced.label).toBe("On Hold");
  });

  it("normalizes CANCELLED to rose/muted red theme", () => {
    const cancelled = resolveProjectStatusTheme("CANCELLED");
    expect(cancelled.key).toBe("CANCELLED");
    expect(cancelled.badgeClass).toContain("bg-rose-50");
    expect(cancelled.badgeClass).toContain("text-rose-800");
    expect(cancelled.dotClass).toBe("bg-rose-500");
    expect(cancelled.label).toBe("Cancelled");

    const singleL = resolveProjectStatusTheme("Canceled");
    expect(singleL.key).toBe("CANCELLED");
    expect(singleL.label).toBe("Cancelled");
  });

  it("normalizes REJECTED and BLOCKED to red theme", () => {
    const rejected = resolveProjectStatusTheme("REJECTED");
    expect(rejected.key).toBe("REJECTED");
    expect(rejected.badgeClass).toContain("bg-red-50");
    expect(rejected.label).toBe("Rejected");

    const blocked = resolveProjectStatusTheme("blocked");
    expect(blocked.key).toBe("REJECTED");
    expect(blocked.label).toBe("Blocked");
  });

  it("normalizes DRAFT to slate theme", () => {
    const draft = resolveProjectStatusTheme("draft");
    expect(draft.key).toBe("DRAFT");
    expect(draft.badgeClass).toContain("bg-slate-100");
    expect(draft.label).toBe("Draft");
  });

  it("provides neutral slate fallback for unknown statuses", () => {
    const custom = resolveProjectStatusTheme("custom_lifecycle_status");
    expect(custom.key).toBe("UNKNOWN");
    expect(custom.label).toBe("Custom Lifecycle Status");
    expect(custom.badgeClass).toContain("bg-slate-50");
    expect(custom.dotClass).toBe("bg-slate-400");

    const nullStatus = resolveProjectStatusTheme(null);
    expect(nullStatus.key).toBe("UNKNOWN");
    expect(nullStatus.label).toBe("Unknown");

    const emptyStatus = resolveProjectStatusTheme("");
    expect(emptyStatus.key).toBe("UNKNOWN");
    expect(emptyStatus.label).toBe("Unknown");
  });

  it("contains no emoji in labels or classes", () => {
    const statuses = [
      "PENDING",
      "ACTIVE",
      "OPEN",
      "FULLY_STAFFED",
      "COMPLETED",
      "FILLED",
      "ON_HOLD",
      "CANCELLED",
      "REJECTED",
      "DRAFT",
      "UNKNOWN",
    ];
    // Regex checking for common emoji ranges
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const s of statuses) {
      const res = resolveProjectStatusTheme(s);
      expect(emojiRegex.test(res.label)).toBe(false);
      expect(emojiRegex.test(res.badgeClass)).toBe(false);
    }
  });
});
