import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import LogHoursModal from "./LogHoursModal";
import intelligenceService from "../../services/intelligenceService";
import contractorTimesheetIntelligenceService from "../../services/contractorTimesheetIntelligenceService";

vi.mock("../../services/intelligenceService", () => ({ default: { getCapabilities: vi.fn() } }));
vi.mock("../../services/contractorTimesheetIntelligenceService", () => ({ default: { analyzeTimesheet: vi.fn() } }));

const capabilities = (enabled) => ({ capabilities: { contractor_timesheet_intelligence: enabled } });
const analysis = { findings: [{ code: "TIMESHEET_FUTURE_DATE", severity: "HIGH", title: "Future date", summary: "Date is future.", evidence: [{ key: "work_date", label: "Work date", value: "2026-09-12" }], recommended_action: "Choose another date.", source: { engine: "contractor_timesheet_intelligence", version: "1" } }] };
const projects = [{ id: 1, name: "Demo Project", start_date: "2026-01-01", end_date: null }];

beforeEach(() => { vi.clearAllMocks(); });
test("keeps the assistant absent and makes no intelligence call when capability is disabled", async () => { intelligenceService.getCapabilities.mockResolvedValue(capabilities(false)); render(<LogHoursModal projects={projects} onClose={vi.fn()} onSubmit={vi.fn()} />); await waitFor(() => expect(intelligenceService.getCapabilities).toHaveBeenCalledOnce()); expect(screen.queryByText("Timesheet Intelligence")).not.toBeInTheDocument(); expect(contractorTimesheetIntelligenceService.analyzeTimesheet).not.toHaveBeenCalled(); });
test("explicitly analyzes form values, clears stale findings on a change, and leaves Save Draft independent", async () => { intelligenceService.getCapabilities.mockResolvedValue(capabilities(true)); contractorTimesheetIntelligenceService.analyzeTimesheet.mockResolvedValue(analysis); const onSubmit = vi.fn(); render(<LogHoursModal projects={projects} onClose={vi.fn()} onSubmit={onSubmit} />); await screen.findByText("Timesheet Intelligence"); fireEvent.change(screen.getByLabelText("Project"), { target: { value: "1" } }); fireEvent.change(screen.getByLabelText("Date Worked"), { target: { value: "2026-09-11" } }); fireEvent.change(screen.getByLabelText("Hours Logged"), { target: { value: "1" } }); fireEvent.click(screen.getByRole("button", { name: "Check before submitting" })); await screen.findByText("Future date"); expect(contractorTimesheetIntelligenceService.analyzeTimesheet).toHaveBeenCalledWith({ projectId: 1, workDate: "2026-09-11", hoursLogged: 1, description: undefined }); expect(onSubmit).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText("Hours Logged"), { target: { value: "2" } }); expect(screen.queryByText("Future date")).not.toBeInTheDocument(); expect(screen.getByText(/Timesheet details changed/)).toBeInTheDocument(); expect(contractorTimesheetIntelligenceService.analyzeTimesheet).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Save Draft" })).toBeEnabled(); });
