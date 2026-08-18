const invoiceApprovalService = require("../services/invoiceApprovalService");
const { validateInvoiceIdParam, validateReviewInvoice } = require("../validators/pmInvoiceValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body or params.
 */

const listPending = asyncHandler(async (req, res) => {
  const invoices = await invoiceApprovalService.listPendingForPm(req.user.userId);
  res.status(200).json(invoices);
});

const review = asyncHandler(async (req, res) => {
  const invoiceId = validateInvoiceIdParam(req.params);
  const { status, rejectionReason } = validateReviewInvoice(req.body);
  const invoice = await invoiceApprovalService.reviewInvoice(req.user.userId, invoiceId, {
    status,
    rejectionReason,
  });
  res.status(200).json(invoice);
});

module.exports = { listPending, review };
