import { test, expect } from "@playwright/test";

// Live local demo: no mocked authentication or dashboard response.
test("PM dashboard uses real data and fits desktop, tablet, and mobile", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/pm");
  await page.getByLabel("Email address").fill("demo.pm@workday.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoPassword!2026");
  const responsePromise = page.waitForResponse(r => r.url().includes("/api/pm/dashboard") && r.request().method() === "GET");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const dashboard = await response.json();
  const values = [dashboard.summary.active_projects, dashboard.summary.active_contractors, dashboard.summary.completed_projects, dashboard.summary.pending_staffing_projects, dashboard.summary.overall_progress_percent === null ? "—" : `${dashboard.summary.overall_progress_percent}%`].map(String);
  await page.setViewportSize({ width: 1440, height: 900 });
  const pmActionStyle = await page.locator(".dashboard-quick-actions a").evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    const icon = element.querySelector("svg");
    return { height: style.height, padding: style.padding, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, borderRadius: style.borderRadius, borderWidth: style.borderWidth, gap: style.gap, iconWidth: icon ? getComputedStyle(icon).width : null };
  }));
  await expect(page.locator(".pm-dashboard-kpi-value")).toHaveText(values);
  const header = await page.locator(".workspace-header").innerHTML();
  for (const [width, height] of [[1440,900], [1366,768], [1280,720], [1024,768], [768,1024], [390,844]]) {
    await page.setViewportSize({ width, height });
    for (const collapsed of width >= 1024 ? [false, true] : [false]) {
      if (width >= 1024) {
        const toggle = page.getByRole("button", { name: collapsed ? "Collapse sidebar" : "Expand sidebar", exact: true });
        if (await toggle.isVisible()) await toggle.click();
      }
      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      await expect(page.locator(".pm-dashboard-intro")).toContainText("Your projects, staffing, and billing at a glance.");
      await expect(page.locator(".dashboard-quick-actions a")).toHaveCount(4);
      await expect(page.locator(".dashboard-quick-actions a")).toHaveText(["Manage Projects", "Timesheet", "Milestones & Billing", "Invoices"]);
      await expect(page.getByRole("navigation", { name: "Dashboard quick actions" }).getByRole("link", { name: "Vendor Access" })).toHaveCount(0);
      await expect(page.locator(".pm-dashboard-kpi-value")).toHaveText(values);
      await expect(page.getByRole("heading", { name: "Project Progress Overview" })).toHaveCount(0);
      await expect(page.getByTestId("pm-project-preview-grid")).toHaveCount(0);
      const analytics = page.getByRole("region", { name: "Project analytics overview" });
      await expect(analytics.locator(".pm-dashboard-analytics-card")).toHaveCount(3);
      await expect(analytics.getByRole("heading")).toHaveText(["Hours Progress", "Milestone Overview", "Invoice Overview"]);
      await expect(analytics.getByRole("progressbar")).toHaveCount(dashboard.projects.some((project) => project.status === "ACTIVE" && project.expected_hours !== null) ? 2 : 0);
      if (width >= 1280) {
        const analyticsCards = await analytics.locator(".pm-dashboard-analytics-card").evaluateAll((elements) => elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return { top: bounds.top, height: bounds.height };
        }));
        expect(new Set(analyticsCards.map((card) => card.top)).size).toBe(1);
        expect(new Set(analyticsCards.map((card) => card.height)).size).toBe(1);
      }
      const completionMetrics = page.getByLabel("Completion metrics");
      await expect(completionMetrics.getByRole("article")).toHaveCount(4);
      await expect(completionMetrics.getByRole("heading")).toHaveText(["Completed", "Avg. Completion", "Approaching End Date", "Past End Date, Still Active"]);
      await expect(completionMetrics.locator("svg")).toHaveCount(4);
      if (width >= 1280) {
        const completionCards = await completionMetrics.getByRole("article").evaluateAll((elements) => elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return { top: bounds.top, height: bounds.height };
        }));
        expect(new Set(completionCards.map((card) => card.top)).size).toBe(1);
        expect(new Set(completionCards.map((card) => card.height)).size).toBe(1);
      }
      const financialMetrics = page.getByLabel("Project financial metrics");
      await expect(financialMetrics.getByRole("article")).toHaveCount(8);
      await expect(financialMetrics.getByRole("heading")).toHaveText(["Project budget", "Approved work", "Submitted invoices", "Approved invoices", "Paid", "Outstanding", "Overdue", "Pending invoice reviews"]);
      await expect(financialMetrics.locator("svg")).toHaveCount(8);
      if (width >= 1280) {
        const financialCards = await financialMetrics.getByRole("article").evaluateAll((elements) => elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return { top: bounds.top, height: bounds.height };
        }));
        expect(new Set(financialCards.slice(0, 4).map((card) => card.top)).size).toBe(1);
        expect(new Set(financialCards.map((card) => card.height)).size).toBe(1);
      }
      expect(await page.locator(".workspace-header").innerHTML()).toBe(header);
      await expect(page.locator(".pm-dashboard-intro button, .pm-dashboard-intro input")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
      const cards = await page.locator(".pm-dashboard-kpi").evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { y: r.y, height: r.height }; }));
      if (width >= 1280) expect(new Set(cards.map(r => r.y)).size).toBe(1);
      if (width >= 1280) expect(new Set(cards.map(r => r.height)).size).toBe(1);
      if (width >= 1280) {
        const valuesTop = await page.locator(".pm-dashboard-kpi-value").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y));
        expect(new Set(valuesTop).size).toBe(1);
      }
      if (width >= 1280) {
        const tops = await page.locator(".dashboard-quick-actions a").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y));
        expect(new Set(tops).size).toBe(1);
      }
      await page.screenshot({ path: testInfo.outputPath(`pm-dashboard-${width}x${height}-${collapsed ? "collapsed" : "expanded"}.png`) });
      if (width === 1440 || width === 390) await page.screenshot({ path: testInfo.outputPath(`pm-dashboard-${width}-${collapsed ? "collapsed" : "expanded"}-full.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const pmToolsToggle = page.getByRole("button", { name: "Filters & exports", exact: true });
  const pmToolsContent = page.getByTestId("pm-filters-content");
  await expect(pmToolsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(pmToolsContent).toHaveAttribute("aria-hidden", "true");
  await pmToolsToggle.click();
  await expect(pmToolsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(pmToolsContent).toHaveClass(/is-expanded/);
  await page.waitForTimeout(300);
  await expect(page.getByLabel("Start date")).toBeVisible();
  await expect(page.getByLabel("End date")).toBeVisible();
  await expect(page.locator(".pm-filter-toolbar .dashboard-filter-field")).toHaveCount(6);
  await expect(page.locator(".pm-filter-toolbar .dashboard-filter-field > span")).toHaveText(["Client ID", "Project ID", "Skill ID", "Project status", "Start date", "End date"]);
  await expect(page.getByRole("button", { name: "Export Assignments", exact: true })).toBeVisible();
  const pmToolsStyle = await page.locator(".dashboard-tools").evaluate((element) => {
    const panel = getComputedStyle(element);
    const toggle = getComputedStyle(element.querySelector(".dashboard-tools-toggle"));
    const content = getComputedStyle(element.querySelector(".dashboard-tools-content"));
    const inner = getComputedStyle(element.querySelector(".dashboard-tools-inner"));
    const field = getComputedStyle(element.querySelector(".dashboard-filter-field input"));
    const exportButton = getComputedStyle(element.querySelector(".dashboard-export-btn"));
    return {
      panelRadius: panel.borderRadius,
      panelBorder: panel.borderColor,
      toggleHeight: toggle.height,
      togglePadding: toggle.padding,
      toggleFontSize: toggle.fontSize,
      toggleFontWeight: toggle.fontWeight,
      contentTransition: content.transition,
      innerGap: inner.gap,
      innerPadding: inner.padding,
      fieldHeight: field.height,
      fieldRadius: field.borderRadius,
      exportHeight: exportButton.height,
      exportPadding: exportButton.padding,
      exportRadius: exportButton.borderRadius,
    };
  });
  await page.screenshot({ path: testInfo.outputPath("pm-dashboard-filters-expanded.png"), fullPage: true });
  for (const name of ["Hours Progress", "Milestone Overview", "Invoice Overview", "Completion Analytics", "Project financials", "Recent Activity"]) await expect(page.getByRole("heading", { name, exact: true })).toBeAttached();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".mobile-navigation > summary").click();
  await expect(page.getByRole("navigation", { name: "Mobile workspace navigation" }).getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View all projects", exact: true }).click();
  await expect(page).toHaveURL(/\/pm\/projects$/);

  await page.locator(".account-menu > summary").click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByLabel("Email address").fill("demo.vendor@workday.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoPassword!2026");
  const vendorResponse = page.waitForResponse(r => r.url().includes("/api/vendor/dashboard") && r.request().method() === "GET");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await vendorResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/vendor$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  const vendorToolsToggle = page.getByRole("button", { name: "Filters & exports", exact: true });
  await vendorToolsToggle.click();
  await expect(page.getByTestId("vendor-filters-content")).toHaveClass(/is-expanded/);
  await page.waitForTimeout(300);
  const vendorToolsStyle = await page.locator(".dashboard-tools").evaluate((element) => {
    const panel = getComputedStyle(element);
    const toggle = getComputedStyle(element.querySelector(".dashboard-tools-toggle"));
    const content = getComputedStyle(element.querySelector(".dashboard-tools-content"));
    const inner = getComputedStyle(element.querySelector(".dashboard-tools-inner"));
    const field = getComputedStyle(element.querySelector(".vendor-filter-field input, .vendor-filter-field select"));
    const exportButton = getComputedStyle(element.querySelector(".dashboard-export-btn"));
    return {
      panelRadius: panel.borderRadius,
      panelBorder: panel.borderColor,
      toggleHeight: toggle.height,
      togglePadding: toggle.padding,
      toggleFontSize: toggle.fontSize,
      toggleFontWeight: toggle.fontWeight,
      contentTransition: content.transition,
      innerGap: inner.gap,
      innerPadding: inner.padding,
      fieldHeight: field.height,
      fieldRadius: field.borderRadius,
      exportHeight: exportButton.height,
      exportPadding: exportButton.padding,
      exportRadius: exportButton.borderRadius,
    };
  });
  expect(pmToolsStyle).toEqual(vendorToolsStyle);
  await page.screenshot({ path: testInfo.outputPath("vendor-dashboard-filters-expanded.png"), fullPage: true });
  const vendorActionStyle = await page.locator(".dashboard-quick-actions a").evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { height: style.height, padding: style.padding, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, borderRadius: style.borderRadius, borderWidth: style.borderWidth, gap: style.gap };
  }));
  for (const [index, vendorStyle] of vendorActionStyle.entries()) {
    const { iconWidth: _iconWidth, ...pmStyle } = pmActionStyle[index];
    expect(pmStyle).toEqual(vendorStyle);
  }
});
