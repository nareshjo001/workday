import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContractorAvailabilityPage from "./ContractorAvailabilityPage";
import availabilityService from "../services/contractorAvailabilityService";

vi.mock("../services/contractorAvailabilityService", () => ({
  default: { list: vi.fn(), create: vi.fn(), cancel: vi.fn() },
}));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));

const periods = [
  { id: 1, start_date: "2026-09-21", end_date: "2026-09-24", reason: "Fever", status: "ACTIVE" },
  { id: 2, start_date: "2026-10-10", end_date: "2026-10-11", reason: null, status: "CANCELLED" },
];

beforeEach(() => {
  vi.clearAllMocks();
  availabilityService.list.mockResolvedValue(periods);
  availabilityService.cancel.mockResolvedValue(undefined);
});

describe("Contractor My Availability presentation", () => {
  test("renders readable dates, reasons, statuses, and only active cancellation actions", async () => {
    render(<ContractorAvailabilityPage />);
    const list = await screen.findByRole("region", { name: "Upcoming unavailable periods" });
    expect(list).toHaveTextContent("Sep 21, 2026 – Sep 24, 2026");
    expect(list).toHaveTextContent("Oct 10, 2026 – Oct 11, 2026");
    expect(list).toHaveTextContent("Fever");
    expect(list).toHaveTextContent("No reason provided");
    expect(list).toHaveTextContent("ACTIVE");
    expect(list).toHaveTextContent("CANCELLED");
    expect(within(list).getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
  });

  test("preserves the existing create payload, date restriction, and local insertion flow", async () => {
    availabilityService.list.mockResolvedValue([]);
    availabilityService.create.mockResolvedValue({ id: 3, start_date: "2026-11-02", end_date: "2026-11-04", reason: "Training", status: "ACTIVE" });
    render(<ContractorAvailabilityPage />);
    await screen.findByText("No unavailable periods recorded.");

    const start = screen.getByLabelText("Start date");
    const end = screen.getByLabelText("End date");
    fireEvent.change(start, { target: { value: "2026-11-02" } });
    fireEvent.change(end, { target: { value: "2026-11-04" } });
    const reason = screen.getByLabelText(/Reason/);
    expect(reason).toBeRequired();
    fireEvent.change(reason, { target: { value: "Training" } });
    expect(end).toHaveAttribute("min", "2026-11-02");
    fireEvent.click(screen.getByRole("button", { name: "Add unavailable period" }));

    await waitFor(() => expect(availabilityService.create).toHaveBeenCalledWith({ start_date: "2026-11-02", end_date: "2026-11-04", reason: "Training" }));
    expect(await screen.findByText(/Nov 2, 2026/)).toBeInTheDocument();
  });

  test("preserves cancellation and updates only the existing item status", async () => {
    availabilityService.list.mockResolvedValue([periods[0]]);
    render(<ContractorAvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(availabilityService.cancel).toHaveBeenCalledWith(1));
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  test("enables an internal period-list scroller only after the third item", async () => {
    const fourth = { id: 4, start_date: "2026-12-01", end_date: "2026-12-02", reason: "Personal", status: "ACTIVE" };
    availabilityService.list.mockResolvedValue([...periods, { ...periods[0], id: 3 }, fourth]);
    const { container } = render(<ContractorAvailabilityPage />);
    await screen.findByText("Dec 1, 2026", { exact: false });
    expect(container.querySelector(".contractor-availability-periods")).toHaveClass("is-scrollable");
  });

  test("fetches overlapping records from the API for the selected date range and clears the filter", async () => {
    availabilityService.list
      .mockResolvedValueOnce(periods)
      .mockResolvedValueOnce([periods[0]])
      .mockResolvedValueOnce(periods);
    render(<ContractorAvailabilityPage />);
    await screen.findByText("Fever");

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-22" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-09-23" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));

    await waitFor(() => expect(availabilityService.list).toHaveBeenLastCalledWith({ fromDate: "2026-09-22", toDate: "2026-09-23" }));
    expect(screen.getByText("Fever")).toBeInTheDocument();
    expect(screen.queryByText("No reason provided")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(availabilityService.list).toHaveBeenLastCalledWith(null));
    expect(screen.getByLabelText("From date")).toHaveValue("");
    expect(screen.getByLabelText("To date")).toHaveValue("");
    expect(await screen.findByText("No reason provided")).toBeInTheDocument();
  });

  test("shows a filtered empty state without treating it as an API error", async () => {
    availabilityService.list.mockResolvedValueOnce(periods).mockResolvedValueOnce([]);
    render(<ContractorAvailabilityPage />);
    await screen.findByText("Fever");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2027-01-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(await screen.findByText("No unavailable periods found for the selected dates.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
