const vendorInvoiceService = require("../services/vendorInvoiceService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` is the ONLY source of the acting vendor's identity
 * here — vendor_id is never read from a query param or the request body.
 * Read-only: there is no vendor-facing mutation endpoint for invoices.
 */
const list = asyncHandler(async (req, res) => {
  const invoices = await vendorInvoiceService.listForVendor(req.user.userId);
  res.status(200).json(invoices);
});

module.exports = { list };
