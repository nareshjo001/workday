const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/auditActivityService");
const positiveId = (value) => { const id = Number(value); if (!Number.isInteger(id) || id < 1) throw require("../utils/ApiError").badRequest("Invalid project id."); return id; };
exports.pmProject = asyncHandler(async (req, res) => res.json(await service.pmProject(req.user.userId, positiveId(req.params.projectId), req.query)));
exports.vendor = asyncHandler(async (req, res) => res.json(await service.vendor(req.user.userId, req.query)));
exports.contractor = asyncHandler(async (req, res) => res.json(await service.contractor(req.user.userId, req.query)));
