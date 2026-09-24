import path from "node:path";
import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1440, height: 900, capture: true },
  { width: 1280, height: 720, capture: true },
  { width: 768, height: 1024, capture: false },
  { width: 390, height: 844, capture: true },
  { width: 360, height: 800, capture: false },
];

const clientList = {
  items: [
    {
      id: 1,
      name: "Atlas Commerce",
      pm_contacts: "Demo PM — Atlas",
      status: "Active",
      active_projects: 2,
      open_requirements: 4,
      deployed_contractors: 4,
      recent_projects: [
        { id: 101, name: "Atlas Commerce Modernization", status: "ACTIVE", open_requirements: 3, deployed_contractors: 3 },
        { id: 102, name: "Demo Platform Upgrade", status: "ACTIVE", open_requirements: 1, deployed_contractors: 1 },
      ],
    },
  ],
};

const clientDetail = {
  company: { id: 1, name: "Atlas Commerce" },
  pm_contacts: [{ id: 10, name: "Demo PM — Atlas", email: "demo.pm@workday.local" }],
  active_projects: clientList.items[0].recent_projects,
};

async function mockVendorClients(page, detail = clientDetail, list = clientList) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh")) {
      await route.fulfill({ json: { token: "vendor-client-dialog-token", user: { id: 9, name: "Demo Vendor", role: "VENDOR" } } });
      return;
    }
    if (pathname.endsWith("/auth/me")) {
      await route.fulfill({ json: { user: { id: 9, name: "Demo Vendor", role: "VENDOR" } } });
      return;
    }
    if (pathname.endsWith("/vendor/clients/1")) {
      await route.fulfill({ json: detail });
      return;
    }
    if (pathname.endsWith("/vendor/clients")) {
      await route.fulfill({ json: list });
      return;
    }
    await route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

