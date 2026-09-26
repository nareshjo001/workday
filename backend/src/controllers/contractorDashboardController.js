const contractorDashboardService = require("../services/contractorDashboardService");
const asyncHandler = require("../utils/asyncHandler");

// Derive contractor identity exclusively from the authenticated session.
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await contractorDashboardService.getContractorDashboard(req.user.userId);
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
