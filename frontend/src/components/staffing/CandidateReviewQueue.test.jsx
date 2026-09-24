import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CandidateReviewQueue from "./CandidateReviewQueue";

const candidate = {
  id: 31,
  contractor_name: "Taylor Candidate",
  vendor_name: "Vendor One",
  project_name: "Project One",
  skill: "BACKEND",
  proposed_start_date: "2026-09-08",
  proposed_end_date: "2026-09-30",
  status: "SUBMITTED",
};

const shortlistedCandidate = {
  id: 32,
  contractor_name: "Alex Designer",
  vendor_name: "Vendor Two",
  project_name: "Atlas Commerce",
  skill: "FRONTEND",
  proposed_start_date: "2026-10-01",
  proposed_end_date: "2026-11-15",
  status: "SHORTLISTED",
};

test("shows a submitted candidate and accepts through the existing decision callback", async () => {
  const onDecision = vi.fn().mockResolvedValue(undefined);
  render(<CandidateReviewQueue submissions={[candidate]} loading={false} error={null} onDecision={onDecision} />);
  expect(screen.getByText("Taylor Candidate")).toBeInTheDocument();
  expect(screen.getByText("Vendor One")).toBeInTheDocument();
  expect(screen.getByText("Project One")).toBeInTheDocument();
  expect(screen.getByText("Backend")).toBeInTheDocument();
  expect(screen.getByText("Pending")).toBeInTheDocument();
  expect(screen.getByText("1 awaiting review")).toBeInTheDocument();

  fireEvent.click(screen.getByTestId("accept-candidate-31"));
  await waitFor(() => expect(onDecision).toHaveBeenCalledWith(31, "ACCEPTED", null));
  await waitFor(() => expect(screen.getByText(/was accepted/i)).toBeInTheDocument());
});

test("requires a reason and submits it for rejection", async () => {
  const onDecision = vi.fn().mockResolvedValue(undefined);
  render(<CandidateReviewQueue submissions={[candidate]} loading={false} error={null} onDecision={onDecision} />);
  fireEvent.click(screen.getByTestId("reject-candidate-31"));
  const confirm = screen.getByRole("button", { name: "Confirm rejection" });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Missing required experience" } });
  fireEvent.click(confirm);
  await waitFor(() => expect(onDecision).toHaveBeenCalledWith(31, "REJECTED", "Missing required experience"));
});

test("surfaces a protected API error without claiming success", async () => {
  const onDecision = vi.fn().mockRejectedValue(new Error("Candidate submission not found."));
  render(<CandidateReviewQueue submissions={[candidate]} loading={false} error={null} onDecision={onDecision} />);
  fireEvent.click(screen.getByTestId("accept-candidate-31"));
  await waitFor(() => expect(screen.getByText("Candidate submission not found.")).toBeInTheDocument());
  expect(screen.queryByText(/was accepted/i)).not.toBeInTheDocument();
});

test("renders empty state when no candidates are awaiting review", () => {
  const onDecision = vi.fn();
  render(<CandidateReviewQueue submissions={[]} loading={false} error={null} onDecision={onDecision} />);
  expect(screen.getByText("No candidates awaiting review")).toBeInTheDocument();
  expect(screen.getByText(/New vendor submissions will appear here/i)).toBeInTheDocument();
  expect(screen.getByText("0 awaiting review")).toBeInTheDocument();
});

test("renders multiple candidates with skill, formatted dates, and status pills", () => {
  const onDecision = vi.fn();
  render(<CandidateReviewQueue submissions={[candidate, shortlistedCandidate]} loading={false} error={null} onDecision={onDecision} />);
  expect(screen.getByText("2 awaiting review")).toBeInTheDocument();
  expect(screen.getByText("Taylor Candidate")).toBeInTheDocument();
  expect(screen.getByText("Alex Designer")).toBeInTheDocument();
  expect(screen.getByText("Frontend")).toBeInTheDocument();
  expect(screen.getByText("Shortlisted")).toBeInTheDocument();
});

test("action buttons have tooltip titles and accessible labels for accept and reject", () => {
  const onDecision = vi.fn();
  render(<CandidateReviewQueue submissions={[candidate]} loading={false} error={null} onDecision={onDecision} />);
  const acceptBtn = screen.getByTestId("accept-candidate-31");
  const rejectBtn = screen.getByTestId("reject-candidate-31");

  expect(acceptBtn).toHaveAttribute("title", "Accept");
  expect(acceptBtn).toHaveAttribute("aria-label", "Accept Taylor Candidate");
  expect(acceptBtn.querySelector(".crq-btn-label")).toHaveTextContent("Accept");

  expect(rejectBtn).toHaveAttribute("title", "Reject");
  expect(rejectBtn).toHaveAttribute("aria-label", "Reject Taylor Candidate");
  expect(rejectBtn.querySelector(".crq-btn-label")).toHaveTextContent("Reject");
});
