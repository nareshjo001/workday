import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardExports from "./DashboardExports";
import apiClient from "../../services/apiClient";

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("DashboardExports", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/test-blob");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("renders all 6 export buttons including renamed 'Export financials'", () => {
    render(<DashboardExports role="vendor" filters={{}} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);

    expect(screen.getByRole("button", { name: "Export Assignments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Approved timesheets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Invoices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Invoice items" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Payments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export financials" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Export Project financials" })).not.toBeInTheDocument();
  });

  it("triggers apiClient.get with '/vendor/dashboard/exports/project-financials' and passes filters", async () => {
    const mockBlob = new Blob(["test,csv,data"], { type: "text/csv" });
    apiClient.get.mockResolvedValueOnce({ data: mockBlob });

    const linkClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DashboardExports role="vendor" filters={{ clientId: "12", status: "ACTIVE" }} />);

    const exportBtn = screen.getByRole("button", { name: "Export financials" });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/vendor/dashboard/exports/project-financials", {
        params: { clientId: "12", status: "ACTIVE" },
        responseType: "blob",
      });
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    linkClickSpy.mockRestore();
  });

  it("export buttons are keyboard focusable and have explicit button types", () => {
    render(<DashboardExports role="vendor" filters={{}} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
      expect(btn).not.toBeDisabled();
      btn.focus();
      expect(btn).toHaveFocus();
    });
  });

  it("displays an error message when export fails without disabling other interactions permanently", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Export service unavailable"));

    render(<DashboardExports role="vendor" filters={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "Export financials" }));

    expect(await screen.findByText("Export service unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export financials" })).not.toBeDisabled();
  });
});
