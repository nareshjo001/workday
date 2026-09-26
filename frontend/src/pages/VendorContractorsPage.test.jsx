import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorContractorsPage from "./VendorContractorsPage";
import vendorContractorService from "../services/vendorContractorService";

vi.mock("../services/vendorContractorService", () => ({
  default: {
    listContractors: vi.fn(),
    createContractor: vi.fn(),
    updateContractor: vi.fn(),
    getHistory: vi.fn(),
    getReleaseReadiness: vi.fn(),
    release: vi.fn(),
  },
}));

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ children }) => <main data-testid="dashboard-layout">{children}</main>,
}));

const mockContractors = [
  {
    id: 1,
    name: "Avery Frontend",
    email: "avery@vendor.com",
    skill: "FRONTEND",
    hourly_rate: 140,
    status: "ACTIVE",
    vendor_id: 10,
  },
  {
    id: 2,
    name: "Casey QA",
    email: "casey@vendor.com",
    skill: "QA",
    hourly_rate: 95.5,
    status: "INACTIVE",
    vendor_id: 10,
  },
];

describe("VendorContractorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
    vendorContractorService.listContractors.mockResolvedValue({
      items: mockContractors,
      total: 2,
      page: 1,
      pageSize: 15,
      total_pages: 1,
    });
    vendorContractorService.getHistory.mockResolvedValue([]);
  });

  it("sends pageSize=15 on initial load", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(vendorContractorService.listContractors).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 15,
          sort: "name",
          order: "asc",
        })
      );
    });
  });

  it("renders ONE desktop list header with Contractor, Skill, Rate, Status, and Actions columns", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-list-header")).toBeInTheDocument();
    });

    const headers = screen.getAllByTestId("contractor-list-header");
    expect(headers).toHaveLength(1);

    const header = headers[0];
    expect(within(header).getByText("Contractor")).toBeInTheDocument();
    expect(within(header).getByText("Skill")).toBeInTheDocument();
    expect(within(header).getByText("Rate")).toBeInTheDocument();
    expect(within(header).getByText("Status")).toBeInTheDocument();
    expect(within(header).getByText("Actions")).toBeInTheDocument();
  });

  it("does NOT render repeated Skill, Rate, Status, or Actions headings inside desktop row cards", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const card1 = screen.getByTestId("contractor-card-1");
    expect(within(card1).queryByRole("heading", { name: /skill/i })).not.toBeInTheDocument();
    expect(within(card1).queryByRole("heading", { name: /rate/i })).not.toBeInTheDocument();
    expect(within(card1).queryByRole("heading", { name: /status/i })).not.toBeInTheDocument();
    expect(within(card1).queryByRole("heading", { name: /actions/i })).not.toBeInTheDocument();

    expect(within(card1).queryByText("Actions")).not.toBeInTheDocument();
  });

  it("renders contractor row card values cleanly", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const card1 = screen.getByTestId("contractor-card-1");
    expect(within(card1).getByTestId("contractor-avatar")).toHaveTextContent("AF");
    expect(within(card1).getByRole("heading", { level: 2, name: "Avery Frontend" })).toBeInTheDocument();
    expect(within(card1).getByText("avery@vendor.com")).toBeInTheDocument();

    const skillBadge1 = within(card1).getByTestId("contractor-skill-badge");
    expect(skillBadge1).toHaveTextContent("Frontend");
    expect(skillBadge1.querySelector(".contractor-badge-dot")).toBeInTheDocument();

    expect(within(card1).getByText("₹140.00")).toBeInTheDocument();

    const statusBadge1 = within(card1).getByTestId("contractor-status-badge");
    expect(statusBadge1).toHaveTextContent("ACTIVE");
    expect(statusBadge1).toHaveClass("is-active");

    const card2 = screen.getByTestId("contractor-card-2");
    expect(within(card2).getByTestId("contractor-avatar")).toHaveTextContent("CQ");
    expect(within(card2).getByRole("heading", { level: 2, name: "Casey QA" })).toBeInTheDocument();
    expect(within(card2).getByText("casey@vendor.com")).toBeInTheDocument();

    const skillBadge2 = within(card2).getByTestId("contractor-skill-badge");
    expect(skillBadge2).toHaveTextContent("QA");

    const statusBadge2 = within(card2).getByTestId("contractor-status-badge");
    expect(statusBadge2).toHaveTextContent("INACTIVE");
    expect(statusBadge2).toHaveClass("is-inactive");

    expect(card1.className).not.toMatch(/border-l-4|border-emerald|border-violet|stripe/i);
    expect(card2.className).not.toMatch(/border-l-4|border-emerald|border-violet|stripe/i);
  });

  it("opens EditContractorModal when clicking Edit button", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const editBtn = screen.getByRole("button", { name: "Edit Avery Frontend" });
    fireEvent.click(editBtn);

    expect(screen.getByRole("heading", { level: 2, name: "Edit Contractor" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("140")).toBeInTheDocument();
  });

  it("opens ContractorHistoryModal when clicking History button", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const historyBtn = screen.getByRole("button", { name: "View history for Avery Frontend" });
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByText("Avery Frontend — assignment history")).toBeInTheDocument();
    });
  });

  it("opens AddContractorModal when clicking + Add Contractor button", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Contractors" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add Contractor" }));
    expect(screen.getByRole("heading", { level: 2, name: "Add Contractor" })).toBeInTheDocument();
  });

  it("preserves in-card contextual labels for responsive stacked layouts", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const card = screen.getByTestId("contractor-card-1");
    const labels = card.querySelectorAll(".contractor-col-label");
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  it("updates search input and refetches contractors", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(searchInput, { target: { value: "Avery" } });

    await waitFor(() => {
      expect(vendorContractorService.listContractors).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Avery", pageSize: 15, page: 1 })
      );
    });
  });

  it("filters by skill when selected and resets to page 1 with pageSize 15", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    const skillSelect = screen.getByRole("combobox", { name: /Filter by skill/i });
    fireEvent.change(skillSelect, { target: { value: "FRONTEND" } });

    await waitFor(() => {
      expect(vendorContractorService.listContractors).toHaveBeenCalledWith(
        expect.objectContaining({ skill: "FRONTEND", pageSize: 15, page: 1 })
      );
    });
  });

  it("requests page size of 15 and handles page navigation", async () => {
    vendorContractorService.listContractors.mockResolvedValue({
      items: mockContractors,
      total: 30,
      page: 1,
      pageSize: 15,
      total_pages: 2,
    });

    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-pagination")).toBeInTheDocument();
    });

    expect(screen.getByText("30 results · Page 1 of 2")).toBeInTheDocument();
    const nextBtn = screen.getByRole("button", { name: "Next" });
    const prevBtn = screen.getByRole("button", { name: "Previous" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(vendorContractorService.listContractors).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 15 })
      );
    });
  });

  describe("Pagination page count examples with pageSize: 15", () => {
    const testCases = [
      { total: 15, total_pages: 1, expectedText: "15 results · Page 1 of 1", nextDisabled: true },
      { total: 16, total_pages: 2, expectedText: "16 results · Page 1 of 2", nextDisabled: false },
      { total: 30, total_pages: 2, expectedText: "30 results · Page 1 of 2", nextDisabled: false },
      { total: 31, total_pages: 3, expectedText: "31 results · Page 1 of 3", nextDisabled: false },
      { total: 50, total_pages: 4, expectedText: "50 results · Page 1 of 4", nextDisabled: false },
    ];

    testCases.forEach(({ total, total_pages, expectedText, nextDisabled }) => {
      it(`verifies ${total} contractors -> Page 1 of ${total_pages}`, async () => {
        vendorContractorService.listContractors.mockResolvedValue({
          items: mockContractors,
          total,
          page: 1,
          pageSize: 15,
          total_pages,
        });

        render(
          <MemoryRouter>
            <VendorContractorsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId("contractor-pagination")).toBeInTheDocument();
        });

        expect(screen.getByText(expectedText)).toBeInTheDocument();
        const prevBtn = screen.getByRole("button", { name: "Previous" });
        const nextBtn = screen.getByRole("button", { name: "Next" });

        expect(prevBtn).toBeDisabled();
        expect(nextBtn.disabled).toBe(nextDisabled);
      });
    });
  });

  it("does not render the legacy table or the horizontal scroll helper note", async () => {
    render(
      <MemoryRouter>
        <VendorContractorsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("contractor-card-1")).toBeInTheDocument();
    });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/Scroll horizontally to view all columns/i)).not.toBeInTheDocument();
  });
});
