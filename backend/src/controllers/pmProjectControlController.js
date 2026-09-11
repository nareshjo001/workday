const asyncHandler = require("../utils/asyncHandler");
const { validateProjectIdParam } = require("../validators/pmProjectValidators");
const service = require("../services/pmProjectControlService");

const analyze = asyncHandler(async (req, res) => {
  const projectId = validateProjectIdParam(req.params);
  res.json(await service.analyze(req.user.userId, projectId));
});

module.exports = { analyze };
