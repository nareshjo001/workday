import apiClient from "./apiClient";

/**
 * PM's invoice-review API (Module 6). Built on the shared apiClient, same
 * as pmMilestoneService/pmTimesheetService — the JWT is attached
 * automatically, so nothing here ever passes a pm id explicitly.
 */

async function listPending() {
  const { data } = await apiClient.get("/pm/invoices/pending");
  return data;
}

async function approveInvoice(invoiceId) {
  const { data } = await apiClient.patch(`/pm/invoices/${invoiceId}`, { status: "APPROVED" });
  return data;
}

async function rejectInvoice(invoiceId, rejectionReason) {
  const { data } = await apiClient.patch(`/pm/invoices/${invoiceId}`, {
    status: "REJECTED",
    rejection_reason: rejectionReason,
  });
  return data;
}

export default { listPending, approveInvoice, rejectInvoice };
