const vendorProjectService = require("../services/vendorProjectService");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { parseListQuery, isoDateFilter } = require("../utils/listQuery");

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Vendor demand is scoped to active project-vendor access. */
const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, { allowedSorts: { default: "p.created_at", created_at: "p.created_at", name: "p.name", start_date: "p.start_date" }, allowedFilters: { search: (v) => String(v).trim().slice(0, 100), startDate: isoDateFilter } });
  res.status(200).json(await vendorProjectService.listAvailableProjectsPage(query, req.user.userId));
});

/**
 * GET /api/vendor/projects/:id/requirements — a single project's detail
 * (name/company/PM/dates/requirements with live counts), the screen a
 * vendor lands on after clicking a project from their browse list.
 */
const getRequirements = asyncHandler(async (req, res) => {
  const projectId = parsePositiveInt(req.params.id);
  if (!projectId) throw ApiError.badRequest("Invalid project id.");
  const project = await vendorProjectService.getProjectDetail(projectId, req.user.userId);
  res.status(200).json(project);
});

/**
 * GET /api/vendor/projects/:id/requirements/:requirementId/eligible-contractors
 * — contractors THIS vendor could assign to this one requirement.
 * `req.user.userId` is the only source of which vendor's contractors are
 * being listed.
 */
const getEligibleContractors = asyncHandler(async (req, res) => {
  const projectId = parsePositiveInt(req.params.id);
  const requirementId = parsePositiveInt(req.params.requirementId);
  if (!projectId || !requirementId) throw ApiError.badRequest("Invalid project or requirement id.");
  const result = await vendorProjectService.getEligibleContractorsForRequirement(
    req.user.userId,
    projectId,
    requirementId
  );
  res.status(200).json(result);
});

module.exports = { list, getRequirements, getEligibleContractors };
