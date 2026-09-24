import { expect, test } from "@playwright/test";

const mockNotifications = [
  {
    id: 73,
    event_type: "DOCUMENT_EXPIRING",
    entity_type: "contractor_document",
    entity_id: 7,
    message: "A required document needs attention soon.",
    deep_link: "/vendor/compliance",
    read_at: null,
    created_at: "2026-09-14T12:00:00.000Z",
  },
  {
    id: 71,
    event_type: "INVOICE_APPROVED",
    entity_type: "invoice",
    entity_id: 6,
    message: "Your invoice was approved.",
    deep_link: "/vendor/invoices",
    read_at: "2026-09-13T10:30:00.000Z",
    created_at: "2026-09-13T10:30:00.000Z",
  },
];

async function mockPage(page) {
  let unreadCount = 1;
  let items = mockNotifications.map((n) => ({ ...n }));

  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());

    if (pathname.endsWith("/auth/refresh") || pathname.endsWith("/auth/me")) {
      return route.fulfill({
        json: {
          token: "mock-vendor-token",
          user: { id: 1, name: "Demo Vendor", email: "demo.vendor@workday.local", role: "VENDOR" },
        },
      });
    }

    if (pathname.endsWith("/vendor/notifications/read-all")) {
      unreadCount = 0;
      items = items.map((i) => ({ ...i, read_at: new Date().toISOString() }));
      return route.fulfill({ status: 204, body: "" });
    }

    if (pathname.endsWith("/vendor/notifications")) {
      return route.fulfill({
        json: {
          items,
          unread_count: unreadCount,
        },
      });
    }

    if (pathname.endsWith("/vendor/notification-preferences")) {
      return route.fulfill({
        json: {
          items: [{ event_type: "DOCUMENT_EXPIRING", in_app_enabled: true }],
        },
      });
    }

    if (pathname.includes("/read")) {
      unreadCount = Math.max(0, unreadCount - 1);
      return route.fulfill({ status: 204, body: "" });
    }

    return route.fulfill({ status: 200, json: {} });
  });
}


test("Vendor Notifications displays cleanly with non-ambiguous header, routes correctly, and has zero overflow", async ({
  page,
}) => {
  await mockPage(page);

  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1280, 720],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/notifications");

    // Verify non-ambiguous header and actions
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(page.getByText("2 total · 1 unread")).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage preferences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark all read" })).toBeVisible();

    // Verify duplicate lower preferences card is absent
    await expect(page.locator("text=Delivery preferences")).toHaveCount(0);

    // Verify notification feed items
    await expect(page.getByText("A required document needs attention soon.")).toBeVisible();
    await expect(page.getByText("Your invoice was approved.")).toBeVisible();

    // Verify zero horizontal page overflow
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  }

  // Verify Manage Preferences modal interaction
  await page.goto("/vendor/notifications");
  const managePrefsBtn = page.getByRole("button", { name: "Manage preferences" });
  await expect(managePrefsBtn).toHaveCount(1);
  await managePrefsBtn.click();

  // Verify modal elements
  const dialog = page.getByRole("dialog");
  const modalHeading = dialog.getByRole("heading", { name: "Manage notification preferences" });
  await expect(modalHeading).toBeVisible();
  await expect(dialog.getByText("Choose which in-app notifications you want to receive.")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Compliance" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save changes" })).toBeVisible();

  // Close modal via Cancel
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(modalHeading).not.toBeVisible();

  // Open modal again and close via X
  await managePrefsBtn.click();
  await expect(modalHeading).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(modalHeading).not.toBeVisible();

  // Open modal again and close via Escape
  await managePrefsBtn.click();
  await expect(modalHeading).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modalHeading).not.toBeVisible();

  // Verify Mark all read option marks all read
  const markAllReadBtn = page.getByRole("button", { name: "Mark all read" });
  await expect(markAllReadBtn).toBeVisible();
  await markAllReadBtn.click();
  // After marking all read, unread count is 0, Mark all read disappears, Manage preferences stays visible
  await expect(page.getByText("2 total · 0 unread")).toBeVisible();
  await expect(markAllReadBtn).not.toBeVisible();
  await expect(managePrefsBtn).toBeVisible();

  // Verify navigation on click
  await page.goto("/vendor/notifications");
  const invoiceNotification = page.getByRole("button", { name: /Your invoice was approved/i });
  await invoiceNotification.click();
  await expect(page).toHaveURL(/\/vendor\/invoices/);
});

test("Vendor Notifications standardizes pagination to 10 items per page and renders only when total > 10", async ({
  page,
}) => {
  const totalItems = Array.from({ length: 15 }, (_, i) => ({
    id: 100 + i,
    event_type: "INVOICE_APPROVED",
    entity_type: "invoice",
    entity_id: i + 1,
    message: `Approved invoice notification #${i + 1}`,
    deep_link: "/vendor/invoices",
    read_at: i < 5 ? null : "2026-09-14T10:00:00.000Z",
    created_at: "2026-09-14T12:00:00.000Z",
  }));

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/refresh") || url.pathname.endsWith("/auth/me")) {
      return route.fulfill({
        json: {
          token: "mock-vendor-token",
          user: { id: 1, name: "Demo Vendor", email: "demo.vendor@workday.local", role: "VENDOR" },
        },
      });
    }

    if (url.pathname.endsWith("/vendor/notifications")) {
      const pageNum = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      const start = (pageNum - 1) * limit;
      const slice = totalItems.slice(start, start + limit);
      return route.fulfill({
        json: {
          items: slice,
          unread_count: 5,
          pagination: {
            page: pageNum,
            limit,
            total: totalItems.length,
            total_pages: Math.ceil(totalItems.length / limit),
          },
        },
      });
    }

    if (url.pathname.endsWith("/vendor/notification-preferences")) {
      return route.fulfill({
        json: { items: [{ event_type: "INVOICE_APPROVED", in_app_enabled: true }] },
      });
    }

    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto("/vendor/notifications");

  // Header shows global total across pages and global unread
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  await expect(page.getByText("15 total · 5 unread")).toBeVisible();

  // Pagination is visible with 10 results, Page 1 of 2
  const pagination = page.getByRole("navigation", { name: "Notifications pagination" });
  await expect(pagination).toBeVisible();
  await expect(pagination.getByText("10 results")).toBeVisible();
  await expect(pagination.getByText("Page 1 of 2")).toBeVisible();

  const prevBtn = pagination.getByRole("button", { name: "Previous" });
  const nextBtn = pagination.getByRole("button", { name: "Next" });
  await expect(prevBtn).toBeDisabled();
  await expect(nextBtn).toBeEnabled();

  // Click Next to navigate to page 2
  await nextBtn.click();
  await expect(pagination.getByText("5 results")).toBeVisible();
  await expect(pagination.getByText("Page 2 of 2")).toBeVisible();
  await expect(prevBtn).toBeEnabled();
  await expect(nextBtn).toBeDisabled();
  await expect(page.getByText("Approved invoice notification #15")).toBeVisible();

  // Click Previous to return to page 1
  await prevBtn.click();
  await expect(pagination.getByText("10 results")).toBeVisible();
  await expect(pagination.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByText("Approved invoice notification #1", { exact: true })).toBeVisible();
});



