import { expect, test } from "@playwright/test";

const skills = ["BACKEND", "FRONTEND", "QA", "DATA", "DEVOPS", "DESIGN", "BACKEND", "QA"];
const items = skills.map((skill, index) => ({
  project_id: index + 1,
  project_name: index === 0 ? "Atlas Commerce Modernization" : `Project ${index + 1}`,
  company_id: index % 2 + 1,
  company_name: index % 2 ? "Nova Digital" : "Atlas Commerce",
  requirement_id: index + 1,
  skill,
  required_count: 2,
  assigned_count: index % 2,
  open_positions: index % 2 ? 1 : 2,
  submitted_count: index === 0 ? 2 : 0,
  shortlisted_count: 0,
  accepted_count: index % 2,
  rejected_count: index === 0 ? 1 : 0,
  withdrawn_count: 0,
  open_candidate_count: index === 0 ? 2 : 0,
  oldest_open_submitted_at: index === 0 ? "2026-09-10T09:00:00Z" : null,
  candidate_response_sla_hours: 24,
  due_at: index === 0 ? "2026-09-11T09:00:00Z" : null,
  sla_breached: index === 0,
}));

async function mockPage(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh")) return route.fulfill({ json: { token: "staffing-test-token", user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/vendor/staffing-pipeline")) return route.fulfill({ json: { items } });
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

async function expectNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

test("Vendor Staffing Pipeline matches the compact reference layout across target viewports", async ({ page }, testInfo) => {
  await mockPage(page);
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/staffing-pipeline");
    await expect(page.getByRole("heading", { name: "Client staffing pipeline" })).toBeVisible();
    await expect(page.getByText("Last updated")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByText(/vs last week/i)).toHaveCount(0);
    await expect(page.getByLabel("Filter by candidate status")).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByTitle("Atlas Commerce Modernization")).toBeVisible();
    await expect(table.getByText("Atlas Commerce", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("AC", { exact: true })).toHaveCount(0);
    await expect(page.getByText("BACKEND", { exact: true }).last()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByText("SLA breached", { exact: true })).toBeVisible();
    await expect(page.getByText("No review waiting").first()).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`vendor-staffing-${width}x${height}.png`), fullPage: true });
  }
});

test("desktop sidebar transitions preserve the pipeline layout", async ({ page }) => {
  await mockPage(page);
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/staffing-pipeline");
    const expand = page.getByRole("button", { name: "Expand sidebar" });
    if (await expand.count()) await expand.click();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Oldest review" })).toBeVisible();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Oldest review" })).toBeVisible();
    await expectNoPageOverflow(page);
  }
});
