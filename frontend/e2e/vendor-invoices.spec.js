import { expect, test } from "@playwright/test";

const item = { id: 81, contractor_name_snapshot: "Avery Frontend", skill_name_snapshot: "FRONTEND", approved_hours: 8, bill_rate: 180, amount: 1440 };
const invoices = [
  { id: 8, invoice_number: null, project_name: "Demo Platform Upgrade", generated_at: "2026-09-14 09:30:00", reviewed_at: null, status: "DRAFT", items: [item], amount: 1440, subtotal_amount: 1440, tax_rate: 10, tax_amount: 144, adjustment_amount: -20, total_amount: 1564, adjustments: [] },
  { id: 7, invoice_number: "INV-2026-000007", project_name: "Atlas Commerce Modernization", generated_at: "2026-09-13 09:30:00", reviewed_at: null, status: "SUBMITTED", items: [item], amount: 1440, subtotal_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, total_amount: 1440 },
  { id: 6, invoice_number: "INV-2026-000006", project_name: "Nova Analytics Platform", generated_at: "2026-09-12 09:30:00", reviewed_at: "2026-09-13 10:00:00", status: "APPROVED", items: [item], amount: 1440, subtotal_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, total_amount: 1440, payment_state: "UNPAID", paid_amount: 0, outstanding_amount: 1440, due_date: "2026-10-12", payments: [] },
  { id: 5, invoice_number: "INV-2026-000005", project_name: "Atlas Commerce Modernization", generated_at: "2026-09-11 09:30:00", reviewed_at: "2026-09-12 10:00:00", status: "REJECTED", rejection_reason: "Purchase order reference is missing.", items: [item], amount: 1440, subtotal_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, total_amount: 1440 },
  { id: 4, invoice_number: "INV-2026-000004", project_name: "Nova Customer Portal", generated_at: "2026-09-10 09:30:00", reviewed_at: "2026-09-11 10:00:00", status: "APPROVED", items: [item], amount: 3000, subtotal_amount: 3000, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, total_amount: 3000, payment_state: "PAID", paid_amount: 3000, outstanding_amount: 0, due_date: "2026-06-30", payments: [{ id: 1, amount: 3000, method: "BANK_TRANSFER", reference: "DEMO-NOVA-FULL-001", paid_at: "2026-07-01 10:00:00" }] },
];

async function mockPage(page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/refresh")) return route.fulfill({ json: { token: "invoice-test-token", user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { id: 9, name: "Demo Vendor", email: "vendor@example.com", role: "VENDOR" } } });
    if (pathname.endsWith("/vendor/billing-queue")) return route.fulfill({ json: { items: [{ milestone_billing_id: 91, milestone_name: "Platform launch", contractor_name: "Avery Frontend", skill_name: "FRONTEND", approved_hours: 8, amount: 1440, currency: "USD" }] } });
    if (pathname.endsWith("/vendor/invoices")) return route.fulfill({ json: { items: invoices, total: invoices.length, page: 1, page_size: 25, total_pages: 1 } });
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
}

async function expectNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

test("Vendor invoices uses three clear responsive sections and one history selector", async ({ page }, testInfo) => {
  await mockPage(page);
  for (const [width, height] of [[1440, 900], [1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/vendor/invoices");
    await expect(page.getByRole("heading", { name: "Eligible billing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select an invoice" })).toBeVisible();
    await expect(page.getByText("Select a row below")).toBeVisible();
    const history = page.getByTestId("invoice-history");
    await expect(history.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Select draft invoice
    const draftSelectors = history.getByRole("button", { name: "Draft #8" });
    await draftSelectors.first().click();
    await expect(page.getByTestId("selected-invoice").getByRole("heading", { name: "Draft #8" })).toBeVisible();
    await expect(page.getByTestId("selected-invoice").getByRole("button", { name: "Edit tax and adjustment" })).toBeVisible();
    await expect(page.getByTestId("selected-invoice").getByRole("button", { name: "Submit invoice" })).toBeVisible();
    await expect(page.getByTestId("selected-invoice").getByRole("button", { name: "Print" })).toBeVisible();

    // Select rejected invoice
    const rejectedSelectors = history.getByRole("button", { name: "INV-2026-000005" });
    await rejectedSelectors.first().click();
    await expect(page.getByTestId("selected-invoice").getByText(/Purchase order reference is missing/)).toBeVisible();

    // Select approved unpaid invoice -> Record payment MUST be visible
    const unpaidSelectors = history.getByRole("button", { name: "INV-2026-000006" });
    await unpaidSelectors.first().click();
    await expect(page.getByTestId("selected-invoice").getByRole("button", { name: "Record payment" })).toBeVisible();

    // Select approved fully paid invoice -> Record payment MUST NOT be visible
    const paidSelectors = history.getByRole("button", { name: "INV-2026-000004" });
    await paidSelectors.first().click();
    await expect(page.getByTestId("selected-invoice").getByText("PAID", { exact: true })).toBeVisible();
    await expect(page.getByTestId("selected-invoice").getByRole("button", { name: "Record payment" })).toBeHidden();

    await expect(page.getByText("Page 1 of 1")).toBeVisible();
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`vendor-invoices-${width}x${height}.png`), fullPage: true });
  }
});

