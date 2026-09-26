import { expect, test } from "@playwright/test";
import path from "path";

const ARTIFACT_DIR = "C:/Users/nares/.gemini/antigravity/brain/e8b12318-b2ec-417d-88d3-0027d54165a0";

const mockProjects = [
  {
    id: 1,
    project_name: "Atlas Commerce Modernization",
    project_status: "ACTIVE",
    assignment_status: "ACTIVE",
    allocated_hours: 120,
    approved_hours: 80,
    pending_hours: 10,
    remaining_hours: 30,
  },
];

const mockTimesheets = [
  {
    id: 101,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-15",
    hours_logged: 6.5,
    description: "Checkout flow optimizations and state synchronization debugging",
    status: "APPROVED",
    submitted_at: "2026-09-15 18:00:00",
    reviewed_at: "2026-09-15 20:30:00",
    reviewer_name: "Sarah PM",
  },
  {
    id: 102,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-16",
    hours_logged: 5.0,
    description: "Stripe payment webhook handler and idempotency fixes",
    status: "SUBMITTED",
    submitted_at: "2026-09-16 17:45:00",
    reviewed_at: null,
    reviewer_name: null,
  },
  {
    id: 103,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-17",
    hours_logged: 7.0,
    description: "",
    status: "DRAFT",
    submitted_at: null,
    reviewed_at: null,
    reviewer_name: null,
  },
  {
    id: 104,
    project_id: 1,
    project_name: "Atlas Commerce Modernization",
    work_date: "2026-09-18",
    hours_logged: 4.5,
    description: "Database migration script and schema index tuning",
    status: "REJECTED",
    submitted_at: "2026-09-18 16:30:00",
    reviewed_at: "2026-09-18 18:15:00",
    reviewer_name: "Sarah PM",
    rejection_reason: "Please link the Jira ticket and specify the affected tables.",
  },
];

async function setupMocks(page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith("/auth/refresh")) {
      return route.fulfill({
        json: {
          token: "contractor-visual-token",
          user: { id: 3, name: "Demo Contractor", email: "demo.contractor@workday.local", role: "CONTRACTOR" },
        },
      });
    }

    if (url.pathname.endsWith("/auth/me")) {
      return route.fulfill({
        json: {
          user: { id: 3, name: "Demo Contractor", email: "demo.contractor@workday.local", role: "CONTRACTOR" },
        },
      });
    }

    if (url.pathname.includes("/intelligence/capabilities")) {
      return route.fulfill({
        json: {
          intelligence_contract_version: "1.0",
          capabilities: {
            vendor_rate_intelligence: true,
            pm_project_control: true,
            contractor_timesheet_intelligence: true,
            ai_explanations: true,
          },
        },
      });
    }

    if (url.pathname.includes("/contractor/timesheet-intelligence/analyze")) {
      return route.fulfill({
        json: {
          contract_version: "1",
          context: {
            assignment_id: 1,
            project: { id: 1, name: "Atlas Commerce Modernization" },
            work_date: "2026-09-15",
            hours: 8,
          },
          summary: {
            finding_count: 0,
            by_severity: { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
          },
          findings: [],
        },
      });
    }

    if (url.pathname.endsWith("/contractor/projects")) {
      return route.fulfill({
        json: [
          {
            id: 1,
            name: "Atlas Commerce Modernization",
            project_start_date: "2026-01-01",
            project_end_date: null,
            project_status: "ACTIVE",
            assignment_status: "ACTIVE",
            allocated_hours: 120,
            approved_hours: 80,
            pending_hours: 10,
            remaining_hours: 30,
          },
        ],
      });
    }

    if (url.pathname.endsWith("/contractor/timesheets") && route.request().method() === "GET") {
      return route.fulfill({
        json: {
          items: mockTimesheets,
          total_weeks: 4,
          total_pages: 1,
          page: 1,
          page_size: 5,
        },
      });
    }

    return route.fulfill({ status: 200, json: {} });
  });
}

test("Contractor Timesheets Redesign visual and interaction verification", async ({ page }) => {
  await setupMocks(page);

  const viewports = [
    { width: 1920, height: 1080, name: "desktop_1920x1080" },
    { width: 1366, height: 768, name: "desktop_1366x768" },
    { width: 1280, height: 720, name: "desktop_1280x720" },
    { width: 768, height: 1024, name: "tablet_768x1024" },
    { width: 390, height: 844, name: "mobile_390x844" },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:5173/contractor/timesheets");
    await expect(page.getByRole("heading", { name: "Timesheets", level: 1 })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `Horizontal overflow detected at ${vp.width}x${vp.height}`).toBe(false);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `contractor_timesheets_${vp.name}.png`),
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("http://localhost:5173/contractor/timesheets");

  const editButtons = page.locator('button[aria-label="Edit"]');
  await expect(editButtons).toHaveCount(2);

  await editButtons.nth(1).click();
  const draftModalTitle = page.getByRole("heading", { name: "Edit Draft Log" });
  await expect(draftModalTitle).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(draftModalTitle).not.toBeVisible();

  await editButtons.first().click();
  const editModalTitle = page.getByRole("heading", { name: "Edit Rejected Log" });
  await expect(editModalTitle).toBeVisible();

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "contractor_timesheets_edit_modal.png"),
    fullPage: false,
  });

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(editModalTitle).not.toBeVisible();

  await page.getByRole("button", { name: /Log Hours/i }).click();
  const logModalTitle = page.getByRole("heading", { name: "Log Hours" });
  await expect(logModalTitle).toBeVisible();

  await page.locator("#projectId").selectOption("1");
  await page.locator("#workDate").fill("2026-09-15");
  await page.locator("#hoursLogged").fill("8");
  await page.locator("#description").fill("Implemented checkout performance improvements and tested cart state.");

  const checkBtn = page.getByRole("button", { name: "Check before submitting" });
  await expect(checkBtn).toBeVisible();
  await checkBtn.click();
  await expect(page.getByText("No current timesheet intelligence findings")).toBeVisible();

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "contractor_timesheets_log_modal_1280x720.png"),
    fullPage: false,
  });

  const modalViewports = [
    { width: 1920, height: 1080, name: "desktop_1920x1080" },
    { width: 1536, height: 864, name: "desktop_1536x864" },
    { width: 1366, height: 768, name: "desktop_1366x768" },
    { width: 1280, height: 720, name: "desktop_1280x720" },
    { width: 1024, height: 768, name: "desktop_1024x768" },
    { width: 768, height: 1024, name: "tablet_768x1024" },
    { width: 390, height: 844, name: "mobile_390x844" },
    { width: 360, height: 800, name: "mobile_360x800" },
  ];

  for (const mvp of modalViewports) {
    await page.setViewportSize({ width: mvp.width, height: mvp.height });
    await expect(logModalTitle).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `contractor_timesheets_log_modal_${mvp.name}.png`),
      fullPage: false,
    });
  }

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(logModalTitle).not.toBeVisible();
});
