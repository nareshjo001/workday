import { expect, test } from "@playwright/test";

const projects = [
  { id: 1, name: "Atlas Commerce Modernization", company_name: "Atlas Commerce", status: "ACTIVE", staffing_status: "PENDING", start_date: "2026-07-01", end_date: "2026-12-31", approved_hours: 80, expected_hours: 240, work_progress_percent: 33.3, total_assigned: 3, total_required: 4, allocated_hours: 240, hours_staffing_status: "FULLY_STAFFED", requirements: [
    { id: 11, skill: "BACKEND", required_count: 1, assigned_count: 0, status: "OPEN", description: "Backend delivery capacity" },
    { id: 12, skill: "FRONTEND", required_count: 1, assigned_count: 1, status: "OPEN", description: "Frontend delivery capacity" },
    { id: 13, skill: "QA", required_count: 2, assigned_count: 2, status: "OPEN", description: "QA delivery capacity" },
  ] },
  { id: 2, name: "Atlas Mobile Expansion", company_name: "Atlas Commerce", status: "ON_HOLD", staffing_status: "PENDING", start_date: "2026-07-01", end_date: "2026-12-31", approved_hours: 6, expected_hours: 100, work_progress_percent: 6, total_assigned: 1, total_required: 2, allocated_hours: 100, hours_staffing_status: "FULLY_STAFFED", requirements: [] },
  { id: 3, name: "Atlas Legacy Migration", company_name: "Atlas Commerce", status: "COMPLETED", staffing_status: "PENDING", start_date: "2026-04-01", end_date: "2026-06-30", approved_hours: 25, expected_hours: 80, work_progress_percent: 31.3, total_assigned: 0, total_required: 2, allocated_hours: 0, hours_staffing_status: "PENDING", requirements: [] },
  { id: 4, name: "Not in dashboard preview", company_name: "Atlas Commerce", status: "ACTIVE", staffing_status: "PENDING", start_date: "2026-07-01", end_date: "2026-12-31", approved_hours: 12, expected_hours: 120, work_progress_percent: 10, total_assigned: 1, total_required: 2, allocated_hours: 40, hours_staffing_status: "PENDING", requirements: [] },
];

const dashboard = {
  summary: { active_projects: 2, active_contractors: 4, completed_projects: 1, pending_staffing_projects: 2, overall_progress_percent: 25.6 }, projects,
  invoices: { pending_review_count: 0, approved_count: 3, approved_total: 20210, rejected_count: 1, rejected_total: 5000 }, milestones: { pending: 1, met: 7, with_billing_generated: 7 },
  completion_analytics: { completed_projects: 1, average_completion_percent: 31.3, approaching_end_date_count: 0, past_end_date_still_active_count: 0 },
  m20: { time: { approved_hours: 92 }, financial: { budget: 126000, submitted_invoice_amount: 1260, approved_invoice_amount: 22210, paid_amount: 2210, outstanding_amount: 20000, overdue_amount: 0, pending_invoice_reviews: 1 } }, recent_activity: [],
};

const projectControl = {
  contract_version: "1",
  project: { id: 1, name: "Atlas Commerce Modernization", status: "ACTIVE" },
  summary: { attention_count: 2, by_severity: { HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 1 } },
  findings: [
    { code: "PROJECT_NOT_READY_TO_CLOSE", severity: "HIGH", title: "Project is not ready to close", summary: "Resolve current project-close blockers.", evidence: [{ key: "count", label: "Close blockers", value: 2 }], recommended_action: "Resolve the listed blockers before completion.", source: { engine: "pm_project_control", version: "1" } },
    { code: "OPEN_REQUIREMENTS_REMAIN", severity: "INFO", title: "Project requirements remain open", summary: "One requirement has unfilled slots.", evidence: [{ key: "remaining", label: "Remaining slots", value: 1 }], recommended_action: "Review staffing requirements.", source: { engine: "pm_project_control", version: "1" } },
  ],
};

async function mockPm(page) {
  let controlRequests = 0;
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh") || pathname.endsWith("/auth/me")) return route.fulfill({ json: { token: "pm-token", user: { id: 7, name: "Demo PM", role: "PM" } } });
    if (pathname.endsWith("/pm/dashboard")) return route.fulfill({ json: dashboard });
    if (pathname.endsWith("/pm/projects")) return route.fulfill({ json: { items: projects, total_pages: 1, total: projects.length } });
    if (pathname.endsWith("/intelligence/capabilities")) return route.fulfill({ json: {
      intelligence_contract_version: "1",
      capabilities: {
        vendor_rate_intelligence: false,
        pm_project_control: true,
        contractor_timesheet_intelligence: false,
        ai_explanations: false,
      },
    } });
    if (pathname.endsWith("/pm/projects/1/control-intelligence")) { controlRequests += 1; return route.fulfill({ json: projectControl }); }
    if (pathname.endsWith("/pm/projects/1/activity")) return route.fulfill({ json: { project: projects[0], items: [], pagination: { page: 1, limit: 25, total: 0, total_pages: 1 } } });
    return route.fulfill({ json: {} });
  });
  return { getControlRequests: () => controlRequests };
}

