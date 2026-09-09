import { test, expect } from "@playwright/test";

// Opt-in read-only review against a seeded demo API. Never changes business records.
// The test-only proxy permits the separately served Vite UI to use the demo API.
const apiOrigin = process.env.UI_REVIEW_API_ORIGIN;
const routes = {
  vendor: ["", "contractors", "assignments", "clients", "staffing-pipeline", "compliance", "rate-cards", "invoices", "notifications"],
  pm: ["", "projects", "vendor-access", "staffing-pipeline", "timesheets", "milestones", "invoices", "notifications"],
  contractor: ["", "profile", "projects", "timesheets", "availability", "notifications"],
};
const sizes = [[360, 800], [768, 1024], [1366, 768], [1920, 1080]];

test("public and authentication screens remain contained", async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 401, json: { code: "UNAUTHORIZED" } }));
  for (const [path, heading] of [["/login", "Welcome back"], ["/signup", "Create your account"], ["/forgot-password", "Reset your password"], ["/reset-password", "Choose a new password"], ["/setup-password", "Set up your account"], ["/unauthorized", "403"], ["/missing-page", "404"]]) {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${path} at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
  }
});

for (const [role, paths] of Object.entries(routes)) {
  test(`UI layout: ${role} routes and responsive containment`, async ({ page, request }, testInfo) => {
    test.skip(!apiOrigin, "Set UI_REVIEW_API_ORIGIN to a local seeded demo API origin.");
    test.setTimeout(180_000);
    const response = await request.post(`${apiOrigin}/api/auth/login`, { data: { email: `demo.${role}@workday.local`, password: process.env.DEMO_PASSWORD || "DemoPassword!2026" } });
    expect(response.ok()).toBeTruthy();
    const session = await response.json();
    expect(session.user.role).toBe(role.toUpperCase());
    const errors = [];
    const apiFailures = new Set();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/auth/refresh") return route.fulfill({ json: session });
      if (route.request().method() !== "GET") return route.abort("blockedbyclient");
      const upstream = await request.get(`${apiOrigin}${url.pathname}${url.search}`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (!upstream.ok()) apiFailures.add(`${upstream.status()} ${url.pathname}`);
      return route.fulfill({ response: upstream });
    });
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const path of paths) {
        await page.goto(`/${role}${path ? `/${path}` : ""}`);
        await expect(page.locator("#workspace-content")).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(errors, `${role}/${path} runtime errors`).toEqual([]);
        const overflow = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
        expect(overflow.document, `${role}/${path} at ${width}px`).toBeLessThanOrEqual(width + 1);
        if (width === 360 || width === 1366) await page.screenshot({ path: testInfo.outputPath(`${role}-${path || "overview"}-${width}.png`), fullPage: true });
      }
    }
    const dialogs = role === "vendor" ? [["contractors", /Add Contractor/], ["contractors", /^Edit$/], ["contractors", /^History$/], ["invoices", /^Record payment$/]] : role === "pm" ? [["projects", /Create Project/], ["projects", /^Settings$/], ["projects", /^Requirements$/]] : [["timesheets", /Log Hours/]];
    for (const width of [360, 1366]) {
      await page.setViewportSize({ width, height: 768 });
      for (const [path, name] of dialogs) {
        await page.goto(`/${role}/${path}`);
        await page.waitForLoadState("networkidle");
        await page.getByRole("button", { name }).first().click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const panel = dialog.locator(".ui-modal-panel");
        const bounds = await panel.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(769);
        await expect(dialog.getByRole("button").last()).toBeEnabled();
        await dialog.getByRole("button").last().scrollIntoViewIfNeeded();
        await expect(dialog.getByRole("button").last()).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`${role}-${path}-${name.source.replace(/\W/g, "")}-${width}-dialog.png`) });
      }
    }
    await testInfo.attach("existing-api-failures", { body: JSON.stringify([...apiFailures]), contentType: "application/json" });
  });
}
