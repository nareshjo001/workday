import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorClientsPage from "./VendorClientsPage";
import VendorClientCard from "../components/clients/VendorClientCard";
import clients from "../services/vendorClientService";

vi.mock("../services/vendorClientService", () => ({
  default: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ title, children }) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

const mockClientsList = [
  {
    id: 1,
    name: "Atlas Commerce",
    pm_contacts: "Demo PM — Atlas",
    status: "Active",
    active_projects: 2,
    open_requirements: 4,
    deployed_contractors: 4,
  },
  {
    id: 2,
    name: "Nova Digital",
    pm_contacts: "Demo PM — Nova",
    status: "Active",
    active_projects: 1,
    open_requirements: 2,
    deployed_contractors: 1,
  },
];

const mockAtlasDetail = {
  company: { id: 1, name: "Atlas Commerce" },
  pm_contacts: [{ id: 10, name: "Demo PM — Atlas", email: "demo.pm@workday.local" }],
  active_projects: [
    {
      id: 101,
      name: "Atlas Commerce Modernization",
      status: "ACTIVE",
      staffing_status: "PENDING",
      open_requirements: 4,
      deployed_contractors: 3,
    },
    {
      id: 102,
      name: "Platform Upgrade",
      status: "ACTIVE",
      open_requirements: 0,
      deployed_contractors: 1,
    },
  ],
};

const mockNovaDetail = {
  company: { id: 2, name: "Nova Digital" },
  pm_contacts: [{ id: 20, name: "Demo PM — Nova", email: "demo.pm.nova@workday.local" }],
  active_projects: [
    {
      id: 201,
      name: "Nova Analytics Platform",
      status: "ACTIVE",
      open_requirements: 2,
      deployed_contractors: 1,
    },
  ],
};

describe("VendorClientsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clients.list.mockResolvedValue({ items: mockClientsList });
    clients.detail.mockImplementation((id) => {
      if (id === 1) return Promise.resolve(mockAtlasDetail);
      if (id === 2) return Promise.resolve(mockNovaDetail);
      return Promise.resolve(null);
    });
  });

  it("Item A: renders header title and enterprise subtitle", async () => {
    render(<VendorClientsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Clients" })).toBeInTheDocument();
    expect(
      screen.getByText("Connected client companies and the work currently available through each relationship.")
    ).toBeInTheDocument();
  });

  it("Item B: renders client cards with company name and initials avatar", async () => {
    render(<VendorClientsPage />);

    expect(await screen.findByText("Atlas Commerce")).toBeInTheDocument();
    expect(screen.getByText("Nova Digital")).toBeInTheDocument();

    // Check initials avatar
    const atlasCard = screen.getByTestId("client-card-1");
    expect(within(atlasCard).getByText("AC")).toBeInTheDocument();

    const novaCard = screen.getByTestId("client-card-2");
    expect(within(novaCard).getByText("ND")).toBeInTheDocument();
  });

  it("Item C: renders PM contacts line for each client", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    expect(within(atlasCard).getByText("PM contacts: Demo PM — Atlas")).toBeInTheDocument();

    const novaCard = screen.getByTestId("client-card-2");
    expect(within(novaCard).getByText("PM contacts: Demo PM — Nova")).toBeInTheDocument();
  });

  it("Item D: renders Active status pill with dot indicator", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    const statusBadge = within(atlasCard).getByTestId("client-status-badge");
    expect(statusBadge).toHaveTextContent("Active");
    expect(statusBadge).toHaveClass("bg-emerald-50");
  });

  it("Item E: renders 3 metric tiles with exact counts and labels", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    const metricsGrid = within(atlasCard).getByTestId("client-metrics-grid");

    // Atlas: 2 Active projects, 4 Open requirements, 4 Deployed contractors
    expect(within(metricsGrid).getByText("2")).toBeInTheDocument();
    expect(within(metricsGrid).getByText("Active projects")).toBeInTheDocument();
    expect(within(metricsGrid).getAllByText("4")).toHaveLength(2);
    expect(within(metricsGrid).getByText("Open requirements")).toBeInTheDocument();
    expect(within(metricsGrid).getByText("Deployed contractors")).toBeInTheDocument();

    // Nova: 1 Active projects, 2 Open requirements, 1 Deployed contractors
    const novaCard = screen.getByTestId("client-card-2");
    const novaMetrics = within(novaCard).getByTestId("client-metrics-grid");
    expect(within(novaMetrics).getAllByText("1")).toHaveLength(2);
    expect(within(novaMetrics).getByText("2")).toBeInTheDocument();
  });

  it("Item F: renders recent projects with semantic status pills", async () => {
    render(<VendorClientsPage />);

    // Atlas recent projects
    expect(await screen.findByText("Atlas Commerce Modernization")).toBeInTheDocument();
    expect(screen.getByText("Platform Upgrade")).toBeInTheDocument();

    const atlasModRow = screen.getByTestId("recent-project-101");
    const atlasModBadge = within(atlasModRow).getByTestId("project-status-badge");
    expect(atlasModBadge).toHaveTextContent("Pending");
    expect(atlasModBadge).toHaveClass("bg-amber-50");

    const platformRow = screen.getByTestId("recent-project-102");
    const platformBadge = within(platformRow).getByTestId("project-status-badge");
    expect(platformBadge).toHaveTextContent("In Progress");
    expect(platformBadge).toHaveClass("bg-emerald-50");

    // Nova recent projects
    expect(screen.getByText("Nova Analytics Platform")).toBeInTheDocument();
    const novaRow = screen.getByTestId("recent-project-201");
    const novaBadge = within(novaRow).getByTestId("project-status-badge");
    expect(novaBadge).toHaveTextContent("In Progress");
    expect(novaBadge).toHaveClass("bg-emerald-50");
  });

  it("Item G: filters client cards using search input", async () => {
    render(<VendorClientsPage />);

    expect(await screen.findByText("Atlas Commerce")).toBeInTheDocument();
    expect(screen.getByText("Nova Digital")).toBeInTheDocument();

    const searchInput = screen.getByTestId("client-search-input");
    fireEvent.change(searchInput, { target: { value: "Atlas" } });

    expect(screen.getByText("Atlas Commerce")).toBeInTheDocument();
    expect(screen.queryByText("Nova Digital")).not.toBeInTheDocument();

    // Search by PM contact
    fireEvent.change(searchInput, { target: { value: "Nova" } });
    expect(screen.queryByText("Atlas Commerce")).not.toBeInTheDocument();
    expect(screen.getByText("Nova Digital")).toBeInTheDocument();
  });

  it("Item H: displays empty search state when no match is found", async () => {
    render(<VendorClientsPage />);

    expect(await screen.findByText("Atlas Commerce")).toBeInTheDocument();

    const searchInput = screen.getByTestId("client-search-input");
    fireEvent.change(searchInput, { target: { value: "Nonexistent Company" } });

    expect(screen.getByText("No clients match your search.")).toBeInTheDocument();
    expect(screen.queryByText("Atlas Commerce")).not.toBeInTheDocument();
    expect(screen.queryByText("Nova Digital")).not.toBeInTheDocument();
  });

  it("Item I: sorts client cards alphabetically", async () => {
    render(<VendorClientsPage />);

    expect(await screen.findByText("Atlas Commerce")).toBeInTheDocument();

    const sortSelect = screen.getByTestId("client-sort-select");

    // Initial order: Atlas Commerce first, then Nova Digital
    let cards = screen.getAllByTestId(/client-card-/);
    expect(cards[0]).toHaveTextContent("Atlas Commerce");
    expect(cards[1]).toHaveTextContent("Nova Digital");

    // Change to Name (Z–A)
    fireEvent.change(sortSelect, { target: { value: "name_desc" } });
    cards = screen.getAllByTestId(/client-card-/);
    expect(cards[0]).toHaveTextContent("Nova Digital");
    expect(cards[1]).toHaveTextContent("Atlas Commerce");
  });

  it("Item J & K: opens client detail modal on clicking 'View client detail'", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    const viewDetailBtn = within(atlasCard).getByTestId("view-client-detail-button");
    fireEvent.click(viewDetailBtn);

    await waitFor(() => {
      expect(clients.detail).toHaveBeenCalledWith(1);
    });

    const modal = await screen.findByRole("dialog");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("aria-modal", "true");
    expect(modal).toHaveAttribute("aria-labelledby", "vendor-client-detail-title");
    expect(within(modal).getByRole("heading", { level: 2, name: "Atlas Commerce" })).toBeInTheDocument();
    expect(within(modal).getByText("Client details and active projects")).toBeInTheDocument();
    expect(within(modal).getByTestId("client-detail-avatar")).toHaveTextContent("AC");
    expect(within(modal).getByText("Demo PM — Atlas")).toBeInTheDocument();
    expect(within(modal).getByText("demo.pm@workday.local")).toBeInTheDocument();
    expect(within(modal).getByRole("heading", { level: 3, name: "Active projects" })).toBeInTheDocument();
    expect(within(modal).getByText("Atlas Commerce Modernization")).toBeInTheDocument();
  });

  it("renders authoritative project metrics with correct pluralization and informational-only rows", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    fireEvent.click(within(atlasCard).getByTestId("view-client-detail-button"));

    const modal = await screen.findByRole("dialog");
    const projectList = within(modal).getByTestId("client-detail-projects");
    const projectRows = within(projectList).getAllByRole("listitem");
    expect(projectRows).toHaveLength(2);
    expect(within(projectRows[0]).getByText("4 open requirements")).toBeInTheDocument();
    expect(within(projectRows[0]).getByText("3 deployed contractors")).toBeInTheDocument();
    expect(within(projectRows[1]).getByText("0 open requirements")).toBeInTheDocument();
    expect(within(projectRows[1]).getByText("1 deployed contractor")).toBeInTheDocument();

    for (const row of projectRows) {
      expect(row.tagName).toBe("LI");
      expect(row).not.toHaveAttribute("role", "button");
      expect(row).not.toHaveAttribute("tabindex");
      expect(row.querySelector("button, a")).toBeNull();
      expect(row.textContent).not.toContain(">");
      expect(row.querySelector("polyline")).toBeNull();
    }

    const detailCallsBeforeProjectClick = clients.detail.mock.calls.length;
    fireEvent.click(projectRows[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(clients.detail).toHaveBeenCalledTimes(detailCallsBeforeProjectClick);
  });

  it("closes client detail using the accessible X control", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    fireEvent.click(within(atlasCard).getByTestId("view-client-detail-button"));

    const modal = await screen.findByRole("dialog");
    const closeIcon = within(modal).getByTestId("close-client-detail-icon");
    expect(closeIcon).toHaveAccessibleName("Close");
    fireEvent.click(closeIcon);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes client detail with Escape", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    fireEvent.click(within(atlasCard).getByTestId("view-client-detail-button"));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Item L: closes client detail modal via Close button", async () => {
    render(<VendorClientsPage />);

    const atlasCard = await screen.findByTestId("client-card-1");
    fireEvent.click(within(atlasCard).getByTestId("view-client-detail-button"));

    const closeBtn = await screen.findByTestId("close-detail-button");
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Item M: renders empty state when no connected clients exist", async () => {
    clients.list.mockResolvedValueOnce({ items: [] });
    render(<VendorClientsPage />);

    expect(await screen.findByText("No connected client companies.")).toBeInTheDocument();
  });

  it("Item N: displays error banner when clients fetch fails", async () => {
    clients.list.mockRejectedValueOnce(new Error("Network error loading clients."));
    render(<VendorClientsPage />);

    expect(await screen.findByText("Network error loading clients.")).toBeInTheDocument();
  });

  it("Item O: contains zero emoji characters in rendered output", async () => {
    const { container } = render(<VendorClientsPage />);
    await screen.findByText("Atlas Commerce");

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.textContent || "")).toBe(false);
  });
});

