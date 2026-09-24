import { test, expect } from "@playwright/test";

const desktopSizes = [
  [1920, 1080],
  [1536, 864],
  [1440, 900],
  [1366, 768],
  [1280, 720],
];

const compactSizes = [
  [768, 1024],
  [390, 844],
  [360, 800],
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: { code: "UNAUTHORIZED" } }),
  );
});

test("login stays viewport-fitted on common desktop and laptop screens", async ({ page }) => {
  for (const [width, height] of desktopSizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Contingent Workforce Management/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeInViewport();
    await expect(page.getByRole("link", { name: "Request access" })).toBeInViewport();

    const overflow = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
    }));
    expect(overflow.pageWidth, `horizontal overflow at ${width}×${height}`).toBeLessThanOrEqual(width + 1);
    expect(overflow.pageHeight, `vertical overflow at ${width}×${height}`).toBeLessThanOrEqual(height + 1);
  }
});

test("login remains usable and contained on tablet and mobile", async ({ page }) => {
  for (const [width, height] of compactSizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/login");

    await expect(page.getByLabel("Email address")).toBeInViewport();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeInViewport();
    await expect(page.getByRole("link", { name: "Request access" })).toBeInViewport();

    const overflow = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
    }));
    expect(overflow.pageWidth, `horizontal overflow at ${width}×${height}`).toBeLessThanOrEqual(width + 1);
    expect(overflow.pageHeight, `vertical overflow at ${width}×${height}`).toBeLessThanOrEqual(height + 1);
  }
});

async function expectNoDocumentOverflow(page, width, height, context) {
  const dimensions = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth, `${context} horizontal overflow at ${width}×${height}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.scrollHeight, `${context} vertical overflow at ${width}×${height}`).toBeLessThanOrEqual(dimensions.clientHeight + 1);
}

async function expectSignupControls(page) {
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByText("Vendor", { exact: true })).toBeVisible();
  await expect(page.getByText("Project Manager", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Log in" })).toBeInViewport();
}

test("vendor signup stays viewport-fitted on common desktop and laptop screens", async ({ page }) => {
  for (const [width, height] of desktopSizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/signup");
    await expectSignupControls(page);
    await expect(page.getByLabel("Full name")).toBeInViewport();
    await expect(page.getByLabel("Work email")).toBeInViewport();
    await expect(page.getByLabel("Confirm password")).toBeInViewport();
    await expectNoDocumentOverflow(page, width, height, "Vendor signup");
  }
});

test("project manager signup including company stays fitted on common desktop and laptop screens", async ({ page }) => {
  for (const [width, height] of desktopSizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/signup");
    await page.getByText("Project Manager", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /^Project Manager/ })).toBeChecked();
    await expect(page.getByLabel("Client company")).toBeInViewport();
    await expectSignupControls(page);
    await expectNoDocumentOverflow(page, width, height, "Project Manager signup");
  }
});

test("signup remains usable without horizontal overflow on tablet and mobile", async ({ page }) => {
  for (const [width, height] of compactSizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/signup");
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await page.getByRole("button", { name: "Create account" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Create account" })).toBeInViewport();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth, `Signup horizontal overflow at ${width}×${height}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});
