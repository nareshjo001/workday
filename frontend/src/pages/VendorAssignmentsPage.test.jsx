import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VendorAssignmentsPage from "./VendorAssignmentsPage";
import vendorProjectService from "../services/vendorProjectService";

const mockAuth = vi.hoisted(() => ({
  user: { id: 1, name: "Vendor Alice", role: "VENDOR" },
  token: "fake-jwt",
  logout: vi.fn(),
  logoutAll: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../services/vendorProjectService");
vi.mock("../services/vendorAssignmentService");

const mockProjects = [
  {
    id: 1,
    name: "Alpha Security Suite",
    company_name: "CyberCore",
    pm_name: "PM Alex",
    start_date: "2026-09-01",
    end_date: "2026-12-31",
    status: "ACTIVE",
    staffing_status: "PENDING",
    total_required: 4,
    total_assigned: 2,
    expected_hours: 320,
    approved_hours: 64,
    allocated_hours: 200,
    work_progress_percent: 20,
  },
  {
    id: 2,
    name: "Beta Mobile App",
    company_name: "Nova Digital",
    pm_name: "PM Blair",
    start_date: "2026-10-01",
    end_date: "2027-03-31",
    status: "ACTIVE",
    staffing_status: "FULLY_STAFFED",
    total_required: 2,
    total_assigned: 2,
    expected_hours: 200,
    approved_hours: 100,
    allocated_hours: 200,
    work_progress_percent: 50,
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/vendor/assignments"]}>
      <VendorAssignmentsPage />
    </MemoryRouter>
  );
}

describe("VendorAssignmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A. renders two project cards from two fixtures in responsive grid", async () => {
    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: mockProjects,
      total: 2,
      page: 1,
      total_pages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Alpha Security Suite")).toBeInTheDocument();
      expect(screen.getByText("Beta Mobile App")).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId("project-staffing-card");
    expect(cards).toHaveLength(2);

    const grid = screen.getByTestId("vendor-projects-grid");
    expect(grid).toBeInTheDocument();
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("lg:grid-cols-2");
  });

  it("renders page header and Staffing Pipeline link", async () => {
    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: mockProjects,
      total: 2,
      page: 1,
      total_pages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Projects Open for Staffing")).toBeInTheDocument();
    });

    const pipelineLink = screen.getByRole("link", { name: "Staffing Pipeline" });
    expect(pipelineLink).toBeInTheDocument();
    expect(pipelineLink).toHaveAttribute("href", "/vendor/staffing-pipeline");
  });

  it("renders empty state when no projects are open for staffing", async () => {
    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      total_pages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No projects are currently open for staffing.")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("project-staffing-card")).toBeNull();
    expect(screen.queryByTestId("vendor-projects-grid")).toBeNull();
  });

  it("renders error banner when project loading fails", async () => {
    vendorProjectService.listAvailableProjects.mockRejectedValueOnce(
      new Error("Network connection error")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Network connection error")).toBeInTheDocument();
    });
  });

  it("contains zero emojis across entire page output", async () => {
    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: mockProjects,
      total: 2,
      page: 1,
      total_pages: 1,
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect(screen.getByText("Alpha Security Suite")).toBeInTheDocument();
    });

    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/u;
    expect(emojiRegex.test(container.textContent)).toBe(false);
  });

  it("requests page 1 with pageSize: 12 on initial load", async () => {
    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: mockProjects,
      total: 2,
      page: 1,
      total_pages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(vendorProjectService.listAvailableProjects).toHaveBeenCalledWith({
        page: 1,
        pageSize: 12,
        sort: "created_at",
        order: "desc",
      });
    });
  });

  it("requests page 2 with pageSize: 12 when Next button is clicked", async () => {
    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: mockProjects,
      total: 24,
      page: 1,
      total_pages: 2,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Alpha Security Suite")).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: "Next" });
    expect(nextBtn).not.toBeDisabled();

    vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
      items: mockProjects,
      total: 24,
      page: 2,
      total_pages: 2,
    });

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(vendorProjectService.listAvailableProjects).toHaveBeenCalledWith({
        page: 2,
        pageSize: 12,
        sort: "created_at",
        order: "desc",
      });
    });
  });

  describe("Pagination page count examples with pageSize: 12", () => {
    const testCases = [
      { total: 12, total_pages: 1, expectedTotal: "12 results", expectedPage: "Page 1 of 1", nextDisabled: true },
      { total: 13, total_pages: 2, expectedTotal: "13 results", expectedPage: "Page 1 of 2", nextDisabled: false },
      { total: 24, total_pages: 2, expectedTotal: "24 results", expectedPage: "Page 1 of 2", nextDisabled: false },
      { total: 25, total_pages: 3, expectedTotal: "25 results", expectedPage: "Page 1 of 3", nextDisabled: false },
      { total: 36, total_pages: 3, expectedTotal: "36 results", expectedPage: "Page 1 of 3", nextDisabled: false },
      { total: 37, total_pages: 4, expectedTotal: "37 results", expectedPage: "Page 1 of 4", nextDisabled: false },
    ];

    testCases.forEach(({ total, total_pages, expectedTotal, expectedPage, nextDisabled }) => {
      it(`verifies ${total} projects -> ${expectedPage}`, async () => {
        expect(Math.ceil(total / 12)).toBe(total_pages);

        vendorProjectService.listAvailableProjects.mockResolvedValueOnce({
          items: mockProjects,
          total,
          page: 1,
          total_pages,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText(expectedTotal)).toBeInTheDocument();
        });

        expect(screen.getByText(expectedPage)).toBeInTheDocument();
        const prevBtn = screen.getByRole("button", { name: "Previous" });
        const nextBtn = screen.getByRole("button", { name: "Next" });

        expect(prevBtn).toBeDisabled();
        expect(nextBtn.disabled).toBe(nextDisabled);
      });
    });
  });
});
