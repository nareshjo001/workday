const invoiceRepository = require("../repositories/invoiceRepository");
const { pageResult } = require("../utils/listQuery");

/**
 * Vendor-facing invoice list (Module 6). Only ever returns invoices whose
 * snapshotted vendor_id matches the authenticated vendor — scoped in the
 * repository's SQL, not filtered afterward (see
 * invoiceRepository.listForVendor's own comment on why the invoice's own
 * vendor_id column, not a live join to contractors.vendor_id, is the
 * ownership boundary here). There is no vendor_id parameter anywhere in
 * this file's signatures — vendorId always comes from the caller
 * resolving req.user.userId off the JWT (see vendorInvoiceController).
 */
async function listForVendor(vendorId) {
  return invoiceRepository.listForVendor(vendorId);
}
async function listPageForVendor(vendorId, query) {
  const { rows, total } = await invoiceRepository.listPageForVendor(vendorId, query);
  return pageResult(rows, total, query);
}

module.exports = { listForVendor, listPageForVendor };