test("Record payment modal renders compact enterprise design and captures screenshots", async ({ page }) => {
  await mockPage(page);
  // Add payment endpoint mock
  await page.route("**/api/vendor/invoices/*/payments", async (route) => {
    return route.fulfill({
      status: 201,
      json: {
        paid_amount: 1440,
        outstanding_amount: 0,
        payment_state: "PAID",
        overdue: false,
        payments: [{ id: 99, amount: 1440, method: "BANK_TRANSFER", reference: "TX-TEST-001", paid_at: "2026-09-14 10:00:00" }],
      },
    });
  });

  // 1. Desktop 1280x720 verification
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/vendor/invoices");

  const history = page.getByTestId("invoice-history");
  await history.getByRole("button", { name: "INV-2026-000006" }).first().click();

  const selected = page.getByTestId("selected-invoice");
  await expect(selected.getByRole("button", { name: "Record payment" })).toBeVisible();
  await selected.getByRole("button", { name: "Record payment" }).click();

  const dialog = page.getByRole("dialog", { name: "Record payment" });
  await expect(dialog).toBeVisible();

  // Summary checks
  await expect(dialog.getByText("Invoice: INV-2026-000006")).toBeVisible();
  await expect(dialog.getByText("Nova Analytics Platform")).toBeVisible();
  const outstandingEl = dialog.getByText("USD 1440.00", { exact: true });
  await expect(outstandingEl).toBeVisible();
  await expect(outstandingEl).toHaveClass(/text-\[#2446b8\]/);

  // Method options check
  const methodSelect = dialog.locator('select[name="method"]');
  const methodOptions = await methodSelect.locator("option").allInnerTexts();
  expect(methodOptions).toEqual([
    "Select payment method",
    "Bank transfer",
    "ACH",
    "Wire transfer",
    "Check",
    "Credit card",
  ]);

  // Check modal container size
  const modalBox = await dialog.locator(".max-w-\\[560px\\]").boundingBox();
  expect(modalBox.width).toBeLessThanOrEqual(580);
  expect(modalBox.width).toBeGreaterThanOrEqual(500);
  expect(modalBox.height).toBeLessThan(700); // Fits comfortably in 720px without page or modal clipping

  // Focus on amount input and verify continuous wrapper ring
  const amountInput = dialog.locator('input[name="amount"]');
  await amountInput.focus();
  const inputOutline = await amountInput.evaluate((el) => window.getComputedStyle(el).outlineStyle);
  expect(inputOutline).toBe("none");

  const amountWrapper = dialog.locator('div:has(> input[name="amount"])');
  await amountWrapper.screenshot({ path: "C:/Users/nares/.gemini/antigravity/brain/e8b12318-b2ec-417d-88d3-0027d54165a0/amount_composite_focus.png" });

  // Save desktop screenshot with focused amount input into artifacts
  await page.screenshot({ path: "C:/Users/nares/.gemini/antigravity/brain/e8b12318-b2ec-417d-88d3-0027d54165a0/record_payment_modal_desktop_1280x720.png" });

  // Escape closes
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // 2. Mobile 390x844 verification
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vendor/invoices");
  await history.getByRole("button", { name: "INV-2026-000006" }).first().click();
  await selected.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeVisible();

  const mobileModalBox = await dialog.locator(".max-w-\\[560px\\]").boundingBox();
  expect(mobileModalBox.width).toBeLessThanOrEqual(390);
  expect(mobileModalBox.width).toBeGreaterThanOrEqual(320);

  // Save mobile screenshot into artifacts
  await page.screenshot({ path: "C:/Users/nares/.gemini/antigravity/brain/e8b12318-b2ec-417d-88d3-0027d54165a0/record_payment_modal_mobile_390x844.png" });

  // Test form filling and submission
  await dialog.locator('input[name="reference"]').fill("WIRE-2026-001");
  await dialog.locator('select[name="method"]').selectOption("WIRE_TRANSFER");
  await dialog.locator('textarea[name="notes"]').fill("Settled via client direct wire transfer.");

  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(selected.getByText("PAID", { exact: true })).toBeVisible();
});

