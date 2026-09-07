const invoiceApprovalService = require("../services/invoiceApprovalService");
const invoiceLifecycleService = require("../services/invoiceLifecycleService");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery, enumFilter, positiveIntegerFilter } = require("../utils/listQuery");

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
  const query = parseListQuery(req.query, { allowedSorts: { default: "i.generated_at", generated_at: "i.generated_at", status: "i.status", amount: "i.amount" }, allowedFilters: { status: enumFilter(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "PENDING_REVIEW", "AUTO_APPROVED"]), projectId: positiveIntegerFilter } });
  return res.status(200).json(await invoiceLifecycleService.listForActor(req.user, query));
});

module.exports = { list };
