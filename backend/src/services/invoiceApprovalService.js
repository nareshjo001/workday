const invoiceRepository = require("../repositories/invoiceRepository");

/**
 * PM-facing invoice VISIBILITY — invoice-workflow redesign: this file
 * used to also contain the PM's approve/reject mutation
 * (`reviewInvoice`). That mutation has been REMOVED, not just left
 * disabled — approval authority now belongs entirely to the Vendor (see
 * vendorInvoiceService.reviewInvoice, PATCH /api/vendor/invoices/:id).
 * A PM gets read-only visibility into their own projects' invoice
 * history ONLY, with no way to change an invoice's status through this
 * API at all (spec: "PM only gets visibility after vendor approval,
 * cannot approve financially... no modification capability").
 *
 * COMPATIBILITY NOTE: the old PATCH /api/pm/invoices/:id endpoint (and
 * its listPendingForPm "review queue" framing) is gone — see
 * STEP2_STEP3_PLAN.md for why this is a deliberate removal rather than a
 * deprecated-but-present endpoint: there is no longer a PM-side
 * "pending" concept to review, since PENDING_REVIEW invoices now belong
 * to the Vendor's queue. Any old frontend code path expecting to PATCH
 * this endpoint has been updated alongside this change (PmInvoicesPage).
 */

/**
 * Every invoice (any status) for projects owned by `pmId`, vendor-
 * approved invoices ordered first as the primary financial record — see
 * invoiceRepository.listForPm's own comment on the ordering. Scoped in
 * the repository's SQL, not filtered afterward.
 */
async function listForPm(pmId) {
  return invoiceRepository.listForPm(pmId);
}

module.exports = { listForPm };
