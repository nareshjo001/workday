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
async function listInvoices(params = {}) {
  const { data } = await apiClient.get("/vendor/invoices", { params });
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

async function billingQueue(){const {data}=await apiClient.get('/vendor/billing-queue');return data.items;}
async function createDraft(milestoneBillingId){const {data}=await apiClient.post('/vendor/invoices/drafts',{milestone_billing_id:milestoneBillingId});return data;}
async function submitDraft(invoiceId){const {data}=await apiClient.post(`/vendor/invoices/${invoiceId}/submit`);return data;}
async function updateDraft(invoiceId, payload){const {data}=await apiClient.patch(`/vendor/invoices/${invoiceId}`,payload);return data;}
async function addItem(invoiceId, milestoneBillingId){const {data}=await apiClient.post(`/vendor/invoices/${invoiceId}/items`,{milestone_billing_id:milestoneBillingId});return data;}
async function removeItem(invoiceId, milestoneBillingId){const {data}=await apiClient.delete(`/vendor/invoices/${invoiceId}/items`,{data:{milestone_billing_id:milestoneBillingId}});return data;}
async function downloadPdf(invoiceId){const {data}=await apiClient.get(`/vendor/invoices/${invoiceId}/pdf`,{responseType:'blob'});return URL.createObjectURL(data);}

export default { listInvoices, approveInvoice, rejectInvoice, billingQueue, createDraft, submitDraft, updateDraft, addItem, removeItem, downloadPdf };
