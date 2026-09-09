import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

const auth = vi.hoisted(() => ({ user: { name: "Taylor", role: "PM" }, logout: vi.fn(), logoutAll: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

test.each(["PM", "VENDOR", "CONTRACTOR"])("%s navigation preserves role-scoped paths", (role) => {
  auth.user.role = role;
  render(<MemoryRouter initialEntries={[`/${role.toLowerCase()}`]}><DashboardLayout title="Overview"><h1>Page content</h1></DashboardLayout></MemoryRouter>);
  const navigation = screen.getByRole("navigation", { name: "Workspace navigation" });
  for (const link of navigation.querySelectorAll("a")) expect(link.getAttribute("href")).toMatch(new RegExp(`^/${role.toLowerCase()}(?:/|$)`));
  expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent("Overview");
  expect(screen.getByRole("heading", { name: "Page content" })).toBeInTheDocument();
});

test("both existing logout callbacks remain available in the account menu", () => {
  render(<MemoryRouter><DashboardLayout title="Overview" /></MemoryRouter>);
  fireEvent.click(screen.getByText("⌄", { selector: ".account-menu summary > span:last-child" }));
  fireEvent.click(screen.getByRole("button", { name: "Logout", hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: "Logout all sessions", hidden: true }));
  expect(auth.logout).toHaveBeenCalledTimes(1);
  expect(auth.logoutAll).toHaveBeenCalledTimes(1);
});
