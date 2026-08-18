const contractorProjectService = require("../services/contractorProjectService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` is the ONLY source of identity here — there is no
 * query/body param this endpoint reads to decide whose projects to
 * return, so there's nothing for a caller to tamper with.
 */
const list = asyncHandler(async (req, res) => {
  const projects = await contractorProjectService.listAssignedProjects(req.user.userId);
  res.status(200).json(projects);
});

module.exports = { list };
