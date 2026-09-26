const invoiceRepository = require("../repositories/invoiceRepository");
const { pageResult } = require("../utils/listQuery");

// Legacy PM invoice-list helpers rely on repository ownership scoping.

// Return invoices for the PM's own projects using the legacy repository ordering.
async function listForPm(pmId) {
  return invoiceRepository.listForPm(pmId);
}
async function listPageForPm(pmId, query) { const { rows, total } = await invoiceRepository.listPageForPm(pmId, query); return pageResult(rows, total, query); }

module.exports = { listForPm, listPageForPm };
