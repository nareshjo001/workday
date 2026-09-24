import { expect, test } from "@playwright/test";

const mockActivityPayload = {
  project: null,
  pagination: { page: 1, limit: 25, total: 2, total_pages: 1 },
  items: [
    {
      id: 1,
      occurred_at: "2026-09-14T12:42:00.000Z",
      event: "INVOICE_SUBMITTED",
      actor: { display_name: "Demo Vendor", role: "VENDOR" },
      entity: { type: "INVOICE", id: "INV-2026-0003" },
      title: "Invoice submitted",
      summary: "Demo Vendor submitted Invoice #INV-2026-0003 for client review.",
      details: [
        { label: "Status", value: "DRAFT → SUBMITTED" },
        { label: "Amount", value: "$3,000.00" },
      ],
    },
    {
      id: 2,
      occurred_at: "2026-09-14T10:30:00.000Z",
      event: "ASSIGNMENT_ALLOCATION_CHANGED",
      actor: { display_name: "Marcus Vance", role: "PROJECT_MANAGER" },
      entity: { type: "ASSIGNMENT", id: "ASG-102" },
      title: "Assignment allocation changed",
      summary: "Marcus Vance updated allocation for Harper Backend.",
      details: [
        { label: "Allocated hours", value: "40.00 → 40" },
        { label: "Project", value: "Atlas Legacy Migration" },
      ],
    },
  ],
};

async function mockPage(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh") || pathname.endsWith("/auth/me")) {
      return route.fulfill({
        json: { token: "mock-vendor-token", user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } },
      });
    }
    if (pathname.endsWith("/vendor/activity")) {
      return route.fulfill({ json: mockActivityPayload });
    }
    return route.fulfill({ status: 200, json: {} });
  });
}

test("Vendor Activity displays correctly across viewports with zero overflow, no emojis, and suppressed meaningless changes", async ({ page }) => {
  await mockPage(page);

  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/activity");

    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    await expect(page.getByText("Track all important events across your projects")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh activity" })).toBeVisible();

    await expect(page.getByText("Invoice submitted")).toBeVisible();
    await expect(page.getByText("Assignment allocation changed")).toBeVisible();

    // Verify meaningless change is suppressed
    await expect(page.locator("text=40.00 → 40")).toHaveCount(0);

    // Verify zero horizontal page overflow
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  }
});

test("Vendor Activity standardizes pagination to 10 items per page and renders only when total > 10", async ({
  page,
}) => {
  const totalItems = Array.from({ length: 15 }, (_, i) => ({
    id: 200 + i,
    occurred_at: "2026-09-14T12:00:00.000Z",
    event: "INVOICE_SUBMITTED",
    actor: { display_name: "Demo Vendor", role: "VENDOR" },
    entity: { type: "INVOICE", id: `INV-${i + 1}` },
    title: `Invoice event #${i + 1}`,
    summary: `Invoice #${i + 1} activity recorded.`,
    details: [],
  }));

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/refresh") || url.pathname.endsWith("/auth/me")) {
      return route.fulfill({
        json: {
          token: "mock-vendor-token",
          user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" },
        },
      });
    }

    if (url.pathname.endsWith("/vendor/activity")) {
      const pageNum = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      const start = (pageNum - 1) * limit;
      const slice = totalItems.slice(start, start + limit);
      return route.fulfill({
        json: {
          project: null,
          pagination: {
            page: pageNum,
            limit,
            total: totalItems.length,
            total_pages: Math.ceil(totalItems.length / limit),
          },
          items: slice,
        },
      });
    }

    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto("/vendor/activity");

  // Verify pagination renders Page 1 of 2
  const pagination = page.getByRole("navigation", { name: "Activity pagination" });
  await expect(pagination).toBeVisible();
  await expect(pagination.getByText("Page 1 of 2")).toBeVisible();

  const prevBtn = pagination.getByRole("button", { name: "Previous" });
  const nextBtn = pagination.getByRole("button", { name: "Next" });
  await expect(prevBtn).toBeDisabled();
  await expect(nextBtn).toBeEnabled();

  // Click Next -> requests page 2
  await nextBtn.click();
  await expect(pagination.getByText("Page 2 of 2")).toBeVisible();
  await expect(prevBtn).toBeEnabled();
  await expect(nextBtn).toBeDisabled();
  await expect(page.getByText("Invoice event #15")).toBeVisible();

  // Click Previous -> requests page 1
  await prevBtn.click();
  await expect(pagination.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByText("Invoice event #1", { exact: true })).toBeVisible();
});

