const invoiceApprovalService = require("../services/invoiceApprovalService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body or params.
 *
 * Invoice-workflow redesign: this controller is now READ-ONLY. The old
 * `review` action (PATCH /api/pm/invoices/:id) has been removed — a PM
 * no longer approves or rejects invoices, see
 * invoiceApprovalService.js's own top comment for why.
 */
const list = asyncHandler(async (req, res) => {
  const invoices = await invoiceApprovalService.listForPm(req.user.userId);
  res.status(200).json(invoices);
});

module.exports = { list };
