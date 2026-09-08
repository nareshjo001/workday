const vendorContractorService = require("../services/vendorContractorService");
const {
  validateCreateContractor,
  validateUpdateContractor,
} = require("../validators/vendorContractorValidators");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { SKILLS } = require("../constants/skills");
const { parseListQuery } = require("../utils/listQuery");
const historyService = require('../services/contractorHistoryService');

/**
 * `req.user` is set by the `authenticate` middleware from the verified JWT
 * (see routes/vendorRoutes.js) — `req.user.userId` is the ONLY source of
 * the acting vendor's identity in this controller. The request body is
 * never trusted for vendor_id/user_id/role.
 */

const create = asyncHandler(async (req, res) => {
  const payload = validateCreateContractor(req.body);
  const contractor = await vendorContractorService.createContractor(req.user.userId, payload, { ...req.user, requestId: req.requestId });
  res.status(201).json(contractor);
});

const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, {
    allowedSorts: { default: "u.name", name: "u.name", email: "u.email", status: "c.status", created_at: "c.created_at" },
    allowedFilters: {
      skill: (value) => { const skill = String(value).trim().toUpperCase(); if (!SKILLS.includes(skill)) throw ApiError.badRequest(`skill must be one of: ${SKILLS.join(", ")}.`); return skill; },
      status: (value) => { const status = String(value).trim().toUpperCase(); if (!["ACTIVE", "INACTIVE"].includes(status)) throw ApiError.badRequest("status must be ACTIVE or INACTIVE."); return status; },
      search: (value) => String(value).trim().slice(0, 100),
    },
  });
  res.status(200).json(await vendorContractorService.listContractorsPage(req.user.userId, query));
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
    payload,
    { ...req.user, requestId: req.requestId }
  );
  res.status(200).json(contractor);
});

const resendInvitation = asyncHandler(async (req, res) => {
  const contractorId = Number(req.params.id);
  await vendorContractorService.resendInvitation(req.user.userId, contractorId);
  res.status(202).json({ message: "Invitation email queued." });
});
const history = asyncHandler(async (req,res) => { const contractorId=Number(req.params.id); if(!Number.isInteger(contractorId)||contractorId<1) throw ApiError.badRequest('Invalid contractor id.'); res.json({ assignments: await historyService.history(req.user.userId, contractorId) }); });

module.exports = { create, list, update, resendInvitation, history };
