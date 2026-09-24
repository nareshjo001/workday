import { expect, test } from "@playwright/test";

const items = Array.from({ length: 15 }, (_, index) => ({
  id: index + 1,
  occurred_at: "2026-09-14T12:00:00.000Z",
  event: index % 2 ? "TIMESHEET_SUBMITTED" : "INVOICE_SUBMITTED",
  actor: { display_name: "Demo Contractor", role: "CONTRACTOR" },
  entity: { type: index % 2 ? "TIMESHEET" : "INVOICE", id: String(index + 1) },
  title: `PM activity #${index + 1}`,
  summary: `Authorized PM activity ${index + 1}.`,
  details: [],
}));

async function mockPmActivity(page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/refresh") || url.pathname.endsWith("/auth/me")) {
      return route.fulfill({
        json: { token: "mock-pm-token", user: { id: 7, name: "Demo PM", email: "pm@example.com", role: "PM" } },
      });
    }
    if (url.pathname.endsWith("/pm/activity")) {
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const limit = Number(url.searchParams.get("limit") || 10);
      const start = (pageNumber - 1) * limit;
      return route.fulfill({
        json: {
          project: null,
          items: items.slice(start, start + limit),
          pagination: { page: pageNumber, limit, total: items.length, total_pages: 2 },
        },
      });
    }
    return route.fulfill({ status: 200, json: {} });
  });
}

test("PM Activity uses the shared compact activity UI across desktop and mobile", async ({ page }) => {
  await mockPmActivity(page);

  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/pm/activity");

    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    await expect(page.getByText("Track important events across the projects and workflows you manage.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "PM activity #1", exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  }
});

test("PM Activity uses server pagination at ten records per page", async ({ page }) => {
  await mockPmActivity(page);
  await page.goto("/pm/activity");

  const pagination = page.getByRole("navigation", { name: "Activity pagination" });
  await expect(pagination).toBeVisible();
  await expect(pagination.getByText("10 results")).toBeVisible();
  await expect(pagination.getByText("Page 1 of 2")).toBeVisible();

  await pagination.getByRole("button", { name: "Next" }).click();
  await expect(pagination.getByText("5 results")).toBeVisible();
  await expect(pagination.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("PM activity #15")).toBeVisible();
});
