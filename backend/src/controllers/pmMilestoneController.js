const pmMilestoneService = require("../services/pmMilestoneService");
const {
  validateCreateMilestone,
  validateUpdateMilestone,
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
  const milestone = await pmMilestoneService.createMilestone(req.user.userId, payload, { ...req.user, requestId: req.requestId });
  res.status(201).json(milestone);
});

const listForProject = asyncHandler(async (req, res) => {
  const projectId = validateProjectIdParam(req.params);
  const milestones = await pmMilestoneService.listMilestones(req.user.userId, projectId);
  res.status(200).json(milestones);
});
const update=asyncHandler(async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)throw require('../utils/ApiError').badRequest('Validation failed',['id must be positive.']);res.json(await pmMilestoneService.updateMilestone(req.user.userId,id,validateUpdateMilestone(req.body),{...req.user,requestId:req.requestId}));});

module.exports = { create, update, listForProject };
