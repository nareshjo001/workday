const pmMilestoneService = require("../services/pmMilestoneService");
const {
  validateCreateMilestone,
  validateProjectIdParam,
} = require("../validators/pmMilestoneValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body or params.
 */

const create = asyncHandler(async (req, res) => {
  const payload = validateCreateMilestone(req.body);
  const milestone = await pmMilestoneService.createMilestone(req.user.userId, payload);
  res.status(201).json(milestone);
});

const listForProject = asyncHandler(async (req, res) => {
  const projectId = validateProjectIdParam(req.params);
  const milestones = await pmMilestoneService.listMilestones(req.user.userId, projectId);
  res.status(200).json(milestones);
});

module.exports = { create, listForProject };
