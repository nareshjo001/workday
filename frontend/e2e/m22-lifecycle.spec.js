import { test, expect } from "@playwright/test";

const password = "DemoPassword!2026";

async function login(browser, email, destination) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(destination));
  return { context, page };
}

test("M22 seeded browser lifecycle covers candidate review, time review, invoice review, and payment recording", async ({ browser }) => {
  const vendor = await login(browser, "demo.vendor@workday.local", "/vendor");
  await vendor.page.goto("/vendor/assignments");
  await vendor.page.getByRole("button", { name: /View & Assign Team/ }).click();
  await vendor.page.getByRole("button", { name: /Submit Backend Candidate/ }).click();
  await vendor.page.getByText("demo.candidate@workday.local").click();
  await vendor.page.getByRole("button", { name: /Submit Selected/ }).click();
  await expect(vendor.page.getByText(/candidate submission.*sent to the Project Manager/i)).toBeVisible();
  await vendor.context.close();

  const pmCandidate = await login(browser, "demo.pm@workday.local", "/pm");
  await pmCandidate.page.goto("/pm/staffing-pipeline");
  const candidateRow = pmCandidate.page.getByTestId(/candidate-/).filter({ hasText: "Demo Candidate" });
  await expect(candidateRow).toBeVisible();
  await candidateRow.getByRole("button", { name: "Accept" }).click();
  await expect(pmCandidate.page.getByText(/Demo Candidate was accepted/i)).toBeVisible();
  await pmCandidate.context.close();

  const contractor = await login(browser, "demo.contractor@workday.local", "/contractor");
  await contractor.page.goto("/contractor/timesheets");
  await contractor.page.getByRole("button", { name: /Log Hours/ }).click();
  await contractor.page.getByLabel("Project").selectOption({ label: "Demo Platform Upgrade" });
  await contractor.page.getByLabel("Date Worked").fill(new Date().toISOString().slice(0, 10));
  await contractor.page.getByLabel("Hours Logged").fill("4");
  await contractor.page.getByLabel("Work Description").fill("M22 E2E approved work");
  await contractor.page.getByRole("button", { name: "Save Draft" }).click();
  await expect(contractor.page.getByText(/Logged 4 hours/i)).toBeVisible();
  await contractor.page.getByRole("button", { name: "Submit visible drafts" }).click();
  await expect(contractor.page.getByText(/submitted for review/i)).toBeVisible();
  await contractor.context.close();

  const pmTimesheet = await login(browser, "demo.pm@workday.local", "/pm");
  await pmTimesheet.page.goto("/pm/timesheets");
  await pmTimesheet.page.getByRole("button", { name: "Approve" }).last().click();
  await expect(pmTimesheet.page.getByText(/approved/i)).toBeVisible();
  await pmTimesheet.context.close();

  const vendorInvoice = await login(browser, "demo.vendor@workday.local", "/vendor");
  await vendorInvoice.page.goto("/vendor/invoices");
  await vendorInvoice.page.getByRole("button", { name: "Create draft" }).click();
  await expect(vendorInvoice.page.getByText(/Draft #\d+ created/)).toBeVisible();
  await vendorInvoice.page.getByRole("button", { name: "Submit invoice" }).click();
  await expect(vendorInvoice.page.getByText(/submitted for client review/i)).toBeVisible();
  await vendorInvoice.context.close();

  const pmInvoice = await login(browser, "demo.pm@workday.local", "/pm");
  await pmInvoice.page.goto("/pm/invoices");
  await pmInvoice.page.getByRole("button", { name: "Approve" }).last().click();
  await expect(pmInvoice.page.getByText(/APPROVED/i).last()).toBeVisible();
  await pmInvoice.context.close();

  const vendorPayment = await login(browser, "demo.vendor@workday.local", "/vendor");
  await vendorPayment.page.goto("/vendor/invoices");
  await vendorPayment.page.getByRole("button", { name: "Record payment" }).click();
  await vendorPayment.page.getByLabel("Amount").fill("1.00");
  await vendorPayment.page.getByLabel("Reference").fill("M22-E2E-PAYMENT");
  await vendorPayment.page.getByRole("button", { name: "Record payment" }).last().click();
  await expect(vendorPayment.page.getByText("Payment recorded.")).toBeVisible();
  await vendorPayment.context.close();
});
