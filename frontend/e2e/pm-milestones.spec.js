import { expect, test } from "@playwright/test";

const projects = [
  { id: 1, name: "Atlas Legacy Migration", approved_hours: 25, expected_hours: 80, allocated_hours: 0, work_progress_percent: 31.3 },
  { id: 2, name: "Atlas Mobile Expansion", approved_hours: 6, expected_hours: 100, allocated_hours: 40, work_progress_percent: 6 },
];

const contractors = [{ contractor_id: 11, name: "Harper Backend", assignment_status: "RELEASED", allocated_hours: 80, approved_hours: 25, remaining_hours: 55 }];
const milestones = [{ id: 21, name: "Atlas Migration Completion", sequence_order: 1, due_date: "2026-06-30", description: "Historical completed-project billing.", threshold_hours: 20, status: "MET", met_at: "2026-09-09 12:00:00", contributions: [{ contractor_id: 11, contractor_name: "Harper Backend", approved_hours: 20, billing_amount: 5000 }] }];

async function mockMilestones(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh") || pathname.endsWith("/auth/me")) return route.fulfill({ json: { token: "pm-token", user: { id: 7, name: "Demo PM", role: "PM" } } });
    if (pathname.endsWith("/pm/projects")) return route.fulfill({ json: { items: projects, total: 2, total_pages: 1 } });
    if (pathname.endsWith("/pm/projects/1/contractors")) return route.fulfill({ json: contractors });
    if (pathname.endsWith("/pm/projects/2/contractors")) return route.fulfill({ json: [] });
    if (pathname.endsWith("/pm/milestones/1")) return route.fulfill({ json: milestones });
    if (pathname.endsWith("/pm/milestones/2")) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

test("PM Milestones stays compact and contained across supported viewports", async ({ page }) => {
  await mockMilestones(page);

  for (const [width, height] of [[1920, 1080], [1536, 864], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/pm/milestones");

    await expect(page.getByRole("heading", { name: "Milestones & Billing" })).toBeVisible();
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue("1");
    await expect(page.getByText("Allocated 80h · Approved 25h · Remaining 55h")).toBeVisible();
    await expect(page.getByText("Scroll horizontally to view all columns when needed.")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();

    if (width >= 768) {
      const tableRegion = page.getByRole("region", { name: "Milestone Table" });
      await expect(tableRegion).toBeVisible();
      await expect(tableRegion.getByText("Atlas Migration Completion")).toBeVisible();
    } else {
      await expect(page.getByRole("article").filter({ hasText: "Atlas Migration Completion" })).toBeVisible();
    }

    await page.getByRole("button", { name: "Create Milestone" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Milestone" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Milestone Name/)).toBeFocused();
    await expect(dialog.getByLabel(/Description/)).toBeVisible();
    await expect(dialog.getByLabel(/Hours Threshold/)).toBeVisible();
    const panelMetrics = await dialog.locator(".ui-modal-panel").evaluate((panel) => ({
      width: panel.getBoundingClientRect().width,
      height: panel.getBoundingClientRect().height,
    }));
    expect(panelMetrics.width).toBeLessThanOrEqual(Math.min(800, width - 32) + 1);
    expect(panelMetrics.height).toBeLessThanOrEqual(height - 32);
    if (width >= 768 && height >= 720) {
      const bodyScroll = await dialog.getByTestId("create-milestone-body").evaluate((body) => ({ clientHeight: body.clientHeight, scrollHeight: body.scrollHeight }));
      expect(bodyScroll.scrollHeight).toBeLessThanOrEqual(bodyScroll.clientHeight);
    }
    await dialog.getByRole("button", { name: "Cancel" }).click();
  }

  await page.getByLabel("Project", { exact: true }).selectOption("2");
  await expect(page.getByText("No milestones yet for this project.")).toBeVisible();
});
