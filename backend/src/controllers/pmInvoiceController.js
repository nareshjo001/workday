const invoiceApprovalService = require("../services/invoiceApprovalService");
const invoiceLifecycleService = require("../services/invoiceLifecycleService");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery, enumFilter, positiveIntegerFilter } = require("../utils/listQuery");

// Derive PM identity from the verified JWT for invoice visibility.
const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, { allowedSorts: { default: "i.generated_at", generated_at: "i.generated_at", status: "i.status", amount: "i.amount" }, allowedFilters: { status: enumFilter(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "PENDING_REVIEW", "AUTO_APPROVED"]), projectId: positiveIntegerFilter } });
  return res.status(200).json(await invoiceLifecycleService.listForActor(req.user, query));
});

module.exports = { list };
