import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import AssignContractorModal from "./AssignContractorModal";

const { getCapabilities, analyzeRate } = vi.hoisted(() => ({ getCapabilities: vi.fn(), analyzeRate: vi.fn() }));
vi.mock("../../services/intelligenceService", () => ({ default: { getCapabilities } }));
vi.mock("../../services/vendorRateIntelligenceService", () => ({ default: { analyzeRate } }));

const project = { id: 2, name: "Project", company_name: "Client", start_date: "2026-01-01", end_date: "2026-12-31" };
const requirement = { id: 3, skill: "BACKEND", required_count: 1, assigned_count: 0 };
const contractors = [{ id: 1, name: "Taylor", email: "taylor@example.test" }];
const capabilities = (enabled) => ({ intelligence_contract_version: "1", capabilities: { vendor_rate_intelligence: enabled, pm_project_control: false, contractor_timesheet_intelligence: false, ai_explanations: false } });

beforeEach(() => { vi.clearAllMocks(); });

test("hides intelligence and never analyzes when the Vendor capability is disabled", async () => {
  getCapabilities.mockResolvedValue(capabilities(false));
  render(<AssignContractorModal project={project} requirement={requirement} contractors={contractors} isLoading={false} loadError={null} onClose={vi.fn()} onAssign={vi.fn()} />);
  await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
  expect(screen.queryByText("Rate Intelligence")).not.toBeInTheDocument();
  expect(analyzeRate).not.toHaveBeenCalled();
});

test("analyzes only one selected contractor with server-required identifiers and proposed rate", async () => {
  getCapabilities.mockResolvedValue(capabilities(true));
  analyzeRate.mockResolvedValue({ context: { currency: "USD" }, cost: { rate: 75 }, proposed_rate: { rate: 150, margin_per_hour: 75, margin_percentage: 50 }, comparables: { scope: "VENDOR_SKILL_CURRENCY", sample_size: 2 }, constraints: { applicable_rate_card: null }, recommendation: { status: "INSUFFICIENT_DATA" }, findings: [] });
  render(<AssignContractorModal project={project} requirement={requirement} contractors={contractors} isLoading={false} loadError={null} onClose={vi.fn()} onAssign={vi.fn()} />);
  await screen.findByText("Rate Intelligence");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Proposed bill rate"), { target: { value: "150" } });
  fireEvent.click(screen.getByRole("button", { name: "Analyze rate" }));
  await waitFor(() => expect(analyzeRate).toHaveBeenCalledWith({ contractorId: 1, projectId: 2, requirementId: 3, proposedBillRate: 150 }));
});

test("clears server values after a proposed-rate edit and only refreshes on explicit re-analysis", async () => {
  getCapabilities.mockResolvedValue(capabilities(true));
  const response = (rate, margin) => ({
    context: { currency: "USD" }, cost: { rate: 75 },
    proposed_rate: { rate, margin_per_hour: margin, margin_percentage: 50 },
    comparables: { scope: "VENDOR_SKILL_CURRENCY", sample_size: 4, median: 150 },
    constraints: { applicable_rate_card: null },
    recommendation: { status: "AVAILABLE", lower: 140, suggested: 150, upper: 160 }, findings: [],
  });
  analyzeRate.mockResolvedValueOnce(response(150, 75)).mockResolvedValueOnce(response(170, 95));
  render(<AssignContractorModal project={project} requirement={requirement} contractors={contractors} isLoading={false} loadError={null} onClose={vi.fn()} onAssign={vi.fn()} />);
  await screen.findByText("Rate Intelligence");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Proposed bill rate"), { target: { value: "150" } });
  fireEvent.click(screen.getByRole("button", { name: "Analyze rate" }));
  await screen.findByText("Margin per hour");
  expect(analyzeRate).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("Proposed bill rate"), { target: { value: "170" } });
  expect(screen.getByText("Proposed rate changed. Re-analyze to refresh Rate Intelligence.")).toBeInTheDocument();
  expect(screen.queryByText("Margin per hour")).not.toBeInTheDocument();
  expect(screen.queryByText("Suggested rate")).not.toBeInTheDocument();
  expect(analyzeRate).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Re-analyze rate" }));
  await waitFor(() => expect(analyzeRate).toHaveBeenLastCalledWith({ contractorId: 1, projectId: 2, requirementId: 3, proposedBillRate: 170 }));
  await screen.findByText("Margin per hour");
  expect(screen.getByText("$95.00")).toBeInTheDocument();
});
