import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VendorStaffingPipelinePage from "./VendorStaffingPipelinePage";
import { getVendorStaffingPipeline } from "../services/staffingPipelineService";

vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock("../services/staffingPipelineService", () => ({ getVendorStaffingPipeline: vi.fn() }));

describe("VendorStaffingPipelinePage refresh metadata", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:24:00Z"));
    getVendorStaffingPipeline.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses successful fetch completion times and updates the timestamp after refresh", async () => {
    let completeInitialFetch;
    getVendorStaffingPipeline.mockImplementationOnce(() => new Promise((resolve) => {
      completeInitialFetch = resolve;
    }));

    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    render(<VendorStaffingPipelinePage />);
    await waitFor(() => expect(getVendorStaffingPipeline).toHaveBeenCalledTimes(1));
    vi.setSystemTime(new Date("2026-09-13T10:24:00Z"));
    completeInitialFetch({ items: [] });

    const getTimestamp = () => screen.getByText("Last updated").parentElement.querySelector("time");
    await waitFor(() => expect(getTimestamp()).toHaveAttribute("datetime", "2026-09-13T10:24:00.000Z"));

    let completeRefreshFetch;
    getVendorStaffingPipeline.mockImplementationOnce(() => new Promise((resolve) => {
      completeRefreshFetch = resolve;
    }));
    vi.setSystemTime(new Date("2026-09-13T11:24:00Z"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(getVendorStaffingPipeline).toHaveBeenCalledTimes(2));
    expect(getTimestamp()).toHaveAttribute("datetime", "2026-09-13T10:24:00.000Z");
    vi.setSystemTime(new Date("2026-09-13T11:24:00Z"));
    completeRefreshFetch({ items: [] });
    await waitFor(() => expect(getTimestamp()).toHaveAttribute("datetime", "2026-09-13T11:24:00.000Z"));
  });
});
