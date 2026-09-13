const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const control = require("../services/pmProjectControlService");
const explanation = require("../services/intelligenceExplanationService");
const logger = require("../observability/logger");

exports.explain = asyncHandler(async (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!Number.isInteger(projectId) || projectId < 1) throw ApiError.badRequest("Invalid project id.");
  const result = await control.analyze(req.user.userId, projectId);
  const finding = result.findings.find((item) => item.code === req.params.findingCode);
  if (!finding) throw ApiError.notFound("Finding not found.");
  logger.info("ai_explanation_requested", { finding_code: finding.code, project_id: projectId });
  res.json(await explanation.explainFindingResult(finding, { projectId }));
});
