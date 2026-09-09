const invoiceLifecycleService = require("../services/invoiceLifecycleService");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery } = require("../utils/listQuery");

/**
 * `req.user.userId` is the ONLY source of the acting vendor's identity
 * here — vendor_id is never read from a query param or the request body.
 *
 * Invoice review authority belongs to the owning PM/client. Vendor routes
 * expose only the lifecycle operations implemented by invoiceLifecycleService.
 */
const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, {
    allowedSorts: { default: "i.generated_at", generated_at: "i.generated_at", status: "i.status", amount: "i.amount" },
    allowedFilters: {
      status: (value) => { const status = String(value).trim().toUpperCase(); if (!["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "PENDING_REVIEW", "AUTO_APPROVED"].includes(status)) throw require("../utils/ApiError").badRequest("Unsupported invoice status."); return status; },
      projectId: (value) => { const id = Number(value); if (!Number.isInteger(id) || id < 1) throw require("../utils/ApiError").badRequest("projectId must be a positive integer."); return id; },
    },
  });
  res.status(200).json(await invoiceLifecycleService.listForActor(req.user, query));
});

module.exports = { list };
