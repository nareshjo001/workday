import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PasswordField from "./PasswordField";

describe("PasswordField", () => {
  it("renders with initial password type and custom eye toggle", () => {
    render(
      <PasswordField
        id="test-password"
        label="Password"
        value="Secret123!"
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveClass("password-input");
    expect(input).toHaveClass("auth-password-input");

    const toggleBtn = screen.getByRole("button", { name: "Show password" });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles password visibility between text and password on click", () => {
    render(
      <PasswordField
        id="test-password"
        label="Password"
        value="Secret123!"
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Password");
    const toggleBtn = screen.getByRole("button", { name: "Show password" });

    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "text");
    expect(toggleBtn).toHaveAttribute("aria-label", "Hide password");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "password");
    expect(toggleBtn).toHaveAttribute("aria-label", "Show password");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("renders exactly one toggle button", () => {
    render(
      <PasswordField
        id="test-password"
        label="Password"
        value=""
        onChange={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });

  it("surfaces validation error message and accessible attributes", () => {
    render(
      <PasswordField
        id="test-password"
        label="Password"
        value=""
        onChange={vi.fn()}
        error="Password is required."
      />
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "test-password-error");
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });
});
