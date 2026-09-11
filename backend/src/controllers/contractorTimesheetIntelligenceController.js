const asyncHandler = require("../utils/asyncHandler"); const { validateSubmitTimesheet } = require("../validators/contractorTimesheetValidators"); const service = require("../services/contractorTimesheetIntelligenceService");
exports.analyze = asyncHandler(async (req,res) => { res.json(await service.analyze(req.user.userId, validateSubmitTimesheet(req.body))); });
