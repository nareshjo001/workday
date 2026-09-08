const pmProjectService = require("../services/pmProjectService");
const {
  validateCreateProject,
  validateProjectIdParam,
  validateUpdateAllocation,
  validateUpdateProject, validateUpdateRequirement, validateReleaseContractor,
} = require("../validators/pmProjectValidators");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery, isoDateFilter } = require("../utils/listQuery");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body.
 */

const create = asyncHandler(async (req, res) => {
  const payload = validateCreateProject(req.body);
  const project = await pmProjectService.createProject(req.user.userId, payload, { ...req.user, requestId: req.requestId });
  res.status(201).json(project);
});

const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, { allowedSorts: { default: "p.created_at", created_at: "p.created_at", name: "p.name", start_date: "p.start_date", status: "p.status" }, allowedFilters: { status: (v) => { const x = String(v).toUpperCase(); if (!["ACTIVE", "COMPLETED", "ON_HOLD"].includes(x)) throw require("../utils/ApiError").badRequest("Unsupported project status."); return x; }, search: (v) => String(v).trim().slice(0, 100), startDate: isoDateFilter } });
  res.status(200).json(await pmProjectService.listProjectsPage(req.user.userId, query));
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
  const result = await pmProjectService.completeProject(req.user.userId, projectId, { ...req.user, requestId: req.requestId });
  res.status(200).json(result);
});
const closeReadiness = asyncHandler(async (req, res) => { const projectId = validateProjectIdParam(req.params); res.json(await pmProjectService.getCloseReadiness(req.user.userId, projectId)); });

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
    allocatedHours,
    { ...req.user, requestId: req.requestId }
  );
  res.status(200).json(result);
});
const update = asyncHandler(async(req,res)=>{const projectId=validateProjectIdParam(req.params);res.json(await pmProjectService.updateProject(req.user.userId,projectId,validateUpdateProject(req.body),{...req.user,requestId:req.requestId}));});
const updateRequirement = asyncHandler(async(req,res)=>{const projectId=validateProjectIdParam({id:req.params.projectId});const requirementId=Number(req.params.requirementId);if(!Number.isInteger(requirementId)||requirementId<1)throw require("../utils/ApiError").badRequest("Invalid requirement id.");res.json(await pmProjectService.updateRequirement(req.user.userId,projectId,requirementId,validateUpdateRequirement(req.body),{...req.user,requestId:req.requestId}));});
const release = asyncHandler(async (req, res) => { const { projectId, contractorId, actualEndDate, reason } = validateReleaseContractor(req.params, req.body); res.json(await pmProjectService.releaseContractor(req.user.userId, projectId, contractorId, { actualEndDate, reason }, { ...req.user, requestId: req.requestId })); });

module.exports = { create, list, listContractors, complete, closeReadiness, allocateHours, update, updateRequirement, release };
