const invoiceRepository = require("../repositories/invoiceRepository");
const { pageResult } = require("../utils/listQuery");

// Scope invoice visibility by the authenticated vendor's snapshotted invoice ownership.
async function listForVendor(vendorId) {
  return invoiceRepository.listForVendor(vendorId);
}
async function listPageForVendor(vendorId, query) {
  const { rows, total } = await invoiceRepository.listPageForVendor(vendorId, query);
  return pageResult(rows, total, query);
}

module.exports = { listForVendor, listPageForVendor };
