const asyncHandler = require("../utils/asyncHandler");
const intelligenceCapabilityService = require("../services/intelligenceCapabilityService");

// Identity is exclusively req.user, set by the verified session JWT.
const capabilities = asyncHandler(async (req, res) => {
  res.status(200).json(intelligenceCapabilityService.getCapabilities(req.user.role));
});

module.exports = { capabilities };
