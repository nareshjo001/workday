const service = require("../services/contractorAvailabilityService");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const list = asyncHandler(async (req, res) => res.json(await service.list(req.user.userId)));
const create = asyncHandler(async (req, res) => res.status(201).json(await service.create(req.user.userId, req.body, { ...req.user, requestId: req.requestId })));
const cancel = asyncHandler(async (req, res) => { const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) throw ApiError.badRequest("Invalid availability id."); await service.cancel(req.user.userId, id, { ...req.user, requestId: req.requestId }); res.status(204).end(); });
module.exports = { list, create, cancel };
