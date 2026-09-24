import { expect, test } from "@playwright/test";

const periods = [
  { id: 1, start_date: "2026-09-21", end_date: "2026-09-24", reason: "Fever", status: "ACTIVE" },
  { id: 2, start_date: "2026-09-25", end_date: "2026-09-27", reason: "Training", status: "ACTIVE" },
  { id: 3, start_date: "2026-09-30", end_date: "2026-09-30", reason: "Personal", status: "ACTIVE" },
  { id: 4, start_date: "2026-10-01", end_date: "2026-10-03", reason: "Holiday", status: "ACTIVE" },
];

test("Contractor availability date filter fetches the server-filtered range", async ({ page }) => {
  const listRequests = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/refresh")) return route.fulfill({ json: { token: "availability-test-token", user: { id: 3, name: "Demo Contractor", email: "contractor@example.com", role: "CONTRACTOR" } } });
    if (url.pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { id: 3, name: "Demo Contractor", email: "contractor@example.com", role: "CONTRACTOR" } } });
    if (url.pathname.endsWith("/contractor/availability") && route.request().method() === "GET") {
      listRequests.push(url.search);
      const filtered = url.searchParams.has("from_date") ? [periods[0]] : periods;
      return route.fulfill({ json: filtered });
    }
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${url.pathname}` } });
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/contractor/availability");
  await expect(page.getByText("Holiday")).toBeVisible();
  await expect(page.locator(".contractor-availability-periods")).toHaveClass(/is-scrollable/);

  await page.getByLabel("From date").fill("2026-09-22");
  await page.getByLabel("To date").fill("2026-09-23");
  await page.getByRole("button", { name: "Apply filter" }).click();

  await expect(page.getByText("Fever")).toBeVisible();
  await expect(page.getByText("Holiday")).toHaveCount(0);
  expect(listRequests).toContain("?from_date=2026-09-22&to_date=2026-09-23");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByText("Holiday")).toBeVisible();
  expect(listRequests.at(-1)).toBe("");
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});
