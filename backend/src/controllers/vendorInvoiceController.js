const vendorInvoiceService = require("../services/vendorInvoiceService");
const { validateInvoiceIdParam, validateReviewInvoice } = require("../validators/vendorInvoiceValidators");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery } = require("../utils/listQuery");

/**
 * `req.user.userId` is the ONLY source of the acting vendor's identity
 * here — vendor_id is never read from a query param or the request body.
 *
 * Invoice-workflow redesign: this controller gained a mutation
 * (`review`) it never had before — approval authority moved from PM to
 * Vendor, see vendorInvoiceService.reviewInvoice.
 */
const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, {
    allowedSorts: { default: "i.generated_at", generated_at: "i.generated_at", status: "i.status", amount: "i.amount" },
    allowedFilters: {
      status: (value) => { const status = String(value).trim().toUpperCase(); if (!["PENDING_REVIEW", "APPROVED", "REJECTED", "AUTO_APPROVED"].includes(status)) throw require("../utils/ApiError").badRequest("Unsupported invoice status."); return status; },
      projectId: (value) => { const id = Number(value); if (!Number.isInteger(id) || id < 1) throw require("../utils/ApiError").badRequest("projectId must be a positive integer."); return id; },
    },
  });
  res.status(200).json(await vendorInvoiceService.listPageForVendor(req.user.userId, query));
});

const review = asyncHandler(async (req, res) => {
  const invoiceId = validateInvoiceIdParam(req.params);
  const { status, rejectionReason } = validateReviewInvoice(req.body);
  const invoice = await vendorInvoiceService.reviewInvoice(req.user.userId, invoiceId, {
    status,
    rejectionReason,
  }, { ...req.user, requestId: req.requestId });
  res.status(200).json(invoice);
});

module.exports = { list, review };
