const vendorDashboardService = require("../services/vendorDashboardService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * GET /api/vendor/dashboard — UI + analytics redesign. `req.user.userId`
 * (set by `authenticate` from the verified JWT) is the ONLY source of
 * the acting vendor's identity here, same convention as every other
 * controller in this codebase — there is no vendor id anywhere in this
 * route's path/query/body.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await vendorDashboardService.getVendorDashboard(req.user.userId);
  res.status(200).json(dashboard);
});

module.exports = { getDashboard };
