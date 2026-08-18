const vendorContractorService = require("../services/vendorContractorService");
const {
  validateCreateContractor,
  validateUpdateContractor,
} = require("../validators/vendorContractorValidators");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

/**
 * `req.user` is set by the `authenticate` middleware from the verified JWT
 * (see routes/vendorRoutes.js) — `req.user.userId` is the ONLY source of
 * the acting vendor's identity in this controller. The request body is
 * never trusted for vendor_id/user_id/role.
 */

const create = asyncHandler(async (req, res) => {
  const payload = validateCreateContractor(req.body);
  const contractor = await vendorContractorService.createContractor(req.user.userId, payload);
  res.status(201).json(contractor);
});

const list = asyncHandler(async (req, res) => {
  const contractors = await vendorContractorService.listContractors(req.user.userId);
  res.status(200).json(contractors);
});

const update = asyncHandler(async (req, res) => {
  const contractorId = Number(req.params.id);
  if (!Number.isInteger(contractorId)) {
    throw ApiError.badRequest("Invalid contractor id.");
  }
  const payload = validateUpdateContractor(req.body);
  const contractor = await vendorContractorService.updateContractor(
    req.user.userId,
    contractorId,
    payload
  );
  res.status(200).json(contractor);
});

module.exports = { create, list, update };
