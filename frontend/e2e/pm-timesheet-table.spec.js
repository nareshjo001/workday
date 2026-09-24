import { expect, test } from "@playwright/test";

const timesheet = {
  id: 101,
  project_id: 1,
  project_name: "Atlas Commerce Modernization",
  contractor_id: 201,
  contractor_name: "Quinn QA",
  contractor_skill: "QA",
  work_date: "2026-09-02",
  hours_logged: 5,
  submitted_at: "2026-09-09 21:37:00",
};

async function mockPmTimesheets(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh") || pathname.endsWith("/auth/me")) {
      return route.fulfill({ json: { token: "pm-timesheet-token", user: { id: 7, name: "Demo PM", role: "PM" } } });
    }
    if (pathname.endsWith("/pm/timesheets/pending")) {
      return route.fulfill({ json: { items: [timesheet], total: 1, page: 1, page_size: 10, total_pages: 1 } });
    }
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

test("PM timesheet desktop columns keep the checkbox compact and review actions visible", async ({ page }, testInfo) => {
  await mockPmTimesheets(page);

  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/pm/timesheets");

    const table = page.locator("table.pm-timesheets-table");
    await expect(table).toBeVisible();
    const row = table.locator("tbody tr").first();
    const checkbox = row.getByRole("checkbox");
    const contractor = row.getByText("Quinn QA");
    const approve = row.getByRole("button", { name: "Approve" });
    const reject = row.getByRole("button", { name: "Reject" });
    await expect(approve).toBeInViewport();
    await expect(reject).toBeInViewport();

    const checkboxBox = await checkbox.boundingBox();
    const contractorBox = await contractor.boundingBox();
    const approveBox = await approve.boundingBox();
    const rejectBox = await reject.boundingBox();
    const checkboxToContractorGap = contractorBox.x - (checkboxBox.x + checkboxBox.width);

    expect(checkboxToContractorGap).toBeGreaterThanOrEqual(16);
    expect(checkboxToContractorGap).toBeLessThanOrEqual(24);
    expect(Math.abs(approveBox.y - rejectBox.y)).toBeLessThanOrEqual(1);
    expect(approveBox.x + approveBox.width).toBeLessThan(rejectBox.x);
    expect(await table.evaluate((element) => element.parentElement.scrollWidth <= element.parentElement.clientWidth)).toBeTruthy();

    if (width === 1280) {
      await testInfo.attach("pm-timesheet-table-1280x720", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
  }
});