test("PM Projects renders the full project-card collection while PM Overview has no project cards", async ({ page }) => {
  const requests = await mockPm(page);
  await page.goto("/pm");
  await expect(page.getByRole("heading", { name: "Project Progress Overview" })).toHaveCount(0);
  await expect(page.getByTestId("pm-project-preview-grid")).toHaveCount(0);
  await page.goto("/pm/projects");
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const cards = page.getByTestId("pm-project-preview-grid").getByRole("article");
    await expect(cards).toHaveCount(4);
    await expect(cards.getByRole("heading")).toHaveText(projects.map((project) => project.name));
    await expect(page.getByTestId("pm-project-preview-grid").getByText("View Details")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const trigger = page.getByRole("button", { name: "Project actions for Atlas Commerce Modernization" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Atlas Commerce Modernization actions" });
  await expect(menu.getByRole("menuitem")).toHaveText(["Settings", "Requirements", "Project Control", "Activity"]);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await trigger.click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Project settings: Atlas Commerce Modernization" });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByRole("heading", { name: "Basic information" })).toBeVisible();
  await expect(settingsDialog.getByRole("heading", { name: "Timeline & effort" })).toBeVisible();
  await expect(settingsDialog.getByRole("heading", { name: "Budget & limits" })).toBeVisible();
  await expect(settingsDialog.getByRole("heading", { name: "Additional settings" })).toBeVisible();

  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const nameBox = await settingsDialog.getByLabel("Name").boundingBox();
    const descriptionBox = await settingsDialog.getByLabel("Description").boundingBox();
    expect(descriptionBox.y).toBeGreaterThan(nameBox.y + nameBox.height);
    expect(Math.abs(descriptionBox.x - nameBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(descriptionBox.width - nameBox.width)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await expect(settingsDialog.getByRole("button", { name: "Save settings" })).toBeInViewport();
  }

  await settingsDialog.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });

  await trigger.click();
  await menu.getByRole("menuitem", { name: "Requirements" }).click();
  const requirementsDialog = page.getByRole("dialog", { name: "Staffing requirements: Atlas Commerce Modernization" });
  await expect(requirementsDialog.getByTestId(/requirement-card-/)).toHaveCount(3);
  await expect(requirementsDialog.getByText(/Add role|Add requirement/i)).toHaveCount(0);
  await expect(requirementsDialog.getByRole("button", { name: /remove|delete/i })).toHaveCount(0);
  await expect(requirementsDialog.getByRole("button", { name: "Save requirements" })).toBeVisible();
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await expect(requirementsDialog.getByRole("button", { name: "Save requirements" })).toBeInViewport();
  }
  await requirementsDialog.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });

  const cardBeforeControl = await page.getByRole("article", { name: "Atlas Commerce Modernization" }).boundingBox();
  await trigger.click();
  await menu.getByRole("menuitem", { name: "Project Control" }).click();
  const controlDialog = page.getByRole("dialog", { name: "Project Control" });
  await expect(controlDialog).toBeVisible();
  await expect(controlDialog.getByText("Atlas Commerce Modernization · ACTIVE")).toBeVisible();
  await expect(controlDialog.getByText("Attention Summary")).toBeVisible();
  await expect(controlDialog.locator(".project-control-summary-card")).toHaveCount(4);
  await expect(controlDialog.locator(".project-control-severity-pill").first()).toContainText("Severity:");
  await expect(controlDialog.locator(".project-control-severity-icon").first()).toBeVisible();
  expect(await controlDialog.locator(".project-control-modal-body").evaluate((element) => element.scrollTop)).toBe(0);
  const cardDuringControl = await page.getByRole("article", { name: "Atlas Commerce Modernization" }).boundingBox();
  expect(cardDuringControl.x).toBe(cardBeforeControl.x);
  expect(cardDuringControl.y).toBe(cardBeforeControl.y);
  expect(requests.getControlRequests()).toBe(1);
  await controlDialog.getByRole("button", { name: "Refresh attention" }).click();
  await expect.poll(requests.getControlRequests).toBe(2);
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const bounds = await controlDialog.locator(".ui-modal-panel").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.width).toBeLessThanOrEqual(Math.min(width, 720) + 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(controlDialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });

  await trigger.click();
  await menu.getByRole("menuitem", { name: "Activity" }).click();
  await expect(page).toHaveURL(/\/pm\/projects/);
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
});
