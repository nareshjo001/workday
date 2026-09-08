import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CandidateReviewQueue from "./CandidateReviewQueue";

const candidate = { id: 31, contractor_name: "Taylor Candidate", vendor_name: "Vendor One", project_name: "Project One", skill: "BACKEND", proposed_start_date: "2026-09-08", proposed_end_date: "2026-09-30", status: "SUBMITTED" };

test("shows a submitted candidate and accepts through the existing decision callback", async () => {
  const onDecision = vi.fn().mockResolvedValue(undefined);
  render(<CandidateReviewQueue submissions={[candidate]} loading={false} error={null} onDecision={onDecision} />);
  expect(screen.getByText("Taylor Candidate")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("accept-candidate-31"));
  await waitFor(() => expect(onDecision).toHaveBeenCalledWith(31, "ACCEPTED", null));
  expect(screen.getByText(/was accepted/i)).toBeInTheDocument();
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
