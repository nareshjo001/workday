const availabilityService = require("../services/contractorAvailabilityService");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const create = asyncHandler(async (req, res) => {
  const contractorId = Number(req.params.contractorId);
  if (!Number.isInteger(contractorId) || contractorId < 1) throw ApiError.badRequest("Invalid contractor id.");
  res.status(201).json(await availabilityService.createForVendor(req.user.userId, contractorId, req.body, { ...req.user, requestId: req.requestId }));
});
module.exports = { create };
