const pmDashboardService = require("../services/pmDashboardService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/pm/dashboard — UI + analytics redesign. `req.user.userId` is
 * the ONLY source of the acting PM's identity — same convention as every
 * other PM controller in this codebase.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await pmDashboardService.getPmDashboard(req.user.userId);
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
