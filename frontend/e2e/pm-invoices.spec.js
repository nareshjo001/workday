import { expect, test } from "@playwright/test";

const item = { id: 81, contractor_name_snapshot: "Avery Frontend", skill_name_snapshot: "FRONTEND", approved_hours: 8, bill_rate: 180, amount: 1440 };
const invoices = [
  { id: 7, invoice_number: "INV-2026-000007", project_name: "Atlas Commerce Modernization", generated_at: "2026-09-14 09:30:00", reviewed_at: null, status: "SUBMITTED", items: [item], amount: 1440, subtotal_amount: 1440, tax_rate: 10, tax_amount: 144, adjustment_amount: 0, total_amount: 1584, pdf_storage_key: "invoices/7.pdf" },
  { id: 6, invoice_number: "INV-2026-000006", project_name: "Demo Platform Upgrade", generated_at: "2026-09-13 09:30:00", reviewed_at: "2026-09-15 10:00:00", status: "APPROVED", items: [item], amount: 1440, subtotal_amount: 1440, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, total_amount: 1440, payment_state: "PARTIALLY_PAID", paid_amount: 400, outstanding_amount: 1040, due_date: "2026-10-14" },
];

async function mockPmInvoices(page) {
  const reviews = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith("/auth/refresh")) return route.fulfill({ json: { token: "pm-invoice-token", user: { id: 7, name: "Demo PM", role: "PM" } } });
    if (pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { id: 7, name: "Demo PM", role: "PM" } } });
    if (pathname.endsWith("/pm/invoices/7/review") && request.method() === "PATCH") {
      reviews.push(request.postDataJSON());
      return route.fulfill({ json: { ...invoices[0], ...request.postDataJSON(), reviewed_at: "2026-09-18 10:00:00" } });
    }
    if (pathname.endsWith("/pm/invoices")) return route.fulfill({ json: { items: invoices, total: invoices.length, page: 1, page_size: 25, total_pages: 1 } });
    return route.fulfill({ status: 404, json: { message: `Unmocked request: ${pathname}` } });
  });
  return reviews;
}

test("PM invoice reviews uses Vendor-aligned common surfaces while retaining PM review actions", async ({ page }) => {
  const reviews = await mockPmInvoices(page);
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/pm/invoices");
    await expect(page.getByRole("heading", { name: "Invoice Reviews" })).toBeVisible();
    await expect(page.getByTestId("selected-invoice-empty")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select an invoice" })).toBeVisible();
    await expect(page.getByTestId("selected-invoice")).toHaveCount(0);
    const history = page.getByTestId("invoice-history");
    await expect(history.getByRole("heading", { name: "Invoice history" })).toBeVisible();
    const invoiceSelectors = history.getByRole("button", { name: /INV-2026-000007/ });
    await (width < 768 ? invoiceSelectors.last() : invoiceSelectors.first()).click();
    const selected = page.getByTestId("selected-invoice");
    await expect(selected.getByRole("heading", { name: "INV-2026-000007" })).toBeVisible();
    await expect(selected.getByText("Submitted")).toBeVisible();
    await expect(selected.getByRole("button", { name: "Approve" })).toBeVisible();
    const rejectButton = selected.getByRole("button", { name: "Reject" });
    await expect(rejectButton).toBeVisible();
    await expect(selected.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(selected.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(selected.getByRole("button", { name: "Edit tax and adjustment" })).toHaveCount(0);
    await expect(selected.getByRole("button", { name: "Submit invoice" })).toHaveCount(0);
    await expect(selected.getByRole("button", { name: "Record payment" })).toHaveCount(0);
    await rejectButton.click();
    const responsiveDialog = page.getByRole("dialog", { name: "Reject invoice" });
    await expect(responsiveDialog).toBeVisible();
    await expect(responsiveDialog.getByRole("textbox", { name: /Rejection reason/ })).toBeFocused();
    if (width >= 1280) {
      const modalMetrics = await responsiveDialog.locator(".ui-modal-panel").evaluate((panel) => ({
        width: panel.getBoundingClientRect().width,
        height: panel.getBoundingClientRect().height,
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
      }));
      expect(modalMetrics.width).toBeLessThanOrEqual(601);
      expect(modalMetrics.height).toBeLessThanOrEqual(height - 32);
      expect(modalMetrics.scrollHeight).toBeLessThanOrEqual(modalMetrics.clientHeight);
    }
    await responsiveDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(responsiveDialog).toHaveCount(0);
    await expect(rejectButton).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pm/invoices");
  await page.getByTestId("invoice-history").getByRole("button", { name: "INV-2026-000007" }).click();
  const selected = page.getByTestId("selected-invoice");
  await selected.getByRole("button", { name: "Approve" }).click();
  await expect.poll(() => reviews.length).toBe(1);
  expect(reviews[0]).toEqual({ status: "APPROVED", rejection_reason: null });

  await selected.getByRole("button", { name: "Reject" }).click();
  const rejectionDialog = page.getByRole("dialog", { name: "Reject invoice" });
  await expect(rejectionDialog).toBeVisible();
  await expect(rejectionDialog.getByText("INV-2026-000007")).toBeVisible();
  await expect(rejectionDialog.getByText("Atlas Commerce Modernization")).toBeVisible();
  const rejectionReason = rejectionDialog.getByRole("textbox", { name: /Rejection reason/ });
  await expect(rejectionReason).toBeFocused();
  await rejectionReason.fill("Incorrect billing amount");
  await rejectionDialog.getByRole("button", { name: "Reject invoice" }).click();
  await expect.poll(() => reviews.length).toBe(2);
  expect(reviews[1]).toEqual({ status: "REJECTED", rejection_reason: "Incorrect billing amount" });
  await expect(rejectionDialog).toHaveCount(0);
});
