import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import VendorRateIntelligencePanel from "./VendorRateIntelligencePanel";

const available = {
  context: { currency: "USD" }, cost: { rate: 75 },
  proposed_rate: { rate: 155, margin_per_hour: 80, margin_percentage: 51.61 },
  comparables: { scope: "VENDOR_SKILL_CURRENCY", sample_size: 6, median: 150 },
  constraints: { applicable_rate_card: { bill_rate: 120, cost_rate: 75 } },
  recommendation: { status: "AVAILABLE", lower: 140, suggested: 150, upper: 160 },
  findings: [{ code: "PROPOSED_RATE_BELOW_COST", severity: "HIGH", title: "Proposed rate is below cost", summary: "The proposed bill rate is below cost.", evidence: [{ key: "cost", label: "Cost", value: 75, unit: "USD/hour" }], recommended_action: "Review the proposed rate." }],
};
const insufficient = { ...available, comparables: { scope: "VENDOR_SKILL_CURRENCY", sample_size: 2 }, recommendation: { status: "INSUFFICIENT_DATA", lower: null, suggested: null, upper: null }, findings: [] };
const baseProps = { selectedContractorId: 1, projectId: 2, requirementId: 3, proposedRate: "155", onProposedRateChange: vi.fn(), analysis: null, isLoading: false, error: null, onAnalyze: vi.fn() };

test("renders insufficient internal history without a suggested rate", () => {
  render(<VendorRateIntelligencePanel {...baseProps} analysis={{ result: insufficient, stale: false }} />);
  expect(screen.getByText(/Not enough internal historical data/i)).toBeInTheDocument();
  expect(screen.getByText("2")).toBeInTheDocument();
  expect(screen.getAllByText(/\$75\.00/).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Use suggested rate" })).not.toBeInTheDocument();
});

test("renders server-provided recommendation and marks it stale when applied", () => {
  const onProposedRateChange = vi.fn();
  render(<VendorRateIntelligencePanel {...baseProps} onProposedRateChange={onProposedRateChange} analysis={{ result: available, stale: false }} />);
  expect(screen.getByText("Historical median")).toBeInTheDocument();
  expect(screen.getByText("Suggested rate")).toBeInTheDocument();
  expect(screen.getByText(/HIGH — Proposed rate is below cost/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use suggested rate" }));
  expect(onProposedRateChange).toHaveBeenCalledWith("150");
});

test("does not enable analysis without complete commercial context and presents failures as non-blocking", () => {
  render(<VendorRateIntelligencePanel {...baseProps} selectedContractorId={null} error />);
  expect(screen.getByRole("button", { name: "Analyze rate" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(/continue with the normal rate workflow/i);
});
