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
    render(<VendorStaffingPipelinePage />);
    await waitFor(() => expect(getVendorStaffingPipeline).toHaveBeenCalledTimes(1));
    const timestamp = await screen.findByText(/13 Sept 2026/i);
    expect(timestamp).toHaveAttribute("datetime", "2026-09-13T10:24:00.000Z");

    vi.setSystemTime(new Date("2026-09-13T11:24:00Z"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(getVendorStaffingPipeline).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/13 Sept 2026/i)).toHaveAttribute("datetime", "2026-09-13T11:24:00.000Z"));
  });
});
