import apiClient from "./apiClient";

/**
 * Vendor's read-only invoice API (Module 6). Built on the shared
 * apiClient, same as vendorContractorService — the JWT is attached
 * automatically, so nothing here ever passes a vendor id explicitly.
 * There is no mutation endpoint here — a vendor can only view.
 */
async function listInvoices() {
  const { data } = await apiClient.get("/vendor/invoices");
  return data;
}

export default { listInvoices };
