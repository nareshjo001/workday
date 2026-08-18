const pmProjectService = require("../services/pmProjectService");
const {
  validateCreateProject,
  validateProjectIdParam,
  validateUpdateAllocation,
} = require("../validators/pmProjectValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body.
 */

const create = asyncHandler(async (req, res) => {
  const payload = validateCreateProject(req.body);
  const project = await pmProjectService.createProject(req.user.userId, payload);
  res.status(201).json(project);
});

const list = asyncHandler(async (req, res) => {
  const projects = await pmProjectService.listProjects(req.user.userId);
  res.status(200).json(projects);
});

/**
 * GET /api/pm/projects/:id/contractors — Module 5 addition powering the
 * milestone-creation contractor picker (see pmProjectService.listAssignedContractors).
 */
const listContractors = asyncHandler(async (req, res) => {
  const projectId = validateProjectIdParam(req.params);
  const contractors = await pmProjectService.listAssignedContractors(req.user.userId, projectId);
  res.status(200).json(contractors);
});

/**
 * PATCH /api/pm/projects/:id/complete — project hours/allocation redesign
 * addition. See pmProjectService.completeProject for the full
 * transaction (mark COMPLETED + auto-release every active assignment).
 */
const complete = asyncHandler(async (req, res) => {
  const projectId = validateProjectIdParam(req.params);
  const result = await pmProjectService.completeProject(req.user.userId, projectId);
  res.status(200).json(result);
});

/**
 * PATCH /api/pm/projects/:projectId/contractors/:contractorId/allocation —
 * MVP fix 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"). See pmProjectService.updateContractorAllocation for the full
 * transaction (ownership + assignment + approved-hours-floor + project
 * capacity checks, all inside one lock).
 */
const allocateHours = asyncHandler(async (req, res) => {
  const { projectId, contractorId, allocatedHours } = validateUpdateAllocation(req.params, req.body);
  const result = await pmProjectService.updateContractorAllocation(
    req.user.userId,
    projectId,
    contractorId,
    allocatedHours
  );
  res.status(200).json(result);
});

module.exports = { create, list, listContractors, complete, allocateHours };
