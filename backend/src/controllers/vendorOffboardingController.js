const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const service = require('../services/vendorOffboardingService');

function ids(params) {
  const projectId = Number(params.projectId); const contractorId = Number(params.contractorId);
  if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(contractorId) || contractorId < 1) throw ApiError.badRequest('Invalid project or contractor id.');
  return { projectId, contractorId };
}
const readiness = asyncHandler(async (req, res) => { const { projectId, contractorId } = ids(req.params); res.json(await service.readiness(req.user.userId, projectId, contractorId)); });
const release = asyncHandler(async (req, res) => {
  const { projectId, contractorId } = ids(req.params); const { actual_end_date: actualEndDate, reason } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(actualEndDate || '')) || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw ApiError.badRequest('Validation failed', ['actual_end_date and a release reason are required.']);
  res.json(await service.release(req.user.userId, projectId, contractorId, { actualEndDate, reason: reason.trim() }, { ...req.user, requestId: req.requestId }));
});
module.exports = { readiness, release };
