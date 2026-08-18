const vendorInvoiceService = require("../services/vendorInvoiceService");
const { validateInvoiceIdParam, validateReviewInvoice } = require("../validators/vendorInvoiceValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` is the ONLY source of the acting vendor's identity
 * here — vendor_id is never read from a query param or the request body.
 *
 * Invoice-workflow redesign: this controller gained a mutation
 * (`review`) it never had before — approval authority moved from PM to
 * Vendor, see vendorInvoiceService.reviewInvoice.
 */
const list = asyncHandler(async (req, res) => {
  const invoices = await vendorInvoiceService.listForVendor(req.user.userId);
  res.status(200).json(invoices);
});

const review = asyncHandler(async (req, res) => {
  const invoiceId = validateInvoiceIdParam(req.params);
  const { status, rejectionReason } = validateReviewInvoice(req.body);
  const invoice = await vendorInvoiceService.reviewInvoice(req.user.userId, invoiceId, {
    status,
    rejectionReason,
  });
  res.status(200).json(invoice);
});

module.exports = { list, review };
