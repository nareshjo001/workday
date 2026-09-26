import apiClient from "./apiClient";

// Use the authenticated PM's scope for invoice history and review operations.
async function listInvoices(params = {}) {
  const { data } = await apiClient.get("/pm/invoices", { params });
  return data;
}
async function reviewInvoice(id,status,rejectionReason){const {data}=await apiClient.patch(`/pm/invoices/${id}/review`,{status,rejection_reason:rejectionReason});return data;}
async function downloadPdf(invoiceId){const {data}=await apiClient.get(`/pm/invoices/${invoiceId}/pdf`,{responseType:'blob'});return URL.createObjectURL(data);}

export default { listInvoices, reviewInvoice, downloadPdf };
