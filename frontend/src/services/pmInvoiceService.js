import apiClient from "./apiClient";

/**
 * PM's invoice VISIBILITY API — invoice-workflow redesign: this is now
 * READ-ONLY. A PM can no longer approve or reject invoices (see
 * vendorInvoiceService for where that authority moved); this file only
 * ever GETs. Built on the shared apiClient, same as
 * pmMilestoneService/pmTimesheetService — the JWT is attached
 * automatically, so nothing here ever passes a pm id explicitly.
 */
async function listInvoices() {
  const { data } = await apiClient.get("/pm/invoices");
  return data;
}

export default { listInvoices };
