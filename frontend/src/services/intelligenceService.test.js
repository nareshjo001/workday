import { expect, test, vi } from "vitest";

const get = vi.fn();
vi.mock("./apiClient", () => ({ default: { get } }));

test("requests the role-derived intelligence capability endpoint without client role parameters", async () => {
  const payload = { intelligence_contract_version: "1", capabilities: { vendor_rate_intelligence: false, pm_project_control: false, contractor_timesheet_intelligence: false, ai_explanations: false } };
  get.mockResolvedValue({ data: payload });
  const service = (await import("./intelligenceService.js")).default;
  await expect(service.getCapabilities()).resolves.toEqual(payload);
  expect(get).toHaveBeenCalledWith("/intelligence/capabilities");
});

test("rejects malformed capability payloads instead of treating them as available features", async () => {
  const { parseCapabilities } = await import("./intelligenceService.js");
  expect(() => parseCapabilities({ intelligence_contract_version: "1", capabilities: { vendor_rate_intelligence: true } })).toThrow("Invalid intelligence capability response.");
});