function recentProject(id) {
  return {
    id,
    name: `Recent Project ${id}`,
    status: "ACTIVE",
    open_requirements: id,
    deployed_contractors: id,
  };
}

function clientWithProjects(id, count) {
  return {
    id,
    name: `Client ${id}`,
    pm_contacts: `PM ${id}`,
    status: "Active",
    active_projects: count,
    open_requirements: count,
    deployed_contractors: count,
    recent_projects: Array.from({ length: count }, (_, index) => recentProject(id * 100 + index + 1)),
  };
}

function directPreviewRows(card) {
  const preview = within(card).getByTestId("recent-project-preview");
  return Array.from(preview.children).filter((element) => /^recent-project-\d+$/.test(element.dataset.testid || ""));
}

describe("VendorClientCard recent project expansion", () => {
  it("reserves the same collapsed two-row preview without empty control space", () => {
    render(
      <div className="grid items-start lg:grid-cols-2">
        {[0, 1, 2, 10].map((count, index) => (
          <VendorClientCard key={count} client={clientWithProjects(index + 1, count)} onViewDetail={vi.fn()} />
        ))}
      </div>,
    );

    for (const card of screen.getAllByTestId(/client-card-/)) {
      expect(within(card).getByTestId("recent-project-viewport")).toHaveClass("min-h-[90px]");
    }
    for (const id of [1, 2, 3]) {
      expect(within(screen.getByTestId(`client-card-${id}`)).queryByTestId("recent-project-control-slot")).not.toBeInTheDocument();
    }
    expect(within(screen.getByTestId("client-card-4")).getByTestId("recent-project-control-slot")).toHaveClass("h-10");
    expect(within(screen.getByTestId("client-card-1")).queryByTestId("recent-project-preview")).not.toBeInTheDocument();
    expect(directPreviewRows(screen.getByTestId("client-card-2"))).toHaveLength(1);
    expect(directPreviewRows(screen.getByTestId("client-card-3"))).toHaveLength(2);
    expect(directPreviewRows(screen.getByTestId("client-card-4"))).toHaveLength(2);
  });

  it.each([1, 2])("shows %i project(s) without an unnecessary expansion control", (count) => {
    render(<VendorClientCard client={clientWithProjects(1, count)} onViewDetail={vi.fn()} />);
    const card = screen.getByTestId("client-card-1");

    expect(directPreviewRows(card)).toHaveLength(count);
    expect(within(card).queryByRole("button", { name: "Show all projects" })).not.toBeInTheDocument();
  });

  it("shows two of three projects, expands all, and smoothly collapses to two", () => {
    render(<VendorClientCard client={clientWithProjects(1, 3)} onViewDetail={vi.fn()} />);
    const card = screen.getByTestId("client-card-1");
    const extra = within(card).getByTestId("recent-project-extra");
    const toggle = within(card).getByRole("button", { name: "Show all projects" });

    expect(directPreviewRows(card)).toHaveLength(2);
    expect(extra).toHaveAttribute("aria-hidden", "true");
    expect(extra).toHaveClass("grid-rows-[0fr]", "duration-[250ms]");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(extra).toHaveAttribute("aria-hidden", "false");
    expect(extra).toHaveClass("grid-rows-[1fr]");
    expect(within(card).getAllByTestId(/^recent-project-\d+$/)).toHaveLength(3);
    expect(within(card).getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(card).getByRole("button", { name: "Show less" }));
    expect(extra).toHaveAttribute("aria-hidden", "true");
    expect(extra).toHaveClass("grid-rows-[0fr]");
    expect(directPreviewRows(card)).toHaveLength(2);
  });

  it("shows two of ten projects initially and all ten after expansion without a nested scrollbar", () => {
    render(<VendorClientCard client={clientWithProjects(1, 10)} onViewDetail={vi.fn()} />);
    const card = screen.getByTestId("client-card-1");
    expect(directPreviewRows(card)).toHaveLength(2);

    fireEvent.click(within(card).getByRole("button", { name: "Show all projects" }));
    expect(within(card).getAllByTestId(/^recent-project-\d+$/)).toHaveLength(10);
    expect(within(card).getByTestId("recent-project-extra").querySelector(".overflow-y-auto")).toBeNull();
  });

  it("keeps expansion independent and leaves neighboring cards at natural height", () => {
    render(
      <div className="grid items-start lg:grid-cols-2" data-testid="test-client-grid">
        <VendorClientCard client={clientWithProjects(1, 3)} onViewDetail={vi.fn()} />
        <VendorClientCard client={clientWithProjects(2, 3)} onViewDetail={vi.fn()} />
      </div>,
    );
    const atlas = screen.getByTestId("client-card-1");
    const nova = screen.getByTestId("client-card-2");

    fireEvent.click(within(atlas).getByRole("button", { name: "Show all projects" }));
    expect(within(atlas).getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "false");
    expect(within(atlas).getByTestId("recent-project-viewport")).not.toHaveClass("min-h-[90px]");
    expect(within(nova).getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "true");
    expect(within(nova).getByTestId("recent-project-viewport")).toHaveClass("min-h-[90px]");
    expect(screen.getByTestId("test-client-grid")).toHaveClass("items-start");
  });

  it("keeps project rows informational and the View client detail action unchanged", () => {
    const onViewDetail = vi.fn();
    const client = clientWithProjects(1, 3);
    render(<VendorClientCard client={client} onViewDetail={onViewDetail} />);
    const card = screen.getByTestId("client-card-1");
    const row = within(card).getByTestId("recent-project-101");

    expect(row.querySelector("button, a")).toBeNull();
    expect(row).not.toHaveAttribute("role", "button");
    expect(row).not.toHaveAttribute("tabindex");
    fireEvent.click(row);
    expect(onViewDetail).not.toHaveBeenCalled();

    fireEvent.click(within(card).getByTestId("view-client-detail-button"));
    expect(onViewDetail).toHaveBeenCalledWith(client);
    expect(within(card).getByTestId("view-client-detail-button")).toHaveClass("bg-primary", "text-primary-foreground");
  });
});

describe("Vendor Clients toolbar structure", () => {
  it("keeps search and sort together in the stable desktop toolbar controls", async () => {
    render(<VendorClientsPage />);
    await screen.findByText("Atlas Commerce");

    const toolbar = screen.getByTestId("clients-toolbar");
    const controls = within(toolbar).getByTestId("clients-toolbar-controls");
    expect(toolbar).toHaveClass("vendor-clients-toolbar");
    expect(controls).toHaveClass("vendor-clients-toolbar-controls");
    expect(within(controls).getByTestId("client-search-input")).toBeInTheDocument();
    expect(within(controls).getByTestId("client-sort-select")).toBeInTheDocument();
  });
});
