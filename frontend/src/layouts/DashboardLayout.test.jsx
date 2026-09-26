import { render, screen, fireEvent, within } from "@testing-library/react";
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
  fireEvent.click(screen.getByLabelText("Account menu"));
  fireEvent.click(screen.getByRole("button", { name: "Logout", hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: "Logout all sessions", hidden: true }));
  expect(auth.logout).toHaveBeenCalledTimes(1);
  expect(auth.logoutAll).toHaveBeenCalledTimes(1);
});

test("Vendor sidebar keeps every established route and exposes icon-led navigation", () => {
  auth.user.role = "VENDOR";
  render(<MemoryRouter initialEntries={["/vendor"]}><DashboardLayout title="Vendor dashboard" /></MemoryRouter>);

  const expectedRoutes = {
    Overview: "/vendor",
    Contractors: "/vendor/contractors",
    "Projects & assignments": "/vendor/assignments",
    Clients: "/vendor/clients",
    "Staffing pipeline": "/vendor/staffing-pipeline",
    Compliance: "/vendor/compliance",
    "Rate cards": "/vendor/rate-cards",
    "Invoices & payments": "/vendor/invoices",
    Activity: "/vendor/activity",
    Notifications: "/vendor/notifications",
  };

  const navigation = screen.getByRole("navigation", { name: "Workspace navigation" });
  for (const [label, href] of Object.entries(expectedRoutes)) {
    expect(within(navigation).getByRole("link", { name: label })).toHaveAttribute("href", href);
  }
  expect(navigation.querySelectorAll(".vendor-nav-icon")).toHaveLength(10);
  expect(navigation.querySelectorAll(".nav-marker")).toHaveLength(0);
  expect(within(navigation).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

  expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
});

test("Vendor header preserves dynamic identity, notification routing, and account actions", () => {
  auth.user = { name: "Dynamic Vendor", role: "VENDOR" };
  const { container } = render(<MemoryRouter initialEntries={["/vendor"]}><DashboardLayout title="Vendor dashboard" /></MemoryRouter>);

  expect(container.querySelector(".workspace")).toHaveClass("workspace--vendor");
  expect(screen.getByText("Dynamic Vendor", { selector: ".account-name" })).toBeInTheDocument();
  expect(screen.getByText("VENDOR", { selector: ".account-name small" })).toBeInTheDocument();
  const header = container.querySelector(".workspace-header");
  expect(within(header).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/vendor/notifications");
  expect(header.querySelector('.account-menu > summary[aria-label="Account menu"]')).toBeInTheDocument();
});

test.each(["PM", "CONTRACTOR"])("%s workspace does not receive Vendor-only header styling", (role) => {
  auth.user = { name: `Dynamic ${role}`, role };
  const { container } = render(<MemoryRouter initialEntries={[`/${role.toLowerCase()}`]}><DashboardLayout title={`${role} dashboard`} /></MemoryRouter>);

  expect(container.querySelector(".workspace")).not.toHaveClass("workspace--vendor");
});

test("PM header receives matching workspace--pm styling shell, dynamic identity, and notification routing", () => {
  auth.user = { name: "Demo PM — Atlas", role: "PM" };
  const { container } = render(
    <MemoryRouter initialEntries={["/pm"]}>
      <DashboardLayout title="PM dashboard" />
    </MemoryRouter>
  );

  const workspace = container.querySelector(".workspace");
  expect(workspace).toHaveClass("workspace--pm");
  expect(workspace).not.toHaveClass("workspace--vendor");

  const header = container.querySelector(".workspace-header");
  const context = header.querySelector(".header-context");
  expect(within(context).getByText("Workspace")).toBeInTheDocument();
  expect(within(context).getByText("PM dashboard")).toBeInTheDocument();

  expect(within(header).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/pm/notifications");
  expect(within(screen.getByRole("navigation", { name: "Workspace navigation" })).getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/pm/activity");

  expect(screen.getByText("Demo PM — Atlas", { selector: ".account-name" })).toBeInTheDocument();
  expect(screen.getByText("PM", { selector: ".account-name small" })).toBeInTheDocument();
  expect(header.querySelector(".account-avatar")).toHaveTextContent("D");
  expect(header.querySelector('.account-menu > summary[aria-label="Account menu"]')).toBeInTheDocument();
});

test("Contractor header receives the shared polished header shell without changing its routes or identity", () => {
  auth.user = { name: "Demo Contractor", role: "CONTRACTOR" };
  const { container } = render(
    <MemoryRouter initialEntries={["/contractor"]}>
      <DashboardLayout title="Contractor dashboard" />
    </MemoryRouter>
  );

  const workspace = container.querySelector(".workspace");
  expect(workspace).toHaveClass("workspace--contractor");
  expect(workspace).not.toHaveClass("workspace--vendor", "workspace--pm");

  const header = container.querySelector(".workspace-header");
  const context = header.querySelector(".header-context");
  expect(within(context).getByText("Workspace")).toBeInTheDocument();
  expect(within(context).getByText("Contractor dashboard")).toBeInTheDocument();
  expect(within(header).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/contractor/notifications");

  expect(screen.getByText("Demo Contractor", { selector: ".account-name" })).toBeInTheDocument();
  expect(screen.getByText("CONTRACTOR", { selector: ".account-name small" })).toBeInTheDocument();
  expect(header.querySelector(".account-avatar")).toHaveTextContent("D");
  expect(header.querySelector('.account-menu > summary[aria-label="Account menu"]')).toBeInTheDocument();
});

test("PM profile dropdown supports open/close, PM identity, Escape/outside dismissal, and logout actions", () => {
  auth.user = { name: "Demo PM — Atlas", role: "PM" };
  const { container } = render(
    <MemoryRouter initialEntries={["/pm"]}>
      <DashboardLayout title="PM dashboard">
        <div data-testid="outside-area">Outside content</div>
      </DashboardLayout>
    </MemoryRouter>
  );

  const summary = screen.getByLabelText("Account menu");
  const details = container.querySelector(".account-menu");

  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toHaveAttribute("open");

  fireEvent.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");
  expect(details).toHaveAttribute("open");

  expect(screen.getByText("Demo PM — Atlas", { selector: ".account-popover-name" })).toBeInTheDocument();
  expect(screen.getByText("PM", { selector: ".account-popover-role" })).toBeInTheDocument();
  expect(container.querySelector(".account-popover-avatar")).toHaveTextContent("D");

  const logoutBtn = screen.getByRole("button", { name: "Logout" });
  const logoutAllBtn = screen.getByRole("button", { name: "Logout all sessions" });
  expect(logoutBtn).toBeInTheDocument();
  expect(logoutAllBtn).toBeInTheDocument();

  auth.logout.mockClear();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toHaveAttribute("open");
  expect(auth.logout).not.toHaveBeenCalled();

  fireEvent.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");
  fireEvent.pointerDown(screen.getByTestId("outside-area"));
  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toHaveAttribute("open");
  expect(auth.logout).not.toHaveBeenCalled();

  fireEvent.click(summary);
  auth.logout.mockClear();
  fireEvent.click(logoutBtn);
  expect(auth.logout).toHaveBeenCalledTimes(1);
  expect(summary).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(summary);
  auth.logoutAll.mockClear();
  fireEvent.click(logoutAllBtn);
  expect(auth.logoutAll).toHaveBeenCalledTimes(1);
  expect(summary).toHaveAttribute("aria-expanded", "false");
});

test("profile dropdown supports accessible open/close, dynamic user data, escape key, and outside click", () => {
  auth.user = { name: "Sarah Connor", role: "VENDOR" };
  const { container } = render(
    <MemoryRouter initialEntries={["/vendor"]}>
      <DashboardLayout title="Vendor dashboard">
        <div data-testid="outside-area">Outside content</div>
      </DashboardLayout>
    </MemoryRouter>
  );

  const summary = screen.getByLabelText("Account menu");
  const details = container.querySelector(".account-menu");

  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toHaveAttribute("open");

  fireEvent.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");
  expect(details).toHaveAttribute("open");

  expect(screen.getByText("Sarah Connor", { selector: ".account-name" })).toBeInTheDocument();
  expect(screen.getByText("VENDOR", { selector: ".account-name small" })).toBeInTheDocument();
  expect(screen.getByText("Sarah Connor", { selector: ".account-popover-name" })).toBeInTheDocument();
  expect(screen.getByText("VENDOR", { selector: ".account-popover-role" })).toBeInTheDocument();
  expect(container.querySelector(".account-popover-avatar")).toHaveTextContent("S");

  const logoutBtn = screen.getByRole("button", { name: "Logout" });
  expect(logoutBtn).toBeInTheDocument();

  const logoutAllBtn = screen.getByRole("button", { name: "Logout all sessions" });
  expect(logoutAllBtn).toBeInTheDocument();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toHaveAttribute("open");

  fireEvent.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");

  fireEvent.pointerDown(screen.getByTestId("outside-area"));
  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toHaveAttribute("open");

  fireEvent.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");

  auth.logout.mockClear();
  fireEvent.click(logoutBtn);
  expect(auth.logout).toHaveBeenCalledTimes(1);
  expect(summary).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(summary);
  auth.logoutAll.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Logout all sessions" }));
  expect(auth.logoutAll).toHaveBeenCalledTimes(1);
  expect(summary).toHaveAttribute("aria-expanded", "false");
});

describe("Collapsible sidebar interaction, state, and accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("A: sidebar starts expanded according to expected default", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    const { container } = render(
      <MemoryRouter initialEntries={["/vendor"]}>
        <DashboardLayout title="Vendor dashboard" />
      </MemoryRouter>
    );

    const sidebar = container.querySelector(".workspace-sidebar");
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).not.toHaveClass("is-collapsed");

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("B, C, G: toggle collapses and expands sidebar, exposes aria-expanded, and manages label visibility", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    const { container } = render(
      <MemoryRouter initialEntries={["/vendor"]}>
        <DashboardLayout title="Vendor dashboard" />
      </MemoryRouter>
    );

    const sidebar = container.querySelector(".workspace-sidebar");
    const nav = within(sidebar).getByRole("navigation", { name: "Workspace navigation" });
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });

    expect(within(nav).getByText("Projects & assignments")).toBeInTheDocument();
    expect(within(nav).getByText("Contractors")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(sidebar).toHaveClass("is-collapsed");
    expect(container.querySelector(".workspace")).toHaveClass("has-collapsed-sidebar");
    expect(toggle).toHaveAttribute("aria-label", "Expand sidebar");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const icons = sidebar.querySelectorAll(".vendor-nav-icon");
    expect(icons.length).toBeGreaterThan(0);

    fireEvent.click(toggle);

    expect(sidebar).not.toHaveClass("is-collapsed");
    expect(container.querySelector(".workspace")).not.toHaveClass("has-collapsed-sidebar");
    expect(toggle).toHaveAttribute("aria-label", "Collapse sidebar");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByText("Projects & assignments")).toBeInTheDocument();
  });

  test("D: active route remains highlighted in both expanded and collapsed states", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    const { container } = render(
      <MemoryRouter initialEntries={["/vendor/contractors"]}>
        <DashboardLayout title="Contractors" />
      </MemoryRouter>
    );

    const sidebar = container.querySelector(".workspace-sidebar");
    const nav = within(sidebar).getByRole("navigation", { name: "Workspace navigation" });
    const activeLink = within(nav).getByRole("link", { name: "Contractors" });
    expect(activeLink).toHaveClass("is-active");
    expect(activeLink).toHaveAttribute("aria-current", "page");

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    fireEvent.click(toggle);

    expect(activeLink).toHaveClass("is-active");
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  test("E: all nav links keep correct destinations across states", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    render(
      <MemoryRouter initialEntries={["/vendor"]}>
        <DashboardLayout title="Vendor dashboard" />
      </MemoryRouter>
    );

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    fireEvent.click(toggle);

    const navigation = screen.getByRole("navigation", { name: "Workspace navigation" });
    const links = within(navigation).getAllByRole("link");
    expect(links).toHaveLength(10);
    expect(within(navigation).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/vendor");
    expect(within(navigation).getByRole("link", { name: "Contractors" })).toHaveAttribute("href", "/vendor/contractors");
    expect(within(navigation).getByRole("link", { name: "Projects & assignments" })).toHaveAttribute("href", "/vendor/assignments");
    expect(within(navigation).getByRole("link", { name: "Invoices & payments" })).toHaveAttribute("href", "/vendor/invoices");
  });

  test("F: Sign out is not present in sidebar in both expanded and collapsed states, but Logout is available in profile popover", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    auth.logout.mockClear();
    auth.logoutAll.mockClear();
    const { container } = render(
      <MemoryRouter initialEntries={["/vendor"]}>
        <DashboardLayout title="Vendor dashboard" />
      </MemoryRouter>
    );

    const sidebar = container.querySelector(".workspace-sidebar");
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });

    expect(within(sidebar).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Sign out")).not.toBeInTheDocument();
    expect(sidebar.querySelector(".sidebar-footer")).not.toBeInTheDocument();
    expect(sidebar.querySelector('[aria-label="Sign out"]')).not.toBeInTheDocument();
    expect(sidebar.querySelector('[data-tooltip="Sign out"]')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(sidebar).toHaveClass("is-collapsed");
    expect(within(sidebar).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Sign out")).not.toBeInTheDocument();
    expect(sidebar.querySelector(".sidebar-footer")).not.toBeInTheDocument();
    expect(sidebar.querySelector('[aria-label="Sign out"]')).not.toBeInTheDocument();
    expect(sidebar.querySelector('[data-tooltip="Sign out"]')).not.toBeInTheDocument();

    const summary = screen.getByLabelText("Account menu");
    fireEvent.click(summary);

    const logoutBtn = screen.getByRole("button", { name: "Logout" });
    const logoutAllBtn = screen.getByRole("button", { name: "Logout all sessions" });
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutAllBtn).toBeInTheDocument();

    fireEvent.click(logoutBtn);
    expect(auth.logout).toHaveBeenCalledTimes(1);

    fireEvent.click(summary);
    fireEvent.click(logoutAllBtn);
    expect(auth.logoutAll).toHaveBeenCalledTimes(1);
  });

  test("H: collapsed nav items retain accessible names", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    render(
      <MemoryRouter initialEntries={["/vendor"]}>
        <DashboardLayout title="Vendor dashboard" />
      </MemoryRouter>
    );

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    fireEvent.click(toggle);

    const navigation = screen.getByRole("navigation", { name: "Workspace navigation" });
    expect(within(navigation).getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Contractors" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Projects & assignments" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Notifications" })).toBeInTheDocument();
  });

  test("I: role-based navigation remains unchanged for PM and CONTRACTOR", () => {
    auth.user = { name: "PM User", role: "PM" };
    const { unmount } = render(
      <MemoryRouter initialEntries={["/pm"]}>
        <DashboardLayout title="PM dashboard" />
      </MemoryRouter>
    );
    const pmNav = screen.getByRole("navigation", { name: "Workspace navigation" });
    expect(within(pmNav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/pm");
    expect(within(pmNav).getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/pm/projects");
    expect(within(pmNav).getByRole("link", { name: "Vendor access" })).toHaveAttribute("href", "/pm/vendor-access");
    unmount();

    auth.user = { name: "Contractor User", role: "CONTRACTOR" };
    render(
      <MemoryRouter initialEntries={["/contractor"]}>
        <DashboardLayout title="Contractor dashboard" />
      </MemoryRouter>
    );
    const contractorNav = screen.getByRole("navigation", { name: "Workspace navigation" });
    expect(within(contractorNav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/contractor");
    expect(within(contractorNav).getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/contractor/profile");
    expect(within(contractorNav).getByRole("link", { name: "Timesheets" })).toHaveAttribute("href", "/contractor/timesheets");
  });

  test("J: no emoji icons are rendered in sidebar markup (Sidebar emoji scan: PASS)", () => {
    auth.user = { name: "Demo Vendor", role: "VENDOR" };
    const { container } = render(
      <MemoryRouter initialEntries={["/vendor"]}>
        <DashboardLayout title="Vendor dashboard" />
      </MemoryRouter>
    );

    const sidebar = container.querySelector(".workspace-sidebar");
    const html = sidebar.innerHTML;
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    expect(emojiRegex.test(html)).toBe(false);
  });
});
