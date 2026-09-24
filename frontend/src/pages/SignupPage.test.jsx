import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignupPage from "./SignupPage";

const { signupMock } = vi.hoisted(() => ({ signupMock: vi.fn() }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ signup: signupMock }),
}));

function renderSignup(entry = "/signup") {
  return render(<MemoryRouter initialEntries={[entry]}><SignupPage /></MemoryRouter>);
}

beforeEach(() => signupMock.mockReset());

test("offers only supported public roles and keeps the login path", () => {
  renderSignup();

  expect(screen.getByRole("radio", { name: /^Vendor/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /^Project Manager/ })).not.toBeChecked();
  expect(screen.queryByRole("radio", { name: /^Contractor/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
});

test("preserves validation and independent password visibility controls", () => {
  renderSignup();
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(screen.getByText("Name is required.")).toBeInTheDocument();
  expect(screen.getByText("Email is required.")).toBeInTheDocument();
  expect(screen.getByText("Password is required.")).toBeInTheDocument();
  expect(screen.getByText("Please confirm your password.")).toBeInTheDocument();
  expect(signupMock).not.toHaveBeenCalled();

  const password = screen.getByLabelText("Password");
  const confirmPassword = screen.getByLabelText("Confirm password");
  fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
  expect(password).toHaveAttribute("type", "text");
  expect(confirmPassword).toHaveAttribute("type", "password");
});

test("shows the PM company field and submits the existing role-specific payload", async () => {
  let resolveSignup;
  signupMock.mockReturnValue(new Promise((resolve) => { resolveSignup = resolve; }));
  renderSignup("/signup?companyInvitationToken=invite-token");

  fireEvent.click(screen.getByRole("radio", { name: /^Project Manager/ }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Priya Shah" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "priya@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } });
  fireEvent.change(screen.getByLabelText("Client company"), { target: { value: "Acme Technologies" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(signupMock).toHaveBeenCalledWith({
    name: "Priya Shah",
    email: "priya@example.com",
    password: "password123",
    role: "PM",
    companyName: "Acme Technologies",
    companyInvitationToken: "invite-token",
  }));
  expect(screen.getByRole("button", { name: "Creating account…" })).toBeDisabled();
  await act(async () => resolveSignup({}));
});
