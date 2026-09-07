const service = require("../services/contractorDocumentService"); const { positive } = require("../validators/contractorDocumentValidators"); const ApiError = require("../utils/ApiError"); const asyncHandler = require("../utils/asyncHandler");
const summary = asyncHandler(async (req, res) => { const contractorId = positive(req.params.contractorId); if (!contractorId) throw ApiError.badRequest("Invalid contractor id."); res.status(200).json(await service.summaryForPm(req.user.userId, contractorId)); });
module.exports = { summary };
