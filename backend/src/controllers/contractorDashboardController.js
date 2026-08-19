const contractorDashboardService = require("../services/contractorDashboardService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/contractor/dashboard — UI + analytics redesign.
 * `req.user.userId` is the ONLY source of the acting contractor's
 * identity — same convention as every other contractor controller in
 * this codebase.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await contractorDashboardService.getContractorDashboard(req.user.userId);
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
