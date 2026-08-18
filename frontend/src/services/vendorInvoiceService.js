import apiClient from "./apiClient";

/**
 * Vendor's invoice API (Module 6, extended by the invoice-workflow
 * redesign). Built on the shared apiClient, same as
 * vendorContractorService — the JWT is attached automatically, so
 * nothing here ever passes a vendor id explicitly.
 *
 * Approval authority moved to the Vendor here — a Vendor now sees their
 * FULL invoice history (every status) and can approve/reject any row
 * still PENDING_REVIEW (see PmInvoicesPage for the PM's now-read-only
 * equivalent).
 */
async function listInvoices() {
  const { data } = await apiClient.get("/vendor/invoices");
  return data;
}

async function approveInvoice(invoiceId) {
  const { data } = await apiClient.patch(`/vendor/invoices/${invoiceId}`, { status: "APPROVED" });
  return data;
}

async function rejectInvoice(invoiceId, rejectionReason) {
  const { data } = await apiClient.patch(`/vendor/invoices/${invoiceId}`, {
    status: "REJECTED",
    rejection_reason: rejectionReason,
  });
  return data;
}

export default { listInvoices, approveInvoice, rejectInvoice };
