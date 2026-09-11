import { describe, expect, it, vi } from "vitest";
import apiClient from "./apiClient";
import service, { parseProjectControl } from "./pmProjectControlService";

vi.mock("./apiClient", () => ({ default: { get: vi.fn() } }));
const valid = { contract_version: "1", project: { id: 2, name: "Atlas", status: "ACTIVE" }, summary: { attention_count: 1, by_severity: { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 1 } }, findings: [{ code: "TIMESHEETS_AWAITING_REVIEW", severity: "INFO", title: "Review", summary: "One item", evidence: [{ key: "count", label: "Count", value: 1 }], recommended_action: "Review it.", source: { engine: "pm_project_control", version: "1" } }] };
describe("pmProjectControlService", () => {
  it("requests only the project control endpoint and preserves server counts", async () => { apiClient.get.mockResolvedValue({ data: valid }); await expect(service.getProjectControl(2)).resolves.toEqual(valid); expect(apiClient.get).toHaveBeenCalledWith("/pm/projects/2/control-intelligence"); });
  it("fails closed for malformed or inconsistent summaries", () => { expect(() => parseProjectControl({ ...valid, summary: { ...valid.summary, attention_count: 2 } })).toThrow("Invalid project control response."); expect(() => parseProjectControl({ ...valid, findings: [{ ...valid.findings[0], source: { engine: "wrong", version: "1" } }] })).toThrow("Invalid project control response."); });
});