for (const viewport of viewports) {
  test(`Vendor Client Detail is compact and informational at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockVendorClients(page);
    await page.goto("/vendor/clients");
    await page.getByRole("button", { name: "View client detail" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Atlas Commerce" })).toBeVisible();
    await expect(dialog.getByText("Client details and active projects")).toBeVisible();
    await expect(dialog.getByTestId("client-detail-avatar")).toHaveText("AC");
    await expect(dialog.getByText("Demo PM — Atlas")).toBeVisible();
    await expect(dialog.getByText("demo.pm@workday.local")).toBeVisible();

    const projectRows = dialog.getByTestId("client-detail-projects").getByRole("listitem");
    await expect(projectRows).toHaveCount(2);
    await expect(projectRows.first().getByText("3 open requirements")).toBeVisible();
    await expect(projectRows.nth(1).getByText("1 deployed contractor")).toBeVisible();
    await expect(projectRows.locator("button, a, polyline")).toHaveCount(0);

    const beforeClickUrl = page.url();
    await projectRows.first().click();
    await expect(dialog).toBeVisible();
    expect(page.url()).toBe(beforeClickUrl);
    expect(await projectRows.first().evaluate((row) => getComputedStyle(row).cursor)).not.toBe("pointer");

    const dimensions = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      dialog: document.querySelector('[role="dialog"]')?.getBoundingClientRect().toJSON(),
    }));
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    expect(dimensions.dialog.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.dialog.right).toBeLessThanOrEqual(viewport.width);
    expect(dimensions.dialog.top).toBeGreaterThanOrEqual(0);
    expect(dimensions.dialog.bottom).toBeLessThanOrEqual(viewport.height);

    const bodyOverflow = await dialog.getByTestId("client-detail-content").evaluate((body) => ({
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
    }));
    expect(bodyOverflow.scrollHeight).toBeLessThanOrEqual(bodyOverflow.clientHeight + 1);
    if (viewport.width >= 1280) expect(dimensions.dialog.width).toBeLessThanOrEqual(720);
    if (viewport.width === 1440) expect(dimensions.dialog.height).toBeLessThan(520);

    if (viewport.capture) {
      await page.screenshot({
        path: path.resolve("test-results", `vendor-client-detail-${viewport.width}x${viewport.height}.png`),
        fullPage: false,
      });
    }
  });
}

const cardViewports = viewports.filter(({ width }) => width !== 360);

for (const viewport of cardViewports) {
  test(`Vendor Client cards expand recent projects independently at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const projects = (clientId, count) => Array.from({ length: count }, (_, index) => ({
      id: clientId * 100 + index + 1,
      name: `Client ${clientId} Project ${index + 1}`,
      status: "ACTIVE",
      open_requirements: index + 1,
      deployed_contractors: index + 1,
    }));
    const list = {
      items: [
        { ...clientList.items[0], id: 1, name: "Atlas Commerce", recent_projects: projects(1, 10) },
        { ...clientList.items[0], id: 2, name: "Nova Digital", recent_projects: projects(2, 3) },
      ],
    };
    await page.setViewportSize(viewport);
    await mockVendorClients(page, clientDetail, list);
    await page.goto("/vendor/clients");

    const atlas = page.getByTestId("client-card-1");
    const nova = page.getByTestId("client-card-2");
    const atlasRows = atlas.locator('[data-testid^="recent-project-"]:not([data-testid="recent-project-preview"]):not([data-testid="recent-project-extra"]):not([data-testid="recent-project-viewport"]):not([data-testid="recent-project-control-slot"])');
    await expect(atlas.getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "true");
    await expect(nova.getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "true");
    await expect(atlas.getByRole("button", { name: "Show all projects" })).toHaveAttribute("aria-expanded", "false");

    await atlas.getByRole("button", { name: "Show all projects" }).click();
    await expect(atlas.getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "false");
    await expect(atlasRows).toHaveCount(10);
    await expect(nova.getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "true");
    await expect(atlas.locator(".overflow-y-auto")).toHaveCount(0);
    await expect(atlasRows.first().locator("button, a")).toHaveCount(0);
    await page.waitForTimeout(280);

    const [atlasBox, novaBox, lastProjectBox, detailButtonBox] = await Promise.all([
      atlas.boundingBox(),
      nova.boundingBox(),
      atlasRows.last().boundingBox(),
      atlas.getByTestId("view-client-detail-button").boundingBox(),
    ]);
    expect(atlasBox.height).toBeGreaterThan(novaBox.height);
    expect(detailButtonBox.y).toBeGreaterThan(lastProjectBox.y + lastProjectBox.height);
    expect(await page.locator("[data-testid=clients-grid]").evaluate((grid) => getComputedStyle(grid).alignItems)).toBe("flex-start");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);

    await atlas.getByRole("button", { name: "Show less" }).click();
    await expect(atlas.getByTestId("recent-project-extra")).toHaveAttribute("aria-hidden", "true");
  });
}

test("Vendor Client Detail scrolls its body only when many projects require it", async ({ page }) => {
  const manyProjects = Array.from({ length: 18 }, (_, index) => ({
    id: 500 + index,
    name: `Operational Project ${index + 1}`,
    status: "ACTIVE",
    open_requirements: index + 1,
    deployed_contractors: index + 2,
  }));
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockVendorClients(page, { ...clientDetail, active_projects: manyProjects });
  await page.goto("/vendor/clients");
  await page.getByRole("button", { name: "View client detail" }).click();

  const dialog = page.getByRole("dialog");
  const body = dialog.getByTestId("client-detail-content");
  const overflow = await body.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
  await expect(dialog.getByTestId("close-detail-button")).toBeVisible();
  await expect(dialog.getByTestId("client-detail-projects").getByRole("listitem")).toHaveCount(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test("Vendor Client Detail closes from X, footer, and Escape", async ({ page }) => {
  await mockVendorClients(page);
  await page.goto("/vendor/clients");
  const open = page.getByRole("button", { name: "View client detail" });

  await open.click();
  await page.getByTestId("close-client-detail-icon").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await open.click();
  await page.getByTestId("close-detail-button").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await open.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

const desktopClientViewports = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900, capture: true },
  { width: 1366, height: 768 },
  { width: 1280, height: 720, capture: true },
];

function projectsForClient(clientId, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: clientId * 100 + index + 1,
    name: `Client ${clientId} Project ${index + 1}`,
    status: "ACTIVE",
    open_requirements: index + 1,
    deployed_contractors: index + 1,
  }));
}

