import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import ActivityPage from "./ActivityPage";
import auditActivityService from "../services/auditActivityService";

vi.mock("../services/auditActivityService", () => ({ default: { pm: vi.fn() } }));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));

const response = {
  items: [{ id: 9, occurred_at: "2026-09-14T12:42:00.000Z", event: "INVOICE_SUBMITTED", actor: { display_name: "Demo Vendor", role: "VENDOR" }, entity: { type: "INVOICE", id: "9" }, title: "Invoice submitted", summary: "Demo Vendor submitted an invoice.", details: [] }],
  pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
};

beforeEach(() => { vi.clearAllMocks(); auditActivityService.pm.mockResolvedValue(response); });

test("PM Activity uses the shared page with its own scoped description and refresh", async () => {
  render(<MemoryRouter><ActivityPage role="pm" /></MemoryRouter>);
  await screen.findByText("Invoice submitted");
  expect(screen.getByText("Track important events across the projects and workflows you manage.")).toBeInTheDocument();
  expect(auditActivityService.pm).toHaveBeenCalledWith(1);
  expect(screen.queryByRole("navigation", { name: "Activity pagination" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
  await waitFor(() => expect(auditActivityService.pm).toHaveBeenCalledTimes(2));
});
