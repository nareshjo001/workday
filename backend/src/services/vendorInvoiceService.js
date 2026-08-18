const invoiceRepository = require("../repositories/invoiceRepository");

/**
 * Vendor-facing, read-only invoice list (Module 6). Only ever returns
 * invoices whose snapshotted vendor_id matches the authenticated vendor
 * — scoped in the repository's SQL, not filtered afterward (see
 * invoiceRepository.listForVendor's own comment on why the invoice's own
 * vendor_id column, not a live join to contractors.vendor_id, is the
 * ownership boundary here). There is no vendor_id parameter anywhere in
 * this file's signature — vendorId always comes from the caller
 * resolving req.user.userId off the JWT (see vendorInvoiceController).
 */
async function listForVendor(vendorId) {
  return invoiceRepository.listForVendor(vendorId);
}

module.exports = { listForVendor };
