import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import PasswordActionPage from "./PasswordActionPage";

const { resetPassword } = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock("../services/authService", () => ({ default: { resetPassword, setupPassword: vi.fn() } }));
beforeEach(() => resetPassword.mockReset());

test("uses the one-time reset token from the URL and never renders it", async () => {
  resetPassword.mockResolvedValue(undefined);
  render(<MemoryRouter initialEntries={["/reset-password?token=raw-one-time-token"]}><PasswordActionPage mode="reset" /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Password123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  await waitFor(() => expect(resetPassword).toHaveBeenCalledWith("raw-one-time-token", "Password123!"));
  expect(screen.getByText(/Your password has been set/)).toBeInTheDocument();
  expect(screen.queryByText("raw-one-time-token")).not.toBeInTheDocument();
});

test("rejects a too-short password before making a request", async () => {
  render(<MemoryRouter initialEntries={["/reset-password?token=one-time"]}><PasswordActionPage mode="reset" /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
  expect(resetPassword).not.toHaveBeenCalled();
});
