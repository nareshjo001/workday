const contractorProjectService = require("../services/contractorProjectService");
const asyncHandler = require("../utils/asyncHandler");

// Resolve project ownership from the authenticated contractor, never request input.
const list = asyncHandler(async (req, res) => {
  const projects = await contractorProjectService.listAssignedProjects(req.user.userId);
  res.status(200).json(projects);
});

module.exports = { list };
