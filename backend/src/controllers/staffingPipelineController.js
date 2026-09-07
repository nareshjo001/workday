const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/staffingPipelineService");

const pm = asyncHandler(async (req, res) => res.json(await service.listForPm(req.user.userId, req.query)));
const vendor = asyncHandler(async (req, res) => res.json(await service.listForVendor(req.user.userId, req.query)));

module.exports = { pm, vendor };
