import { expect, test } from "@playwright/test";

const client = { id: 1, name: "Atlas Commerce", pm_contacts: "Demo PM — Atlas", active_projects: 2 };
const rateCards = [
  { id: 1, skill: "Frontend", bill_rate: "80.00", cost_rate: "60.00", currency: "USD", effective_from: "2026-09-01", effective_to: "2026-12-31", status: "ACTIVE" },
  { id: 2, skill: "Backend", bill_rate: "90.00", cost_rate: "70.00", currency: "USD", effective_from: "2027-01-01", effective_to: null, status: "INACTIVE" },
];

async function mockPage(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh")) return route.fulfill({ json: { token: "rate-card-test-token", user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/vendor/clients/1/rate-cards")) return route.fulfill({ json: { items: rateCards } });
    if (pathname.endsWith("/vendor/rate-card-skills")) return route.fulfill({ json: { items: [{ id: 1, code: "FRONTEND" }, { id: 2, code: "BACKEND" }] } });
    if (pathname.endsWith("/vendor/clients")) return route.fulfill({ json: { items: [client] } });
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

async function expectNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

test("Vendor Rate cards matches the rich responsive layout without an Actions column", async ({ page }, testInfo) => {
  await mockPage(page);
  for (const [width, height] of [[1440, 900], [1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/rate-cards");
    await page.getByLabel("Client", { exact: true }).selectOption("1");
    await expect(page.getByTestId("selected-client-summary")).toContainText("AC");
    await expect(page.getByTestId("selected-client-summary")).toContainText("Demo PM — Atlas");
    await expect(page.getByTestId("selected-client-summary")).toContainText("Active projects");
    await expect(page.getByRole("heading", { name: "Add future rate card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add rate card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existing rate cards" })).toBeVisible();
    await expect(page.getByLabel("Search skills")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeAttached();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByRole("table").locator('[aria-label*="menu" i], [aria-label*="more" i], [aria-label*="ellipsis" i]')).toHaveCount(0);
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`vendor-rate-cards-${width}x${height}.png`), fullPage: true });
  }
});
