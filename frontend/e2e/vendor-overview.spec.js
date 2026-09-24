import { test, expect } from "@playwright/test";

const viewportSizes = [
  [1920, 1080],
  [1536, 864],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [360, 800],
];

function project(index) {
  return {
    id: index,
    name: index === 1 ? "Enterprise Workforce Modernization With A Deliberately Long Project Name" : `Project ${index}`,
    company_name: `Client Organization ${index}`,
    status: "ACTIVE",
    approved_hours: index * 4,
    expected_hours: 200,
    work_progress_percent: Math.min(index * 2, 100),
  };
}

function activity(index) {
  const types = ["INVOICE_GENERATED", "MILESTONE_MET", "TIMESHEET_APPROVED", "ASSIGNED"];
  return {
    type: types[(index - 1) % types.length],
    message: `Activity ${index} for the vendor operational overview`,
    occurred_at: `2026-09-${String(30 - index).padStart(2, "0")} 09:30:00`,
  };
}

function dashboard(projectCount = 10, activityCount = 8, companyCount = 10, contractorCount = 10) {
  return {
    summary: { active_projects: projectCount, active_contractors: 18, total_earnings: 25210, completed_projects: 7 },
    invoices: {
      draft_count: 1,
      draft_total: 1260,
      submitted_count: 1,
      submitted_total: 8000,
      pending_review_count: 0,
      approved_count: 4,
      approved_total: 25210,
      rejected_count: 1,
      rejected_total: 5000,
      total_invoiced_amount: 39470,
    },
    earnings_by_company: Array.from({ length: companyCount }, (_, index) => ({
      company_name: `Company ${index + 1}`,
      total: 50000 - index * 500,
    })),
    earnings_by_contractor: Array.from({ length: contractorCount }, (_, index) => ({
      contractor_id: index + 1,
      contractor_name: `Contractor ${index + 1}`,
      total: 40000 - index * 400,
    })),
    project_progress: Array.from({ length: projectCount }, (_, index) => project(index + 1)),
    recent_activity: Array.from({ length: activityCount }, (_, index) => activity(index + 1)),
    m20: {
      workforce: { active_contractors: 18, open_requirements: 14 },
      candidates: { pending_reviews: 2 },
      time: { approved_hours: 167 },
      financial: {
        active_projects: projectCount,
        completed_projects: 7,
        approved_earnings_amount: 25210,
        billable_uninvoiced_amount: 1920,
        paid_amount: 4460,
        outstanding_amount: 20750,
        overdue_amount: 750,
        margin: { amount: 15265, percentage: 39.56 },
      },
    },
  };
}

async function mockVendorOverview(page, fixture) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh")) {
      await route.fulfill({
        json: {
          token: "vendor-overview-test-token",
          user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" },
        },
      });
      return;
    }
    if (pathname.endsWith("/auth/me")) {
      await route.fulfill({
        json: { user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } },
      });
      return;
    }
    if (pathname.endsWith("/vendor/dashboard")) {
      await route.fulfill({ json: fixture });
      return;
    }
    if (pathname.endsWith("/vendor/clients")) {
      await route.fulfill({ json: { items: [] } });
      return;
    }
    await route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

