const asyncHandler = require("../utils/asyncHandler");
const { validateAnalysisInput } = require("../validators/vendorRateIntelligenceValidators");
const service = require("../services/vendorRateIntelligenceService");

const analyze = asyncHandler(async (req, res) => {
  res.status(200).json(await service.analyze(req.user.userId, validateAnalysisInput(req.body)));
});

module.exports = { analyze };
