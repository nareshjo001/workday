const invoiceLifecycleService = require("../services/invoiceLifecycleService");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery } = require("../utils/listQuery");

// Scope invoice visibility to the authenticated vendor; review authority remains with the PM.
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