async function expectNoHorizontalOverflow(page, width, height) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth, `horizontal overflow at ${width}×${height}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("Vendor Overview remains balanced across required desktop, tablet, and mobile sizes", async ({ page }, testInfo) => {
  await mockVendorOverview(page, dashboard(10, 8, 2, 10));

  for (const [width, height] of viewportSizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator(".dashboard-tools-toggle, .dashboard-tools > summary")).toContainText("Filters & exports");
    await expect(page.getByRole("link", { name: "Manage Contractors" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show all projects" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Show all companies" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show all contractors" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "View all activity" })).toHaveAttribute("href", "/vendor/activity");
    await expect(page.locator(".workspace-header").getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/vendor/notifications");
    await expect(page.locator(".workspace-header .account-menu > summary")).toBeVisible();
    await expectNoHorizontalOverflow(page, width, height);

    const projectPreview = page.getByTestId("vendor-project-preview");
    await expect(projectPreview.getByRole("progressbar")).toHaveCount(3);
    await expect(projectPreview.getByText("Project 4")).toBeHidden();
    await expect(page.getByTestId("vendor-company-earnings").getByRole("listitem")).toHaveCount(2);
    await expect(page.getByTestId("vendor-contractor-earnings").getByRole("listitem")).toHaveCount(3);
    await expect(page.getByTestId("vendor-activity-preview").getByRole("listitem")).toHaveCount(5);
    await expect(page.getByTestId("vendor-activity-preview").locator(".vendor-activity-icon svg")).toHaveCount(5);

    if (width >= 1024) {
      await expect(page.locator(".workspace-sidebar")).toBeVisible();
      await expect(page.locator(".workspace-header")).toHaveCSS("min-height", "90px");
      await expect(page.locator(".workspace-header")).toHaveCSS("position", "sticky");
      await expect(page.locator(".header-context > p")).toHaveCSS("font-size", "20px");
      await expect(page.locator(".account-avatar")).toHaveCSS("width", "46px");
      await expect(page.getByRole("link", { name: "Projects & assignments" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
      await expect(page.locator(".workspace-sidebar .vendor-nav-icon")).toHaveCount(10);
      const sidebar = await page.locator(".workspace-sidebar").evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(sidebar.width).toBe(288);
      expect(sidebar.scrollHeight, `sidebar overflow at ${width}×${height}`).toBeLessThanOrEqual(sidebar.clientHeight + 1);

      const companyCard = await page.getByTestId("vendor-company-earnings").locator("..").boundingBox();
      const contractorCard = await page.getByTestId("vendor-contractor-earnings").locator("..").boundingBox();
      expect(Math.abs(companyCard.height - contractorCard.height), `earnings height mismatch at ${width}×${height}`).toBeLessThanOrEqual(1);

      if (width === 1440) {
        await expect(page.locator(".account-name")).toContainText("Demo Vendor");
        await expect(page.locator(".account-name")).toContainText("VENDOR");
        await page.locator(".workspace-header .account-menu > summary").click();
        await expect(page.locator(".workspace-header").getByRole("button", { name: "Logout", exact: true })).toBeVisible();
        await page.locator(".workspace-header .account-menu > summary").click();

        for (const sectionName of ["Project Progress", "Invoice Overview", "Commercial lifecycle", "Recent Activity"]) {
          await page.getByRole("heading", { name: sectionName }).scrollIntoViewIfNeeded();
          const headerBox = await page.locator(".workspace-header").boundingBox();
          expect(headerBox.y, `sticky header position near ${sectionName}`).toBeGreaterThanOrEqual(0);
          expect(headerBox.y, `sticky header position near ${sectionName}`).toBeLessThanOrEqual(1);
        }

        const overflow = await page.evaluate(() => ({
          body: getComputedStyle(document.body).overflowY,
          workspaceBody: getComputedStyle(document.querySelector(".workspace-body")).overflowY,
          workspaceContent: getComputedStyle(document.querySelector(".workspace-content")).overflowY,
        }));
        expect(["auto", "scroll"]).not.toContain(overflow.workspaceBody);
        expect(["auto", "scroll"]).not.toContain(overflow.workspaceContent);
      }
    } else {
      await expect(page.locator(".workspace-sidebar")).toBeHidden();
      await expect(page.locator(".mobile-navigation > summary")).toContainText("Browse workspace");
    }

    if (width === 1440 || width === 390) {
      await page.screenshot({ path: testInfo.outputPath(`vendor-overview-${width}x${height}.png`), fullPage: true });
    }
  }
});

test("fifty projects and activities remain concise on Overview", async ({ page }, testInfo) => {
  await mockVendorOverview(page, dashboard(50, 50, 50, 50));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/vendor");

  await expect(page.getByTestId("vendor-project-preview").getByRole("progressbar")).toHaveCount(3);
  await expect(page.getByTestId("vendor-company-earnings").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("vendor-contractor-earnings").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("vendor-activity-preview").getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "View all activity" })).toBeVisible();
  await expectNoHorizontalOverflow(page, 1366, 768);

  await page.screenshot({ path: testInfo.outputPath("vendor-overview-high-volume-collapsed.png"), fullPage: true });

  await page.getByRole("button", { name: "Show all projects" }).click();
  await expect(page.getByTestId("vendor-project-preview").getByRole("progressbar")).toHaveCount(50);
  await expect(page.getByRole("button", { name: "Show fewer projects" })).toHaveAttribute("aria-expanded", "true");
  await expectNoHorizontalOverflow(page, 1366, 768);
  await page.screenshot({ path: testInfo.outputPath("vendor-overview-projects-expanded.png"), fullPage: true });

  await page.getByRole("button", { name: "Show all companies" }).click();
  await expect(page.getByTestId("vendor-company-earnings").getByRole("listitem")).toHaveCount(50);
  await expect(page.getByTestId("vendor-contractor-earnings").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Show fewer projects" })).toBeVisible();

  await page.getByRole("button", { name: "Show all contractors" }).click();
  await expect(page.getByTestId("vendor-contractor-earnings").getByRole("listitem")).toHaveCount(50);
  await expect(page.getByTestId("vendor-project-preview").getByRole("progressbar")).toHaveCount(50);
  await expectNoHorizontalOverflow(page, 1366, 768);
  await page.screenshot({ path: testInfo.outputPath("vendor-overview-multiple-expanded.png"), fullPage: true });
});
