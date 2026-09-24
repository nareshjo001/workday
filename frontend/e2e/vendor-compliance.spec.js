import { expect, test } from "@playwright/test";

const contractors = [
  { id: 1, name: "Avery Frontend" },
  { id: 2, name: "Morgan DevOps" },
];

const compliance = {
  compliance: { status: "NOT_VERIFIED", missing_document_types: ["TAX"] },
  documents: [
    { id: 11, document_type: "IDENTITY", original_filename: "avery-identity-document.pdf", expiry_date: "2027-08-31", status: "VERIFIED", rejection_reason: null },
    { id: 12, document_type: "TAX", original_filename: "tax-declaration-2026.png", expiry_date: null, status: "PENDING", rejection_reason: null },
    { id: 13, document_type: "QUALIFICATION", original_filename: "frontend-qualification-certificate.jpg", expiry_date: null, status: "REJECTED", rejection_reason: "Replacement requested" },
  ],
};

async function mockPage(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh")) return route.fulfill({ json: { token: "compliance-test-token", user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/vendor/contractors/1/documents") || pathname.endsWith("/vendor/contractors/2/documents")) return route.fulfill({ json: compliance });
    if (pathname.endsWith("/vendor/contractors")) return route.fulfill({ json: { items: contractors, total: contractors.length, page: 1, page_size: 100 } });
    if (pathname.includes("/vendor/contractor-documents/") && route.request().method() === "PATCH") return route.fulfill({ json: { id: 12, status: "VERIFIED" } });
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

async function expectNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

test("Vendor Compliance stays compact across desktop, tablet, and mobile", async ({ page }, testInfo) => {
  await mockPage(page);
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/compliance");
    await expect(page.getByRole("heading", { name: "Contractor Compliance", exact: true })).toBeVisible();
    await expect(page.getByLabel("Select contractor")).toHaveValue("1");
    await expect(page.getByText("Status: NOT_VERIFIED")).toBeVisible();
    await expect(page.getByText("Accepted formats: PDF, PNG, JPEG (maximum 5 MB)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload document", exact: true })).toBeVisible();
    if (width >= 1280) {
      const mainRow = page.getByTestId("compliance-upload-main-row");
      const boxes = await Promise.all(["compliance-document-type", "compliance-expiry-date", "compliance-file", "compliance-upload-button"].map((id) => page.getByTestId(id).boundingBox()));
      expect(await mainRow.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).not.toBe("none");
      expect(Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y + box.height))).toBeLessThan(3);
    }
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeAttached();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByRole("table").locator('[aria-label*="menu" i], [aria-label*="more" i]')).toHaveCount(0);
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`vendor-compliance-${width}x${height}.png`), fullPage: true });
  }
});

test("desktop sidebar transitions preserve the Compliance layout", async ({ page }) => {
  await mockPage(page);
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/compliance");
    const expand = page.getByRole("button", { name: "Expand sidebar" });
    if (await expand.count()) await expand.click();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expectNoPageOverflow(page);
  }
});
