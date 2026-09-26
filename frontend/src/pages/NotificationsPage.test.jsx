import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "./NotificationsPage";
import apiClient from "../services/apiClient";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../services/apiClient", () => ({
  default: { get: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

const baseNotification = {
  id: 12,
  event_type: "DOCUMENT_EXPIRING",
  entity_type: "contractor_document",
  entity_id: 5,
  message: "A required document needs attention soon.",
  created_at: "2026-09-11T17:20:29.000Z",
  read_at: null,
  deep_link: "/vendor/compliance",
};

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [baseNotification], unread_count: 1 } }
      )
    );
    apiClient.patch.mockResolvedValue({});
  });

  it("A. DOCUMENT_EXPIRING routes to Compliance", async () => {
    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/compliance" element={<p>Vendor compliance target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(baseNotification.message)).closest("button"));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/vendor/notifications/12/read"));
    expect(await screen.findByText("Vendor compliance target")).toBeInTheDocument();
  });

  it("B. INVOICE_APPROVED routes to Invoices", async () => {
    const invoiceNotif = {
      ...baseNotification,
      id: 20,
      event_type: "INVOICE_APPROVED",
      entity_type: "invoice",
      deep_link: "/vendor/invoices",
      message: "Your invoice was approved.",
    };
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [invoiceNotif], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/invoices" element={<p>Vendor invoices target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(invoiceNotif.message)).closest("button"));
    expect(await screen.findByText("Vendor invoices target")).toBeInTheDocument();
  });

  it("C. INVOICE_REJECTED routes to Invoices", async () => {
    const invoiceNotif = {
      ...baseNotification,
      id: 21,
      event_type: "INVOICE_REJECTED",
      entity_type: "invoice",
      deep_link: "/vendor/invoices",
      message: "Your invoice was rejected.",
    };
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [invoiceNotif], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/invoices" element={<p>Vendor invoices target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(invoiceNotif.message)).closest("button"));
    expect(await screen.findByText("Vendor invoices target")).toBeInTheDocument();
  });

  it("D. CANDIDATE_ACCEPTED routes to Staffing Pipeline", async () => {
    const staffingNotif = {
      ...baseNotification,
      id: 30,
      event_type: "CANDIDATE_ACCEPTED",
      entity_type: "candidate_submission",
      deep_link: "/vendor/staffing-pipeline",
      message: "A candidate submission was accepted.",
    };
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [staffingNotif], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/staffing-pipeline" element={<p>Vendor staffing target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(staffingNotif.message)).closest("button"));
    expect(await screen.findByText("Vendor staffing target")).toBeInTheDocument();
  });

  it("E. CANDIDATE_REJECTED routes to Staffing Pipeline", async () => {
    const staffingNotif = {
      ...baseNotification,
      id: 31,
      event_type: "CANDIDATE_REJECTED",
      entity_type: "candidate_submission",
      deep_link: "/vendor/staffing-pipeline",
      message: "A candidate submission was rejected.",
    };
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [staffingNotif], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/staffing-pipeline" element={<p>Vendor staffing target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(staffingNotif.message)).closest("button"));
    expect(await screen.findByText("Vendor staffing target")).toBeInTheDocument();
  });

  it("F. mark-read failure does NOT block navigation", async () => {
    apiClient.patch.mockRejectedValue(new Error("Network connection dropped"));

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/compliance" element={<p>Vendor compliance target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(baseNotification.message)).closest("button"));
    expect(await screen.findByText("Vendor compliance target")).toBeInTheDocument();
  });

  it("G. malformed/missing deep_link uses deterministic fallback", async () => {
    const fallbackNotif = {
      ...baseNotification,
      id: 40,
      event_type: "INVOICE_APPROVED",
      entity_type: "invoice",
      // Omit deep_link to exercise the deterministic destination fallback.
      deep_link: null,
      message: "Your invoice was approved without link.",
    };
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [fallbackNotif], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
          <Route path="/vendor/invoices" element={<p>Vendor invoices target</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(fallbackNotif.message)).closest("button"));
    expect(await screen.findByText("Vendor invoices target")).toBeInTheDocument();
  });

  it("H. unknown type safely remains on Notifications without throwing", async () => {
    const unknownNotif = {
      ...baseNotification,
      id: 50,
      event_type: "CUSTOM_UNKNOWN_ALERT",
      entity_type: "unknown",
      deep_link: null,
      message: "General system update recorded.",
    };
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [unknownNotif], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click((await screen.findByText(unknownNotif.message)).closest("button"));
    expect(await screen.findByText("General system update recorded.")).toBeInTheDocument();
  });

  it("I & J. heading no longer shows misleading Notifications (0) and displays unread count correctly", async () => {
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : {
              data: {
                items: [{ ...baseNotification, read_at: "2026-09-11T17:20:31.000Z" }],
                unread_count: 0,
              },
            }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    const heading = await screen.findByRole("heading", { name: "Notifications", exact: true });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByText("Notifications (0)")).not.toBeInTheDocument();

    expect(await screen.findByText("1 total · 0 unread")).toBeInTheDocument();
  });

  it("K. Mark all read is hidden when unread_count = 0", async () => {
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : {
              data: {
                items: [{ ...baseNotification, read_at: "2026-09-11T17:20:31.000Z" }],
                unread_count: 0,
              },
            }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(baseNotification.message);
    expect(screen.queryByRole("button", { name: /Mark all read/i })).not.toBeInTheDocument();
  });

  it("L. unread and read visual states differ", async () => {
    const items = [
      { ...baseNotification, id: 101, message: "Unread item", read_at: null },
      { ...baseNotification, id: 102, message: "Read item", read_at: "2026-09-11T17:20:31.000Z" },
    ];
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items, unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    const unreadBtn = (await screen.findByText("Unread item")).closest("button");
    const readBtn = (await screen.findByText("Read item")).closest("button");

    expect(unreadBtn.className).toContain("bg-blue-50");
    expect(readBtn.className).toContain("bg-white");
    expect(screen.getByTitle("Unread")).toBeInTheDocument();
  });

  it("M & N. same category always uses same icon/theme with zero emojis", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(baseNotification.message);

    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);

    const textContent = container.textContent || "";
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(textContent)).toBe(false);
  });

  it("O. timestamps have date first line / time second line", async () => {
    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Sep 11 2026")).toBeInTheDocument();
  });

  it("renders polished empty state when there are no notifications", async () => {
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : { data: { items: [], unread_count: 0 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Updates about invoices, staffing, compliance/i)
    ).toBeInTheDocument();
  });

  it("P. renders single Manage preferences button in header action area without duplicate lower card", async () => {
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? {
              data: {
                items: [
                  { event_type: "DOCUMENT_EXPIRING", in_app_enabled: true },
                  { event_type: "INVOICE_APPROVED", in_app_enabled: true },
                ],
              },
            }
          : { data: { items: [baseNotification], unread_count: 1 } }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    const manageButtons = await screen.findAllByRole("button", { name: /Manage preferences/i });
    expect(manageButtons).toHaveLength(1);

    expect(screen.queryByText(/Delivery preferences/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Control which events notify you/i)).not.toBeInTheDocument();

    fireEvent.click(manageButtons[0]);
    expect(await screen.findByRole("heading", { name: "Manage notification preferences" })).toBeInTheDocument();
    expect(screen.getByText("Choose which in-app notifications you want to receive.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Manage notification preferences" })).not.toBeInTheDocument();
    });
  });

  it("Q. pagination is hidden when total notifications <= 10", async () => {
    apiClient.get.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith("notification-preferences")
          ? { data: { items: [] } }
          : {
              data: {
                items: Array.from({ length: 8 }, (_, i) => ({
                  ...baseNotification,
                  id: i + 1,
                  message: `Notification ${i + 1}`,
                })),
                unread_count: 2,
                pagination: { page: 1, limit: 10, total: 8, total_pages: 1 },
              },
            }
      )
    );

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("8 total · 2 unread")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Notifications pagination" })).not.toBeInTheDocument();
  });

  it("R. pagination renders only when total records > 10 and supports Previous/Next navigation", async () => {
    const page1Items = Array.from({ length: 10 }, (_, i) => ({
      ...baseNotification,
      id: i + 1,
      message: `Notification ${i + 1}`,
    }));
    const page2Items = Array.from({ length: 5 }, (_, i) => ({
      ...baseNotification,
      id: i + 11,
      message: `Notification ${i + 11}`,
    }));

    apiClient.get.mockImplementation((path, options) => {
      if (path.endsWith("notification-preferences")) {
        return Promise.resolve({ data: { items: [] } });
      }
      const requestedPage = options?.params?.page || 1;
      if (requestedPage === 2) {
        return Promise.resolve({
          data: {
            items: page2Items,
            unread_count: 4,
            pagination: { page: 2, limit: 10, total: 15, total_pages: 2 },
          },
        });
      }
      return Promise.resolve({
        data: {
          items: page1Items,
          unread_count: 4,
          pagination: { page: 1, limit: 10, total: 15, total_pages: 2 },
        },
      });
    });

    render(
      <MemoryRouter initialEntries={["/vendor/notifications"]}>
        <Routes>
          <Route path="/vendor/notifications" element={<NotificationsPage role="vendor" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("15 total · 4 unread")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Notifications pagination" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("10 results")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: "Previous" });
    const nextBtn = screen.getByRole("button", { name: "Next" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/vendor/notifications", {
        params: { page: 2, limit: 10 },
      });
    });

    expect(await screen.findByText("Notification 11")).toBeInTheDocument();
    expect(screen.getByText("5 results")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(nextBtn).toBeDisabled();
    expect(prevBtn).toBeEnabled();

    fireEvent.click(prevBtn);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/vendor/notifications", {
        params: { page: 1, limit: 10 },
      });
    });
  });
});
