import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorRateCardsPage from "./VendorRateCardsPage";
import vendorRateCardService from "../services/vendorRateCardService";

vi.mock("../services/vendorRateCardService", () => ({ default: { setup: vi.fn(), list: vi.fn(), create: vi.fn() } }));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <div>{children}</div> }));

const clients = [{ id: 1, name: "Atlas Commerce", pm_contacts: "Demo PM — Atlas", active_projects: 2 }];
const skills = [{ id: 4, code: "BACKEND", name: "Backend" }];
const card = { id: 8, skill: "Backend", bill_rate: "180.00", cost_rate: "120.00", currency: "USD", effective_from: "2026-09-15", effective_to: null, status: "ACTIVE" };

describe("VendorRateCardsPage", () => {
  beforeEach(() => { vi.clearAllMocks(); vendorRateCardService.setup.mockResolvedValue({ clients, skills }); vendorRateCardService.list.mockResolvedValue([]); });
  it("loads setup and supplies only connected clients", async () => {
    render(<VendorRateCardsPage />);
    const select = await screen.findByLabelText("Client");
    expect(vendorRateCardService.setup).toHaveBeenCalledOnce();
    expect(within(select).getByRole("option", { name: "Atlas Commerce" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows a setup error only when the setup API fails", async () => {
    vendorRateCardService.setup.mockRejectedValueOnce(new Error("Skills unavailable"));
    render(<VendorRateCardsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Skills unavailable");
  });
  it("loads selected-client rate cards with actual formatting and status", async () => {
    vendorRateCardService.list.mockResolvedValueOnce([card]);
    render(<VendorRateCardsPage />);
    fireEvent.change(await screen.findByLabelText("Client"), { target: { value: "1" } });
    expect(await screen.findByText("Backend")).toBeInTheDocument();
    expect(vendorRateCardService.list).toHaveBeenCalledWith("1");
    expect(screen.getByText("$180.00")).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getByText("Sep 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("Ongoing")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByTestId("rate-card-skill-badge").style.backgroundColor).toBe("rgb(236, 253, 245)");
    expect(screen.getByTestId("selected-client-summary")).toHaveTextContent("AC");
    expect(screen.getByTestId("selected-client-summary")).toHaveTextContent("Demo PM — Atlas");
    expect(screen.getByRole("heading", { name: "Add future rate card" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Existing rate cards" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search skills")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual(["Skill", "Bill rate", "Cost rate", "Currency", "Effective from", "Effective to", "Status"]);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more|actions|ellipsis/i })).not.toBeInTheDocument();
  });
  it("shows a clean empty state after selecting an empty client", async () => {
    render(<VendorRateCardsPage />);
    fireEvent.change(await screen.findByLabelText("Client"), { target: { value: "1" } });
    expect(await screen.findByText("No rate cards configured for this client.")).toBeInTheDocument();
  });
  it("preserves field validation and the existing create payload", async () => {
    vendorRateCardService.create.mockResolvedValue({ id: 9 });
    render(<VendorRateCardsPage />);
    fireEvent.change(await screen.findByLabelText("Client"), { target: { value: "1" } });
    await screen.findByLabelText("Skill");
    const bill = screen.getByLabelText("Bill rate");
    expect(bill).toHaveAttribute("min", "0.01");
    fireEvent.change(screen.getByLabelText("Skill"), { target: { value: "4" } });
    fireEvent.change(bill, { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Cost rate (optional)"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Effective from"), { target: { value: "2026-09-15" } });
    fireEvent.submit(screen.getByRole("button", { name: "Add rate card" }).closest("form"));
    await waitFor(() => expect(vendorRateCardService.create).toHaveBeenCalledWith(expect.objectContaining({ client_company_id: 1, skill_id: 4, bill_rate: 180, cost_rate: 120, effective_to: null })));
  });
});
