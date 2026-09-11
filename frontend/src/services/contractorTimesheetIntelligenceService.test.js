import { describe, expect, it, vi } from "vitest";
import apiClient from "./apiClient";
import service, { parseTimesheetAnalysis } from "./contractorTimesheetIntelligenceService";

vi.mock("./apiClient", () => ({ default: { post: vi.fn() } }));
const valid = { contract_version: "1", context: { assignment_id: 1, project: { id: 2, name: "Demo" }, work_date: "2026-09-11", hours: 1 }, summary: { finding_count: 1, by_severity: { HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 } }, findings: [{ code: "TIMESHEET_FUTURE_DATE", severity: "HIGH", title: "Future date", summary: "Future", evidence: [{ key: "work_date", label: "Work date", value: "2026-09-12" }], recommended_action: "Choose a valid date.", source: { engine: "contractor_timesheet_intelligence", version: "1" } }] };
describe("contractorTimesheetIntelligenceService", () => {
  it("sends only M29 proposal fields and preserves the server response", async () => { apiClient.post.mockResolvedValue({ data: valid }); await expect(service.analyzeTimesheet({ projectId: 2, workDate: "2026-09-11", hoursLogged: 1 })).resolves.toEqual(valid); expect(apiClient.post).toHaveBeenCalledWith("/contractor/timesheet-intelligence/analyze", { projectId: 2, workDate: "2026-09-11", hoursLogged: 1 }); });
  it("fails closed for malformed findings", () => { expect(() => parseTimesheetAnalysis({ ...valid, findings: [{ ...valid.findings[0], source: { engine: "wrong", version: "1" } }] })).toThrow("Invalid timesheet intelligence response."); });
});