const stabilityClientList = {
  items: [0, 1, 2, 10].map((count, index) => ({
    id: index + 1,
    name: `Client ${index + 1}`,
    pm_contacts: `PM ${index + 1}`,
    status: "Active",
    active_projects: count,
    open_requirements: count,
    deployed_contractors: count,
    recent_projects: projectsForClient(index + 1, count),
  })),
};

for (const viewport of desktopClientViewports) {
  test(`Clients cards and toolbar stay stable through sidebar toggle at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("vms_sidebar_collapsed", "false"));
    await mockVendorClients(page, clientDetail, stabilityClientList);
    await page.goto("/vendor/clients");

    const search = page.getByTestId("client-search-input");
    const sort = page.getByTestId("client-sort-select");
    const cards = page.locator('[data-testid^="client-card-"]');
    await expect(cards).toHaveCount(4);

    const expandedSidebar = await measureClientsLayout(page, search, sort, cards);
    expect(Math.max(...expandedSidebar.cardHeights.slice(0, 3)) - Math.min(...expandedSidebar.cardHeights.slice(0, 3))).toBeLessThanOrEqual(3);
    expect(Math.max(...expandedSidebar.detailOffsets.slice(0, 3)) - Math.min(...expandedSidebar.detailOffsets.slice(0, 3))).toBeLessThanOrEqual(3);
    expect(Math.abs(expandedSidebar.search.y - expandedSidebar.sort.y)).toBeLessThanOrEqual(2);
    expect(expandedSidebar.scrollWidth).toBeLessThanOrEqual(expandedSidebar.clientWidth + 1);

    if (viewport.capture) {
      await page.screenshot({ path: path.resolve("test-results", `vendor-clients-stability-${viewport.width}x${viewport.height}-sidebar-expanded.png`), fullPage: false });
    }

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.waitForTimeout(280);
    const collapsedSidebar = await measureClientsLayout(page, search, sort, cards);
    expect(Math.abs(collapsedSidebar.search.y - collapsedSidebar.sort.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(collapsedSidebar.search.y - expandedSidebar.search.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(collapsedSidebar.sort.y - expandedSidebar.sort.y)).toBeLessThanOrEqual(3);
    expect(collapsedSidebar.scrollWidth).toBeLessThanOrEqual(collapsedSidebar.clientWidth + 1);

    console.log(JSON.stringify({ viewport: `${viewport.width}x${viewport.height}`, expandedSidebar: { searchWidth: expandedSidebar.search.width, sortWidth: expandedSidebar.sort.width }, collapsedSidebar: { searchWidth: collapsedSidebar.search.width, sortWidth: collapsedSidebar.sort.width } }));

    if (viewport.capture) {
      await page.screenshot({ path: path.resolve("test-results", `vendor-clients-stability-${viewport.width}x${viewport.height}-sidebar-collapsed.png`), fullPage: false });
    }
  });
}

test("Clients toolbar stacks only on mobile and remains free of horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockVendorClients(page, clientDetail, stabilityClientList);
  await page.goto("/vendor/clients");

  const searchBox = await page.getByTestId("client-search-input").boundingBox();
  const sortBox = await page.getByTestId("client-sort-select").boundingBox();
  expect(sortBox.y).toBeGreaterThan(searchBox.y + searchBox.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.screenshot({ path: path.resolve("test-results", "vendor-clients-stability-390x844.png"), fullPage: false });
});

async function measureClientsLayout(page, search, sort, cards) {
  const [searchBox, sortBox, scrollMetrics] = await Promise.all([
    search.boundingBox(),
    sort.boundingBox(),
    page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })),
  ]);
  const cardHeights = [];
  const detailOffsets = [];
  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index);
    const [cardBox, detailBox] = await Promise.all([card.boundingBox(), card.getByTestId("view-client-detail-button").boundingBox()]);
    cardHeights.push(cardBox.height);
    detailOffsets.push(detailBox.y - cardBox.y);
  }
  return { search: searchBox, sort: sortBox, cardHeights, detailOffsets, ...scrollMetrics };
}
