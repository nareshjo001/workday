import { expect, test, vi } from "vitest";

const post = vi.fn();
vi.mock("./apiClient", () => ({ default: { post } }));

const available = {
  contract_version: "1",
  context: { contractor: { id: 1 }, project: { id: 2 }, requirement: { id: 3 }, currency: "USD" },
  cost: { rate: 75 }, proposed_rate: { rate: 150, margin_per_hour: 75, margin_percentage: 50 },
  comparables: { scope: "VENDOR_SKILL_CURRENCY", sample_size: 4, median: 150 }, constraints: { applicable_rate_card: null },
  recommendation: { status: "AVAILABLE", lower: 140, suggested: 150, upper: 160 }, findings: [],
};

test("sends only M25 analysis input and returns server-authoritative values", async () => {
  post.mockResolvedValue({ data: available });
  const service = (await import("./vendorRateIntelligenceService.js")).default;
  await expect(service.analyzeRate({ contractorId: 1, projectId: 2, requirementId: 3, proposedBillRate: 150 })).resolves.toEqual(available);
  expect(post).toHaveBeenCalledWith("/vendor/rate-intelligence/analyze", { contractorId: 1, projectId: 2, requirementId: 3, proposedBillRate: 150 });
});

test("fails closed when the M25 response is malformed", async () => {
  const { parseAnalysis } = await import("./vendorRateIntelligenceService.js");
  expect(() => parseAnalysis({ ...available, recommendation: { status: "AVAILABLE" } })).toThrow("Invalid rate intelligence response.");
});

test("fails closed when an insufficient-data response does not carry null recommendation values", async () => {
  const { parseAnalysis } = await import("./vendorRateIntelligenceService.js");
  const insufficient = { ...available, recommendation: { status: "INSUFFICIENT_DATA", lower: null, suggested: 150, upper: null } };
  expect(() => parseAnalysis(insufficient)).toThrow("Invalid rate intelligence response.");
});
