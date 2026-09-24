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

const sampleProject = {
  id: 10,
  name: "Atlas Commerce Modernization",
  company_name: "Atlas Commerce",
  pm_name: "Demo PM — Atlas",
  start_date: "2026-07-01",
  end_date: "2026-12-31",
};

const sampleRequirement = {
  id: 20,
  skill: "BACKEND",
  required_count: 2,
  assigned_count: 1,
};

const sampleContractors = [
  { id: 101, name: "Demo Candidate", email: "demo.candidate@example.com" },
  { id: 102, name: "Reese Rejected", email: "reese.rejected@example.com" },
  { id: 103, name: "Taylor Review Queue", email: "taylor.review@example.com" },
];

test("1. renders dynamic role title and subtitle", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByRole("heading", { level: 2, name: "Assign Backend Contractors" })).toBeInTheDocument();
  expect(screen.getByText(/Assign contractors to work on the Backend role for this project/i)).toBeInTheDocument();
});

test("2. renders compact project summary strip with company and PM", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByText("Atlas Commerce Modernization")).toBeInTheDocument();
  expect(screen.getByText("Atlas Commerce")).toBeInTheDocument();
  expect(screen.getByText(/Demo PM — Atlas/)).toBeInTheDocument();
});

test("3. renders Required, Assigned, and Remaining metric strip values correctly", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={{ ...sampleRequirement, required_count: 3, assigned_count: 1 }}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByText("Required")).toBeInTheDocument();
  expect(screen.getByText("Assigned")).toBeInTheDocument();
  expect(screen.getByText("Remaining")).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument(); // Required count
  expect(screen.getByText("1")).toBeInTheDocument(); // Assigned count
  expect(screen.getByText("2")).toBeInTheDocument(); // Remaining count
});

test("4. renders start and end date input fields", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByLabelText("Assignment start date")).toBeInTheDocument();
  expect(screen.getByLabelText("Assignment end date")).toBeInTheDocument();
});

test("5. filters contractor list with compact search input", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  const searchInput = screen.getByPlaceholderText("Search contractors...");
  expect(screen.getByText("Demo Candidate")).toBeInTheDocument();
  expect(screen.getByText("Reese Rejected")).toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "Reese" } });
  expect(screen.queryByText("Demo Candidate")).toBeNull();
  expect(screen.getByText("Reese Rejected")).toBeInTheDocument();
});

test("6. renders contractor table with initials avatar and email", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByTestId("avatar-101")).toHaveTextContent("DC");
  expect(screen.getByTestId("avatar-102")).toHaveTextContent("RR");
  expect(screen.getByTestId("avatar-103")).toHaveTextContent("TQ");
  expect(screen.getByText("demo.candidate@example.com")).toBeInTheDocument();
});

test("7. toggles checkbox selection and updates selected count", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  const submitBtn = screen.getByRole("button", { name: "Submit Selected (0)" });
  expect(submitBtn).toBeDisabled();

  const checkbox = screen.getByLabelText("Select Demo Candidate");
  fireEvent.click(checkbox);
  expect(screen.getByRole("button", { name: "Submit Selected (1)" })).not.toBeDisabled();

  fireEvent.click(checkbox);
  expect(screen.getByRole("button", { name: "Submit Selected (0)" })).toBeDisabled();
});

test("8. enforces max selection limit based on remaining open slots", () => {
  // remaining = 1
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={{ ...sampleRequirement, required_count: 1, assigned_count: 0 }}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  const cb1 = screen.getByLabelText("Select Demo Candidate");
  const cb2 = screen.getByLabelText("Select Reese Rejected");

  fireEvent.click(cb1);
  expect(cb1).toBeChecked();
  expect(cb2).toBeDisabled();
});

test("9. submits selected contractors with dates when submitted", async () => {
  const handleAssign = vi.fn().mockResolvedValue();
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={handleAssign}
    />
  );
  fireEvent.click(screen.getByLabelText("Select Demo Candidate"));
  const submitBtn = screen.getByRole("button", { name: "Submit Selected (1)" });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(handleAssign).toHaveBeenCalledTimes(1);
    expect(handleAssign).toHaveBeenCalledWith([101], expect.objectContaining({
      startDate: expect.any(String),
    }));
  });
});

test("10. triggers onClose when Cancel or Close [X] is clicked", () => {
  const handleClose = vi.fn();
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={handleClose}
      onAssign={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(handleClose).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(handleClose).toHaveBeenCalledTimes(2);
});

test("11. candidate section appears BEFORE Rate Intelligence in DOM order", async () => {
  getCapabilities.mockResolvedValue(capabilities(true));
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  const candidateSection = screen.getByTestId("contractor-selection-section");
  const rateTitle = await screen.findByText("Rate Intelligence");
  expect(candidateSection.compareDocumentPosition(rateTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("12. zero contractors shows empty state inside table instead of removing section", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={[]}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByTestId("contractor-selection-section")).toBeInTheDocument();
  expect(screen.getByText("No eligible contractors found for this role.")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search contractors...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit Selected (0)" })).toBeDisabled();
});

test("13. loading state keeps candidate section visible with spinner", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={[]}
      isLoading={true}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByTestId("contractor-selection-section")).toBeInTheDocument();
  expect(screen.getByLabelText("Loading eligible contractors…")).toBeInTheDocument();
});

test("14. error state keeps candidate section visible with error message", () => {
  render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={[]}
      isLoading={false}
      loadError="Failed to load eligible contractors."
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  expect(screen.getByTestId("contractor-selection-section")).toBeInTheDocument();
  expect(screen.getByText("Failed to load eligible contractors.")).toBeInTheDocument();
});

test("15. contains zero emojis across entire modal output", () => {
  const { container } = render(
    <AssignContractorModal
      project={sampleProject}
      requirement={sampleRequirement}
      contractors={sampleContractors}
      isLoading={false}
      loadError={null}
      onClose={vi.fn()}
      onAssign={vi.fn()}
    />
  );
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/u;
  expect(emojiRegex.test(container.textContent)).toBe(false);
});
