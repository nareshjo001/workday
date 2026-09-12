import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "./NotificationsPage";
import apiClient from "../services/apiClient";

vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("../services/apiClient", () => ({ default: { get: vi.fn(), patch: vi.fn(), put: vi.fn() } }));

const notification = { id: 12, message: "A timesheet is awaiting your review.", created_at: "2026-09-11T00:00:00.000Z", read_at: null, deep_link: "/pm/timesheets" };

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((path) => Promise.resolve(path.endsWith("notification-preferences") ? { data: { items: [] } } : { data: { items: [notification], unread_count: 1 } }));
    apiClient.patch.mockResolvedValue({});
  });

  it("marks a same-role reminder read and follows its existing workflow link", async () => {
    render(<MemoryRouter initialEntries={["/pm/notifications"]}><Routes><Route path="/pm/notifications" element={<NotificationsPage role="pm" />} /><Route path="/pm/timesheets" element={<p>Timesheet review workflow</p>} /></Routes></MemoryRouter>);
    fireEvent.click((await screen.findByText(notification.message)).closest("button"));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/pm/notifications/12/read"));
    expect(await screen.findByText("Timesheet review workflow")).toBeInTheDocument();
  });

  it("does not follow a notification link outside the logged-in role's route scope", async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path.endsWith("notification-preferences") ? { data: { items: [] } } : { data: { items: [{ ...notification, deep_link: "/vendor/compliance" }], unread_count: 1 } }));
    render(<MemoryRouter initialEntries={["/pm/notifications"]}><Routes><Route path="/pm/notifications" element={<NotificationsPage role="pm" />} /><Route path="/vendor/compliance" element={<p>Vendor compliance</p>} /></Routes></MemoryRouter>);
    fireEvent.click((await screen.findByText(notification.message)).closest("button"));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/pm/notifications/12/read"));
    expect(screen.queryByText("Vendor compliance")).not.toBeInTheDocument();
  });
});
