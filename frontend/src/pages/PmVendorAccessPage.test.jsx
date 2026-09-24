import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PmVendorAccessPage from "./PmVendorAccessPage";
import pmVendorAccess from "../services/pmVendorAccessService";
import pmProjects from "../services/pmProjectService";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ title, children }) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock("../services/pmVendorAccessService", () => ({
  default: {
    vendors: vi.fn(),
    connections: vi.fn(),
    connect: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("../services/pmProjectService", () => ({
  default: {
    listProjects: vi.fn(),
  },
}));

const mockVendors = [
  { id: 10, name: "Acme Corp", email: "contact@acme.com" },
  { id: 11, name: "Globex Talent", email: "talent@globex.io" },
];

const mockProjects = [
  { id: 101, name: "Atlas Platform", status: "ACTIVE" },
  { id: 102, name: "Nova Redesign", status: "ACTIVE" },
  { id: 103, name: "Archived Project", status: "ARCHIVED" },
];

const mockConnections = [
  {
    id: 10,
    name: "Acme Corp",
    email: "contact@acme.com",
    status: "ACTIVE",
    projects: [],
  },
  {
    id: 12,
    name: "Starlight Staffing",
    email: "hi@starlight.com",
    status: "ACTIVE",
    projects: [{ id: 101, name: "Atlas Platform" }],
  },
  {
    id: 13,
    name: "Omni Talent",
    email: "team@omni.co",
    status: "ACTIVE",
    projects: [
      { id: 101, name: "Atlas Platform" },
      { id: 102, name: "Nova Redesign" },
    ],
  },
];

describe("PmVendorAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pmVendorAccess.vendors.mockResolvedValue({ items: mockVendors });
    pmProjects.listProjects.mockResolvedValue({ items: mockProjects });
    pmVendorAccess.connections.mockResolvedValue({ items: mockConnections });
  });

  it("renders the 3 main enterprise cards matching reference design", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    // 1. Hero Card
    expect(await screen.findByRole("heading", { level: 1, name: "Vendor Access" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Connect vendors to your client and grant project sourcing access."
      )
    ).toBeInTheDocument();

    // 2. Connect a Vendor Card
    expect(screen.getByRole("heading", { level: 2, name: "Connect a Vendor" })).toBeInTheDocument();
    expect(screen.getByText("Select a vendor and choose the level of access.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Vendor/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Project access/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Connect the vendor to your client. Optionally grant sourcing access to a project."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect vendor/i })).toBeInTheDocument();

    // 3. Connected Vendors Card
    expect(screen.getByRole("heading", { level: 2, name: "Connected vendors" })).toBeInTheDocument();
    expect(
      screen.getByText("Vendors currently connected to your client and their project access.")
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search vendors" })).toBeInTheDocument();
  });

  it("populates active projects and registered vendors in the dropdowns", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp · contact@acme.com");
    expect(screen.getByText("Globex Talent · talent@globex.io")).toBeInTheDocument();

    // Active projects should be present, archived projects excluded
    expect(screen.getByRole("option", { name: "Atlas Platform" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nova Redesign" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Archived Project" })).not.toBeInTheDocument();
  });

  it("displays clear access differentiation: Client access, No project access, and Project chips", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    // Vendor with client-only connection
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("No project access")).toBeInTheDocument();

    // Vendor with single project grant
    expect(screen.getByText("Starlight Staffing")).toBeInTheDocument();
    expect(screen.getAllByText("Atlas Platform").length).toBeGreaterThanOrEqual(1);

    // Vendor with multiple project grants
    expect(screen.getByText("Omni Talent")).toBeInTheDocument();
    expect(screen.getAllByText("Nova Redesign").length).toBeGreaterThanOrEqual(1);

    // Every connected vendor displays the base Client access badge
    expect(screen.getAllByText("Client access").length).toBe(3);
    expect(screen.getAllByRole("button", { name: "Remove access" }).length).toBe(3);
  });

  it("filters connected vendors live by vendor name, email, or project name", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const searchInput = screen.getByRole("searchbox", { name: "Search vendors" });

    // Filter by vendor name
    fireEvent.change(searchInput, { target: { value: "starlight" } });
    expect(screen.getByText("Starlight Staffing")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.queryByText("Omni Talent")).not.toBeInTheDocument();

    // Filter by project name
    fireEvent.change(searchInput, { target: { value: "Nova" } });
    expect(screen.getByText("Omni Talent")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.queryByText("Starlight Staffing")).not.toBeInTheDocument();

    // Filter with no match
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });
    expect(screen.getByText("No connected vendors match your search.")).toBeInTheDocument();
    expect(screen.getByText("Try searching with a different vendor name or email.")).toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Starlight Staffing")).toBeInTheDocument();
    expect(screen.getByText("Omni Talent")).toBeInTheDocument();
  });

  it("shows proper empty state when no vendors are connected", async () => {
    pmVendorAccess.connections.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No vendors are currently connected.")).toBeInTheDocument();
    expect(
      screen.getByText("Once you connect a vendor, they will appear here with their access details.")
    ).toBeInTheDocument();
  });

  it("submits vendor connection with project and reloads data", async () => {
    pmVendorAccess.connect.mockResolvedValue({ vendor_id: 11, status: "ACTIVE" });

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    const vendorSelect = await screen.findByRole("combobox", { name: /^Vendor/i });
    const projectSelect = screen.getByRole("combobox", { name: /^Project access/i });

    // Select vendor
    fireEvent.change(vendorSelect, { target: { value: "11" } });
    // Select project
    fireEvent.change(projectSelect, { target: { value: "101" } });

    // Submit
    const connectButton = screen.getByRole("button", { name: /Connect vendor/i });
    fireEvent.click(connectButton);

    await waitFor(() =>
      expect(pmVendorAccess.connect).toHaveBeenCalledWith(11, 101)
    );

    expect(await screen.findByText("Vendor relationship and sourcing access saved.")).toBeInTheDocument();
    // Form fields reset
    expect(screen.getByRole("combobox", { name: /^Vendor/i })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: /^Project access/i })).toHaveValue("");
  });

  it("connects vendor without project when 'Connect to client only' is chosen", async () => {
    pmVendorAccess.connect.mockResolvedValue({ vendor_id: 10, status: "ACTIVE" });

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    const vendorSelect = await screen.findByRole("combobox", { name: /^Vendor/i });

    fireEvent.change(vendorSelect, { target: { value: "10" } });
    // Keep project access as default ""

    const connectButton = screen.getByRole("button", { name: /Connect vendor/i });
    fireEvent.click(connectButton);

    await waitFor(() =>
      expect(pmVendorAccess.connect).toHaveBeenCalledWith(10, undefined)
    );
  });

  it("resets selections when clicking Cancel", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    const vendorSelect = await screen.findByRole("combobox", { name: /^Vendor/i });
    const projectSelect = screen.getByRole("combobox", { name: /^Project access/i });

    fireEvent.change(vendorSelect, { target: { value: "10" } });
    fireEvent.change(projectSelect, { target: { value: "101" } });

    expect(vendorSelect).toHaveValue("10");
    expect(projectSelect).toHaveValue("101");

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(screen.getByRole("combobox", { name: /^Vendor/i })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: /^Project access/i })).toHaveValue("");
  });

  it("opens in-app confirmation modal and does NOT call window.confirm when Remove access is clicked", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    // Native confirm must NOT be called
    expect(confirmSpy).not.toHaveBeenCalled();

    // In-app modal must be open
    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remove vendor access" })).toBeInTheDocument();
    expect(screen.getByText("Remove access for Acme Corp?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This will remove the vendor's client access and all active project sourcing access. Existing assignments and historical records will remain unchanged."
      )
    ).toBeInTheDocument();

    // Access summary for Acme Corp (no project grants)
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("shows correct project access summary for vendor with active project grants", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Starlight Staffing");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    // Starlight Staffing is index 1
    fireEvent.click(removeButtons[1]);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("Remove access for Starlight Staffing?")).toBeInTheDocument();

    // Modal should show Atlas Platform under Project access
    const projectPills = screen.getAllByText("Atlas Platform");
    expect(projectPills.length).toBeGreaterThanOrEqual(1);
  });

  it("closes modal and makes no API call when Cancel is clicked", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();

    const cancelButton = within(modal).getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pmVendorAccess.remove).not.toHaveBeenCalled();
  });

  it("closes modal and makes no API call when Escape key is pressed", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pmVendorAccess.remove).not.toHaveBeenCalled();
  });

  it("closes modal and makes no API call when Close (X) button is clicked", async () => {
    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();

    const closeButton = within(modal).getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pmVendorAccess.remove).not.toHaveBeenCalled();
  });

  it("removes vendor access on destructive confirm, refreshes list, and closes modal", async () => {
    pmVendorAccess.remove.mockResolvedValue();

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();

    // Click destructive "Remove access" inside modal footer
    const confirmRemoveButton = within(modal).getByRole("button", { name: "Remove access" });
    fireEvent.click(confirmRemoveButton);

    await waitFor(() => expect(pmVendorAccess.remove).toHaveBeenCalledWith(10));
    expect(await screen.findByText("Vendor access was removed from future sourcing.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Connections reloaded
    expect(pmVendorAccess.connections).toHaveBeenCalledTimes(2);
  });

  it("prevents double submission and shows loading state while remove is in progress", async () => {
    let resolveRemove;
    pmVendorAccess.remove.mockReturnValue(
      new Promise((resolve) => {
        resolveRemove = resolve;
      })
    );

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    const modal = screen.getByRole("dialog");
    const confirmRemoveButton = within(modal).getByRole("button", { name: "Remove access" });
    fireEvent.click(confirmRemoveButton);

    // Modal button enters loading state and is disabled
    expect(within(modal).getByRole("button", { name: "Removing…" })).toBeDisabled();
    expect(within(modal).getByRole("button", { name: "Cancel" })).toBeDisabled();

    // Resolve the promise
    resolveRemove();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("surfaces API errors gracefully when remove fails", async () => {
    pmVendorAccess.remove.mockRejectedValue(new Error("Unable to revoke vendor access at this time."));

    render(
      <MemoryRouter>
        <PmVendorAccessPage />
      </MemoryRouter>
    );

    await screen.findByText("Acme Corp");
    const removeButtons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(removeButtons[0]);

    const modal = screen.getByRole("dialog");
    const confirmRemoveButton = within(modal).getByRole("button", { name: "Remove access" });
    fireEvent.click(confirmRemoveButton);

    expect(await screen.findByText("Unable to revoke vendor access at this time.")).toBeInTheDocument();
  });
});
